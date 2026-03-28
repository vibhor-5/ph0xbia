/* ──────────────────────────────────────────────────────────────────────
 *  Room Generator — Procedural asylum ward from seed
 *  Now generates all 6 puzzles with hint chains and static object layout
 * ────────────────────────────────────────────────────────────────────── */
import { mulberry32, seedFromHex, seededPickN, seededShuffle, seededInt, seededPick } from './prng';
import type {
  WardConfig, WardObject, PuzzleConfig, CoopTaskConfig,
  GhostPath, ScareEvent, BlackoutEvent, HorrorObjectType,
  PuzzleId, PuzzleName, CoopTaskType, Position, ScareType,
} from '@/types/game';

const COOP_POOL: CoopTaskType[] = [
  'whisper_code', 'seance_circle', 'possessed_relay', 'blood_ritual_levers',
];

const SCARE_TYPES: ScareType[] = ['face_flash', 'hand_reach', 'mirror_distortion'];

// ─── Static Object Layout ───────────────────────────────────────────
// Objects placed in logical themed zones (coordinates in ward-space 800×600)

interface StaticObject {
  id: string;
  type: HorrorObjectType;
  x: number;
  y: number;
  /** Which puzzle this object triggers (player interacts to open puzzle modal) */
  puzzleId?: PuzzleId;
  /** Which puzzle this object provides a hint for */
  hintForPuzzle?: PuzzleId;
  /** Static hint text (overridden by generator for randomized hints) */
  hintText?: string;
  /** Whether this is a scare object */
  isScary?: boolean;
  /** Flavor text for non-hint, non-puzzle objects */
  flavorText?: string;
}

// 12 objects in themed zones
const STATIC_OBJECTS: StaticObject[] = [
  // ── Patient Ward (back-left) ──
  {
    id: 'obj-bed',
    type: 'broken_bed',
    x: 120, y: 100,
    flavorText: "A rusted hospital bed. The restraints are still buckled shut. Who was the last patient?",
    isScary: true,
  },
  {
    id: 'obj-straitjacket',
    type: 'straitjacket',
    x: 80, y: 200,
    hintForPuzzle: 'P6',
    hintText: '', // set by generator
  },
  // ── Doctor's Office (center-right) ──
  {
    id: 'obj-patient-file',
    type: 'patient_file',
    x: 550, y: 150,
    puzzleId: 'P1', // Blood Cipher puzzle
  },
  {
    id: 'obj-cabinet',
    type: 'bloodstained_cabinet',
    x: 650, y: 100,
    puzzleId: 'P5', // Ritual Sequence puzzle
  },
  // ── Surgery Room (right wall) ──
  {
    id: 'obj-surgical-tray',
    type: 'rusted_surgical_tray',
    x: 700, y: 300,
    hintForPuzzle: 'P5',
    hintText: '', // set by generator
  },
  {
    id: 'obj-medicine',
    type: 'medicine_bottle',
    x: 720, y: 400,
    puzzleId: 'P2', // Patient Numbers puzzle
    hintForPuzzle: undefined,
  },
  {
    id: 'obj-electroshock',
    type: 'electroshock_machine',
    x: 680, y: 250,
    puzzleId: 'P4', // Binary Locks puzzle
  },
  // ── Padded Cell (back-right) ──
  {
    id: 'obj-padded-wall',
    type: 'padded_wall',
    x: 650, y: 80,
    hintForPuzzle: 'P4',
    hintText: '', // set by generator
  },
  // ── Common Area (center) ──
  {
    id: 'obj-wheelchair',
    type: 'wheelchair',
    x: 350, y: 350,
    hintForPuzzle: 'P2',
    hintText: '', // set by generator
    isScary: true,
  },
  {
    id: 'obj-radio',
    type: 'old_radio',
    x: 400, y: 450,
    puzzleId: 'P3', // EVP Recording puzzle
  },
  {
    id: 'obj-rocking-chair',
    type: 'rocking_chair',
    x: 300, y: 500,
    hintForPuzzle: 'P1',
    hintText: '', // set by generator
  },
  // ── Storage (left wall) ──
  {
    id: 'obj-mirror',
    type: 'shattered_mirror',
    x: 80, y: 400,
    puzzleId: 'P6', // Patient Anagram puzzle
  },
];

// ─── Puzzle Definitions ─────────────────────────────────────────────

function generatePuzzles(rand: () => number): PuzzleConfig[] {
  // P1: Blood Cipher
  const shift = seededPick(rand, [5, 7, 11, 13]);
  const plaintext = seededPick(rand, ['ASYLUM', 'WARDEN', 'ESCAPE', 'CURSED']);
  const ciphertext = plaintext.split('').map(c => {
    const code = (c.charCodeAt(0) - 65 + shift) % 26;
    return String.fromCharCode(code + 65);
  }).join('');

  // P2: Patient Numbers (Roman Numerals)
  const romanSets = [
    { romans: ['XIV', 'XLII', 'LXXVII'], sum: 133 },
    { romans: ['IX', 'XXVI', 'LXIII'], sum: 98 },
    { romans: ['XVII', 'XXXIII', 'LI'], sum: 101 },
    { romans: ['XII', 'XLIV', 'LXVIII'], sum: 124 },
  ];
  const romanSet = seededPick(rand, romanSets);

  // P3: EVP Recording (Morse Code)
  const morseWords = [
    { word: 'SOS', morse: '... --- ...' },
    { word: 'HELP', morse: '.... . .-.. .--.' },
    { word: 'RUN', morse: '.-. ..- -.' },
    { word: 'FEAR', morse: '..-. . .- .-.' },
  ];
  const morseChoice = seededPick(rand, morseWords);

  // P4: Binary Locks
  const binaryDigits = Array.from({ length: 4 }, () => seededInt(rand, 10));
  const binaryStrings = binaryDigits.map(d => d.toString(2).padStart(4, '0'));
  const binaryAnswer = binaryDigits.join('');

  // P5: Ritual Sequence (5 colors in order)
  const colorNames = ['RED', 'CREAM', 'GREEN', 'BLUE', 'GOLD'];
  const colorSequence = seededShuffle(rand, [...colorNames]);
  const colorAnswer = colorSequence.join(' ');

  // P6: Patient Anagram
  const anagramWords = ['WARDEN', 'SPIRIT', 'PHOBIA', 'SHADOW', 'ASYLUM'];
  const anagramWord = seededPick(rand, anagramWords);
  const scrambled = seededShuffle(rand, anagramWord.split('')).join('');

  return [
    {
      id: 'P1', name: 'BloodCipher',
      title: '🩸 BLOOD CIPHER',
      description: `Encrypted letters are scratched in blood on the wall:\n\n"${ciphertext}"\n\nA note nearby reads: "Shift back by ${shift} to reveal the truth."\nType the decrypted word:`,
      answer: plaintext,
      params: { shift, ciphertext, plaintext },
      solved: false,
    },
    {
      id: 'P2', name: 'PatientNumbers',
      title: '🏥 PATIENT NUMBERS',
      description: `Three patient wristbands show Roman numerals:\n\n${romanSet.romans.map(r => `  ⟢ ${r}`).join('\n')}\n\nType the SUM as a regular number:`,
      answer: String(romanSet.sum),
      params: { romans: romanSet.romans, sum: romanSet.sum },
      solved: false,
    },
    {
      id: 'P3', name: 'EVPRecording',
      title: '📻 EVP RECORDING',
      description: `The radio crackles with static... A ghostly voice transmits in Morse code:\n\n"${morseChoice.morse}"\n\nDecode the message and type the word:`,
      answer: morseChoice.word,
      params: { morse: morseChoice.morse, word: morseChoice.word },
      solved: false,
    },
    {
      id: 'P4', name: 'BinaryLocks',
      title: '🔒 BINARY LOCKS',
      description: `Four binary sequences are scratched into the device panel:\n\n${binaryStrings.map(b => `  [ ${b} ]`).join('\n')}\n\nConvert each to a decimal digit and type the 4-digit code:`,
      answer: binaryAnswer,
      params: { binaryStrings, binaryAnswer },
      solved: false,
    },
    {
      id: 'P5', name: 'RitualSequence',
      title: '🕯️ RITUAL SEQUENCE',
      description: `Five colored candles surround a blood ritual circle.\nThey must be lit in the correct order.\n\nThe correct order is:\n${colorSequence.map((c, i) => `  ${i + 1}. ${c}`).join('\n')}\n\nType the colors in order, separated by spaces:`,
      answer: colorAnswer,
      params: { colorSequence },
      solved: false,
    },
    {
      id: 'P6', name: 'PatientAnagram',
      title: '🪞 PATIENT ANAGRAM',
      description: `The mirror shows scrambled letters etched in blood:\n\n"${scrambled}"\n\nUnscramble these letters to find the hidden word.\nHint: it relates to who controls this asylum.`,
      answer: anagramWord,
      params: { scrambled, anagramWord },
      solved: false,
    },
  ];
}

// ─── Hint Text Generation ───────────────────────────────────────────

function generateHints(puzzles: PuzzleConfig[], rand: () => number): Record<PuzzleId, string> {
  const p1 = puzzles.find(p => p.id === 'P1')!;
  const p2 = puzzles.find(p => p.id === 'P2')!;
  const p4 = puzzles.find(p => p.id === 'P4')!;
  const p5 = puzzles.find(p => p.id === 'P5')!;
  const p6 = puzzles.find(p => p.id === 'P6')!;

  return {
    'P1': `📝 A crumpled note reads: "The cipher uses a shift of ${p1.params.shift}. Start from the patient's file to decode the truth."`,
    'P2': `🏷️ A patient wristband shows: "${(p2.params.romans as string[])[seededInt(rand, 3)]}" — Add all three wristband numbers together...`,
    'P4': `💡 Binary scratches on the wall: ${(p4.params.binaryStrings as string[]).slice(0, 2).join(' ')}... Convert each group of 4 to a digit.`,
    'P5': `🕯️ Candle wax stains show a ritual order... the first color is ${(p5.params.colorSequence as string[])[0]}, the last is ${(p5.params.colorSequence as string[])[4]}.`,
    'P6': `📋 A doctor's note: "The patient keeps writing '${p6.params.scrambled}' — it's an anagram of their true identity."`,
    'P3': '' as string, // No separate hint object for P3 — the radio IS the puzzle
  } as Record<PuzzleId, string>;
}

// ─── Main Generator ─────────────────────────────────────────────────

export function generateWard(seedHex: string, isCoOp: boolean): WardConfig {
  const rand = mulberry32(seedFromHex(seedHex));

  // ── Generate all 6 possible puzzles ──
  const allPuzzles = generatePuzzles(rand);

  // ── Generate hints for all 6 ──
  const allHints = generateHints(allPuzzles, rand);

  // ── Randomly pick 3 active puzzles for this session ──
  const puzzles = seededPickN(rand, allPuzzles, 3);
  const activeIds = new Set(puzzles.map(p => p.id));

  // ── Co-op tasks ──
  const coopTasks: CoopTaskConfig[] = isCoOp
    ? seededPickN(rand, COOP_POOL, 2).map((type) => ({
        type,
        params: generateCoopParams(rand, type),
        resolved: false,
      }))
    : [];

  // ── Build objects from static layout ──
  const objects: WardObject[] = STATIC_OBJECTS.map((so) => {
    // If this object is tied to a puzzle that isn't active, strip the puzzle data
    // so it just becomes a regular flavor/scare object
    const isPuzzleActive = so.puzzleId ? activeIds.has(so.puzzleId) : false;
    const isHintActive = so.hintForPuzzle ? activeIds.has(so.hintForPuzzle) : false;

    return {
      id: so.id,
      type: so.type,
      x: so.x,
      y: so.y,
      hasClue: isHintActive, 
      isScary: !!so.isScary,
      scareType: so.isScary ? seededPick(rand, SCARE_TYPES) : undefined,
      flavorText: so.flavorText || ((isHintActive || isPuzzleActive) ? undefined : seededPick(rand, FLAVOR_TEXTS)),
      investigated: false,
      puzzleId: isPuzzleActive ? so.puzzleId : undefined,
      hintForPuzzle: isHintActive ? so.hintForPuzzle : undefined,
      hintText: isHintActive ? allHints[so.hintForPuzzle!] : undefined,
    };
  });

  // ── Scare events ──
  const scareEvents: ScareEvent[] = objects
    .filter((o) => o.isScary)
    .map((o) => ({
      objectId: o.id,
      scareType: o.scareType!,
      triggered: false,
      durationMs: 200,
    }));

  // ── Ghost patrol paths ──
  const W = 800, H = 600, MARGIN = 48;
  const ghostCount = 2 + seededInt(rand, 2);
  const ghostPaths: GhostPath[] = [];
  for (let g = 0; g < ghostCount; g++) {
    const waypointCount = 3 + seededInt(rand, 3);
    const waypoints: Position[] = [];
    for (let w = 0; w < waypointCount; w++) {
      waypoints.push({
        x: Math.round(MARGIN + rand() * (W - MARGIN * 2)),
        y: Math.round(MARGIN + rand() * (H - MARGIN * 2)),
      });
    }
    ghostPaths.push({
      id: `ghost-${g}`,
      waypoints,
      speed: 30 + rand() * 30,
      pauseDurationMs: 1000 + seededInt(rand, 3000),
      flickerPattern: [0.6, 0.4, 0.7, 0.0, 0.5, 0.8, 0.3, 0.6],
    });
  }

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
    scareEvents,
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
  "A rusted surgical tray. The tools are arranged in a pattern.",
  "A shattered mirror. Your reflection didn't move when you did.",
  "A child's music box. It starts playing on its own. Then stops.",
  "A photograph. Everyone is smiling except the one looking at you.",
  "A rocking chair. It's still moving.",
  "A straitjacket on the floor. It's warm.",
  "A pile of wristbands. One has your name.",
  "A phone on the wall. Someone is breathing on the other end.",
  "Scratches inside a cell door. They form a face.",
  "A bottle of pills. Label reads: 'FOR FORGETTING'.",
];
