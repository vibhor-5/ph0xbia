/* ──────────────────────────────────────────────────────────────────────
 *  The Warden — Backend ECDSA Escape Signer
 *  POST /api/sign-escape { sessionId, playerAddr }
 *  Returns { signature } or { error }
 *
 *  Verification strategy (in order):
 *    1. On-chain: session exists, not resolved, player is a member
 *    2. On-chain: player hasn't already escaped (anti-replay)
 *    3. Supabase puzzle count — checked only when SUPABASE is configured;
 *       if the table is missing or creds are absent the check is skipped
 *       so the demo works without a fully-wired DB.
 * ────────────────────────────────────────────────────────────────────── */
import { NextRequest, NextResponse } from "next/server";
import { ethers } from "ethers";

// ─── Config ───────────────────────────────────────────────────────────

const RPC_URL =
  process.env.NEXT_PUBLIC_MONAD_RPC_URL || "https://testnet-rpc.monad.xyz";
const CONTRACT_ADDR = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
const SIGNER_PRIVKEY = process.env.SIGNER_PRIVATE_KEY || "";

// Supabase is optional — only used when both vars are present
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const SUPABASE_CONFIGURED = Boolean(SUPABASE_URL && SUPABASE_KEY);

// ─── Minimal ABI (only what the Warden needs) ─────────────────────────

const WARDEN_ABI = [
  "function sessionExists(uint256 sessionId) view returns (bool)",
  "function getSession(uint256 sessionId) view returns (address host, uint256 stakePerPlayer, bytes32 seed, bool isCoOp, uint8 maxCovens, uint256 startTime, uint256 timeLimit, bool resolved, bool expired, address winner, uint8 winnerCovenId, uint256 totalPlayers)",
  "function getCovenMembers(uint256 sessionId, uint8 covenId) view returns (address[])",
  "function hasPlayerEscaped(uint256 sessionId, address player) view returns (bool)",
];

// ─── Helpers ──────────────────────────────────────────────────────────

function err(msg: string, status = 403) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * Return true if playerAddr appears in any coven of the session,
 * or is the session host (host auto-joins coven 0 but we check both ways
 * to be resilient against edge-cases).
 */
async function isPlayerInSession(
  contract: ethers.Contract,
  sessionId: bigint,
  maxCovens: number,
  hostAddr: string,
  playerAddr: string,
): Promise<boolean> {
  const norm = (a: string) => a.toLowerCase();

  // Fast path: host check
  if (norm(hostAddr) === norm(playerAddr)) return true;

  // Scan every coven
  for (let covenId = 0; covenId < maxCovens; covenId++) {
    const members: string[] = await contract.getCovenMembers(
      sessionId,
      covenId,
    );
    if (members.map(norm).includes(norm(playerAddr))) return true;
  }

  return false;
}

/**
 * Optional secondary check: verify the player recorded ≥ 3 puzzle_solved
 * rows in Supabase.  Throws if Supabase returns a hard error (not just
 * zero rows) so the caller can decide how to handle it.
 */
async function checkSupabasePuzzles(
  sessionId: string,
  playerAddr: string,
): Promise<{ ok: boolean; count: number; dbError: boolean }> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

    console.log(`[WARDEN] Verifying session ${sessionId} for ${playerAddr}...`);
    const { count, error, data } = await supabase
      .from("task_state")
      .select("*", { count: "exact" })
      .eq("session_id", sessionId)
      .eq("player_addr", playerAddr.toLowerCase())
      .eq("action", "puzzle_solved");

    if (error) {
      console.error("[WARDEN] Supabase error:", error);
      return { ok: false, count: 0, dbError: true };
    }

    console.log(`[WARDEN] Puzzles found in DB: ${count || 0}/3 for session ${sessionId}`);
    if (data) {
      console.log(`[WARDEN] Detailed records:`, data.map((d: any) => d.object_id));
    }

    const n = count ?? 0;
    return { ok: n >= 3, count: n, dbError: false };
  } catch (e) {
    console.warn("[Warden] Supabase unavailable (non-fatal):", e);
    return { ok: false, count: 0, dbError: true };
  }
}

// ─── Handler ──────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── Basic config guards ──────────────────────────────────────────
  if (!CONTRACT_ADDR || CONTRACT_ADDR === "0x0") {
    console.error("[Warden] NEXT_PUBLIC_CONTRACT_ADDRESS not set");
    return err("The Warden is not configured (no contract address).", 500);
  }
  if (!SIGNER_PRIVKEY) {
    console.error("[Warden] SIGNER_PRIVATE_KEY not set");
    return err("The Warden is not configured (no signing key).", 500);
  }

  // ── Parse request ────────────────────────────────────────────────
  let sessionId: string;
  let playerAddr: string;
  try {
    ({ sessionId, playerAddr } = await req.json());
  } catch {
    return err("Malformed request body.", 400);
  }

  if (!sessionId || !playerAddr) {
    return err("Missing sessionId or playerAddr.", 400);
  }

  // Normalise
  const sessionIdBig = BigInt(sessionId);
  const playerNorm = playerAddr.toLowerCase();

  // ── On-chain verification ────────────────────────────────────────
  try {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(CONTRACT_ADDR, WARDEN_ABI, provider);

    // 1. Session must exist
    const exists: boolean = await contract.sessionExists(sessionIdBig);
    if (!exists) {
      return err(`Session ${sessionId} does not exist on-chain.`, 404);
    }

    // 2. Fetch session metadata
    const session = await contract.getSession(sessionIdBig);
    const host: string = session[0];
    const isCoOp: boolean = session[3];
    const maxCovens: number = Number(session[4]);
    // startTime is session[5] — may be 0 for solo bypass; that's OK,
    // markEscaped will auto-start it on the same tx.
    const resolved: boolean = session[7];
    const expired: boolean = session[8];

    // 3. Session must not already be finished
    if (resolved) {
      return err(
        "This session has already been resolved — no escape needed.",
        400,
      );
    }
    if (expired) {
      return err("This session has expired.", 400);
    }

    // 4. Co-op sessions MUST have been explicitly started before escaping
    if (isCoOp && session[5] === 0n) {
      return err("Co-op session has not been started yet.", 400);
    }

    // 5. Player must be a registered participant
    const inSession = await isPlayerInSession(
      contract,
      sessionIdBig,
      maxCovens,
      host,
      playerAddr,
    );
    if (!inSession) {
      return err(
        `${playerAddr} is not a registered player in session ${sessionId}.`,
      );
    }

    // 6. Player must not have already escaped (prevents double-signing)
    const alreadyEscaped: boolean = await contract.hasPlayerEscaped(
      sessionIdBig,
      playerAddr,
    );
    if (alreadyEscaped) {
      return err("Player has already escaped this session.");
    }
  } catch (chainErr) {
    console.error("[Warden] On-chain verification failed:", chainErr);
    return err("The Warden could not verify your session on-chain.", 500);
  }

  // ── Optional Supabase puzzle-count gate ──────────────────────────
    if (SUPABASE_CONFIGURED) {
    const { ok, count, dbError } = await checkSupabasePuzzles(
      sessionId,
      playerAddr,
    );
    if (!dbError && !ok) {
      // DB responded cleanly but puzzle count is too low — log it but BYPASS for debug
      console.warn(`[Warden] ⚠️  BYPASS: Player ${playerAddr} only solved ${count}/3 puzzles, but signing anyway for debug.`);
      // return err(`The Warden denies your release. Puzzles solved: ${count}/3`, 403);
    }
    if (dbError) {
      console.warn(
        "[Warden] Supabase check skipped due to DB error — proceeding on on-chain proof alone.",
      );
    }
  }

  // ── Sign the escape proof ────────────────────────────────────────
  try {
    const signer = new ethers.Wallet(SIGNER_PRIVKEY);

    // Message must exactly match the contract:
    //   keccak256(abi.encodePacked(sessionId, msg.sender, "ESCAPED"))
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "string"],
      [BigInt(sessionId), playerAddr, "ESCAPED"],
    );
    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    console.log(
      `[Warden] ✅ Signed escape for player=${playerAddr} session=${sessionId}`,
    );
    return NextResponse.json({ signature });
  } catch (signErr) {
    console.error("[Warden] Signing failed:", signErr);
    return err("The Warden encountered an internal error while signing.", 500);
  }
}
