/* ──────────────────────────────────────────────────────────────────────
 *  Dev Mode — Skip wallet, use mock seed, auto-start game
 * ────────────────────────────────────────────────────────────────────── */

export const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

const adminWallets = (process.env.NEXT_PUBLIC_ADMIN_WALLETS || '')
  .split(',')
  .map((addr) => addr.trim().toLowerCase())
  .filter(Boolean);

export function isAdmin(address?: string | null): boolean {
  if (!address) return false;
  return adminWallets.includes(address.toLowerCase());
}

/** Mock seed used in dev mode (deterministic for testing) */
export const DEV_SEED = '0xdeadbeefcafebabe1234567890abcdef1234567890abcdef1234567890abcdef';

/** Mock wallet address for dev mode */
export const DEV_WALLET = '0xDEV0000000000000000000000000000000000001';

/** Mock session ID for dev mode */
export const DEV_SESSION_ID = 42n;

export function getDevConfig() {
  return {
    isDevMode: IS_DEV_MODE,
    seed: DEV_SEED,
    wallet: DEV_WALLET,
    sessionId: DEV_SESSION_ID,
    covenId: 0,
    isCoOp: false,
  };
}
