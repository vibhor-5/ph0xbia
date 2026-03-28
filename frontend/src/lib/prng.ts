/* ──────────────────────────────────────────────────────────────────────
 *  mulberry32 — Deterministic PRNG from a 32-bit seed
 * ────────────────────────────────────────────────────────────────────── */

export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function seededInt(rand: () => number, max: number): number {
  return Math.floor(rand() * max);
}

export function seededFloat(rand: () => number): number {
  return rand();
}

export function seededPick<T>(rand: () => number, arr: T[]): T {
  return arr[seededInt(rand, arr.length)];
}

export function seededShuffle<T>(rand: () => number, arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = seededInt(rand, i + 1);
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function seededPickN<T>(rand: () => number, arr: T[], n: number): T[] {
  const shuffled = seededShuffle(rand, arr);
  return shuffled.slice(0, n);
}

/** Convert a hex seed (bytes32) to a 32-bit integer for mulberry32 */
export function seedFromHex(hex: string): number {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex;
  return parseInt(clean.slice(0, 8), 16) >>> 0;
}
