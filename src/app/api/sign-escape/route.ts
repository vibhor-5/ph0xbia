/**
 * PH0xBIA — The Warden (Backend Escape Signer)
 *
 * POST /api/sign-escape
 * Body: { sessionId: string, playerAddr: string }
 *
 * 1. Verifies player has solved 3 puzzles in Supabase task_state
 * 2. Signs escape message with SIGNER_PRIVATE_KEY (ECDSA)
 * 3. Returns { signature } for on-chain markEscaped()
 */

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ethers } from "ethers";

// Server-side Supabase client (uses service role key for full access)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const body = await req.json();
    const { sessionId, playerAddr } = body;

    // ── Validate input ──
    if (!sessionId || !playerAddr) {
      return NextResponse.json(
        { error: "Missing sessionId or playerAddr" },
        { status: 400 }
      );
    }

    // ── Check signer key exists ──
    const signerKey = process.env.SIGNER_PRIVATE_KEY;
    if (!signerKey) {
      console.error("[Warden] SIGNER_PRIVATE_KEY not set!");
      return NextResponse.json(
        { error: "The Warden is not available." },
        { status: 500 }
      );
    }

    // ── Verify player is in this session ──
    const { data: playerRow, error: playerError } = await supabase
      .from("session_players")
      .select("id")
      .eq("session_id", sessionId)
      .eq("wallet_address", playerAddr.toLowerCase())
      .single();

    if (playerError || !playerRow) {
      return NextResponse.json(
        { error: "The Warden sees no patient by that name." },
        { status: 403 }
      );
    }

    // ── Verify 3 puzzles solved ──
    const { count, error: countError } = await supabase
      .from("task_state")
      .select("*", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("player_addr", playerAddr.toLowerCase())
      .eq("action", "puzzle_solved");

    if (countError) {
      console.error("[Warden] Supabase query error:", countError);
      return NextResponse.json(
        { error: "The Warden's records are corrupted." },
        { status: 500 }
      );
    }

    if (!count || count < 3) {
      return NextResponse.json(
        {
          error: "The Warden denies your release. Puzzles remain.",
          solved: count || 0,
          required: 3,
        },
        { status: 403 }
      );
    }

    // ── Sign the escape message ──
    // Message format must match the contract's verification:
    // keccak256(abi.encodePacked(sessionId, playerAddr, "ESCAPED"))
    const messageHash = ethers.solidityPackedKeccak256(
      ["uint256", "address", "string"],
      [BigInt(sessionId), playerAddr, "ESCAPED"]
    );

    const signer = new ethers.Wallet(signerKey);
    const signature = await signer.signMessage(ethers.getBytes(messageHash));

    return NextResponse.json({ signature });
  } catch (err: any) {
    console.error("[Warden] Unexpected error:", err);
    return NextResponse.json(
      { error: "The Warden encountered darkness." },
      { status: 500 }
    );
  }
}
