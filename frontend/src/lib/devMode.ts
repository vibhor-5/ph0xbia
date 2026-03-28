/* ──────────────────────────────────────────────────────────────────────
 *  Dev Mode — Skip wallet, use mock seed, auto-start game
 * ────────────────────────────────────────────────────────────────────── */

export const IS_DEV_MODE = process.env.NEXT_PUBLIC_DEV_MODE === 'true';

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
