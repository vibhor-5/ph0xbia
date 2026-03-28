/* ──────────────────────────────────────────────────────────────────────
 *  Room Generator — Procedural asylum ward from seed
 *  Uses exact 3 active puzzles and 5 clean static objects.
 * ────────────────────────────────────────────────────────────────────── */
import { mulberry32, seedFromHex, seededPickN, seededShuffle, seededInt, seededPick } from './prng';
import type {
  WardConfig, WardObject, PuzzleConfig, CoopTaskConfig,
  GhostPath, ScareEvent, BlackoutEvent, HorrorObjectType,
  PuzzleId, CoopTaskType, Position, ScareType,
} from '@/types/game';

const COOP_POOL: CoopTaskType[] = [
  'whisper_code', 'seance_circle', 'possessed_relay', 'blood_ritual_levers',
];

const SCARE_TYPES: ScareType[] = ['face_flash', 'hand_reach', 'mirror_distortion'];

interface StaticObject {
  id: string;
  type: HorrorObjectType;
  x: number;
  z: number;
  rotY: number;
  puzzleId?: PuzzleId;
  hintForPuzzle?: PuzzleId;
  hintText?: string;
  isScary?: boolean;
  flavorText?: string;
}

// Room bounds: x from -5 to +5 (width 10), z from -6 to +6 (depth 12)
// Door is at x:2.5, z:-5.92  —  keep that area clear!
const STATIC_OBJECTS: StaticObject[] = [
  // Bed — against the left wall, facing right
  { id: 'obj-bed', type: 'bed', x: -4.0, z: -3, rotY: Math.PI / 2, puzzleId: 'P2' },
  // Shelf — against the right wall (front area), facing left
  { id: 'obj-shelf', type: 'shelf', x: 4.3, z: 3, rotY: -Math.PI / 2, hintForPuzzle: 'P2', hintText: '' },
  // Cabinet — against the right wall (back area), away from the door
  { id: 'obj-cabinet', type: 'cabinet', x: 4.3, z: -3, rotY: -Math.PI / 2, puzzleId: 'P1' },
  // Chair — center-left area, angled
  { id: 'obj-chair', type: 'chair', x: -1.5, z: 2.5, rotY: Math.PI / 4, hintForPuzzle: 'P1', hintText: '' },
  // Mirror — on the left wall, facing right
  { id: 'obj-mirror', type: 'mirror', x: -4.9, z: 0, rotY: Math.PI / 2, puzzleId: 'P3' },
];

function generatePuzzles(rand: () => number): PuzzleConfig[] {
  // P1: Blood Cipher
  const shift = seededPick(rand, [5, 7, 11, 13]);
  const plaintext = seededPick(rand, ['ASYLUM', 'WARDEN', 'ESCAPE', 'CURSED']);
  const ciphertext = plaintext.split('').map(c => {
    const code = (c.charCodeAt(0) - 65 + shift) % 26;
    return String.fromCharCode(code + 65);
  }).join('');

  // P2: Binary Locks
  const binaryDigits = Array.from({ length: 4 }, () => seededInt(rand, 10));
  const binaryStrings = binaryDigits.map(d => d.toString(2).padStart(4, '0'));
  const binaryAnswer = binaryDigits.join('');

  // P3: Patient Anagram
  const anagramWords = ['WARDEN', 'SPIRIT', 'PHOBIA', 'SHADOW', 'ASYLUM'];
  const anagramWord = seededPick(rand, anagramWords);
  const scrambled = seededShuffle(rand, anagramWord.split('')).join('');

  return [
    {
      id: 'P1', name: 'BloodCipher',
      title: '🩸 BLOOD CIPHER',
      description: `Encrypted letters are scratched into the cabinet:\n\n"${ciphertext}"\n\nA note nearby reads: "Shift back by ${shift} to reveal the truth."\nType the decrypted word:`,
      answer: plaintext,
      params: { shift, ciphertext, plaintext },
      solved: false,
    },
    {
      id: 'P2', name: 'BinaryLocks',
      title: '🔒 BINARY LOCKS',
      description: `Four binary sequences are scratched onto the bed frame:\n\n${binaryStrings.map(b => `  [ ${b} ]`).join('\n')}\n\nConvert each to a decimal digit and type the 4-digit code:`,
      answer: binaryAnswer,
      params: { binaryStrings, binaryAnswer },
      solved: false,
    },
    {
      id: 'P3', name: 'PatientAnagram',
      title: '🪞 PATIENT ANAGRAM',
      description: `The mirror reflects scrambled letters etched in blood:\n\n"${scrambled}"\n\nUnscramble these letters to find the hidden word.\nHint: it relates to who controls this asylum.`,
      answer: anagramWord,
      params: { scrambled, anagramWord },
      solved: false,
    },
  ];
}

function generateHints(puzzles: PuzzleConfig[], rand: () => number): Record<PuzzleId, string> {
  const p1 = puzzles.find(p => p.id === 'P1')!;
  const p2 = puzzles.find(p => p.id === 'P2')!;
  const p3 = puzzles.find(p => p.id === 'P3')!;

  return {
    'P1': `📝 A crumpled note on the chair reads: "The cipher uses a shift of ${p1.params.shift}. Start from the cabinet to decode the truth."`,
    'P2': `💡 A bloody handprint on the shelf points to binary numbers: ${(p2.params.binaryStrings as string[]).slice(0, 2).join(' ')}... Convert each group of 4 to a single digit.`,
    'P3': `📋 A doctor's note stuck to the mirror: "The patient keeps writing '${p3.params.scrambled}' — it's an anagram of their true identity. Beware the mirror."`,
  } as Record<PuzzleId, string>;
}

export function generateWard(seedHex: string, isCoOp: boolean): WardConfig {
  const rand = mulberry32(seedFromHex(seedHex));

  const puzzles = generatePuzzles(rand);
  const hints = generateHints(puzzles, rand);

  const coopTasks: CoopTaskConfig[] = isCoOp
    ? seededPickN(rand, COOP_POOL, 2).map((type) => ({
        type,
        params: generateCoopParams(rand, type),
        resolved: false,
      }))
    : [];

  const objects: WardObject[] = STATIC_OBJECTS.map((so) => ({
    id: so.id,
    type: so.type,
    x: so.x,
    z: so.z,
    rotY: so.rotY,
    hasClue: !!so.hintForPuzzle,
    isScary: !!so.isScary,
    scareType: so.isScary ? seededPick(rand, SCARE_TYPES) : undefined,
    flavorText: so.flavorText || (so.hintForPuzzle ? undefined : seededPick(rand, FLAVOR_TEXTS)),
    investigated: false,
    puzzleId: so.puzzleId,
    hintForPuzzle: so.hintForPuzzle,
    hintText: so.hintForPuzzle ? hints[so.hintForPuzzle] : undefined,
  }));

  // ── Ghost patrol paths ──
  const W = 10, H = 12, MARGIN = 1;
  const ghostPaths: GhostPath[] = [];
  ghostPaths.push({
    id: `ghost-0`,
    waypoints: [
      { x: -3, y: -4 },
      { x: 3, y: 4 },
    ],
    speed: 30 + rand() * 30,
    pauseDurationMs: 1000 + seededInt(rand, 3000),
    flickerPattern: [0.6, 0.4, 0.7, 0.0, 0.5, 0.8, 0.3, 0.6],
  });

  // ── Blackout events ──
  const blackoutCount = 2 + seededInt(rand, 3);
  const blackoutEvents: BlackoutEvent[] = [];
  for (let b = 0; b < blackoutCount; b++) {
    blackoutEvents.push({
      startTimeSec: 30 + b * 60 + seededInt(rand, 30),
      durationSec: 3 + seededInt(rand, 3),
    });
  }

  return {
    puzzles,
    coopTasks,
    objects,
    ghostPaths,
    scareEvents: [],
    blackoutEvents,
    flickerSeed: seededInt(rand, 999999),
  };
}

function generateCoopParams(rand: () => number, type: CoopTaskType): Record<string, unknown> {
  switch (type) {
    case 'whisper_code': return { code: String(seededInt(rand, 900000) + 100000) };
    case 'seance_circle': return { circleCount: 3 };
    case 'possessed_relay': return { drainPerSec: 2 };
    case 'blood_ritual_levers': return { windowMs: 5000 };
    default: return {};
  }
}

const FLAVOR_TEXTS: string[] = [
  "A patient's journal. The last entry just says 'IT SEES ME' over and over.",
  "Just an old piece of furniture. Dust covers every surface.",
  "You sense you are being watched.",
];
