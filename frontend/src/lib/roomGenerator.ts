/* ──────────────────────────────────────────────────────────────────────
 *  Room Generator — Procedural asylum ward from seed
 * ────────────────────────────────────────────────────────────────────── */
import { mulberry32, seedFromHex, seededPickN, seededShuffle, seededInt, seededPick } from './prng';
import type {
  WardConfig, WardObject, PuzzleConfig, CoopTaskConfig,
  GhostPath, ScareEvent, BlackoutEvent, HorrorObjectType,
  PuzzleId, PuzzleName, CoopTaskType, Position, ScareType,
} from '@/types/game';

const PUZZLE_POOL: { id: PuzzleId; name: PuzzleName }[] = [
  { id: 'P1', name: 'BloodCipher' },
  { id: 'P2', name: 'PatientNumbers' },
  { id: 'P3', name: 'EVPRecording' },
  { id: 'P4', name: 'BinaryLocks' },
  { id: 'P5', name: 'RitualSequence' },
  { id: 'P6', name: 'PatientAnagram' },
];

const COOP_POOL: CoopTaskType[] = [
  'whisper_code', 'seance_circle', 'possessed_relay', 'blood_ritual_levers',
];

const OBJECT_TYPES: HorrorObjectType[] = [
  'bloodstained_cabinet', 'patient_file', 'shattered_mirror',
  'rusted_surgical_tray', 'old_radio', 'medicine_bottle',
  'rocking_chair', 'wheelchair', 'broken_bed', 'padded_wall',
  'electroshock_machine', 'straitjacket',
];

const HORROR_FLAVOR_TEXTS: string[] = [
  "A patient's journal. The last entry just says 'IT SEES ME' over and over.",
  "A rusted surgical tray. The tools are arranged in a pattern.",
  "A shattered mirror. Your reflection didn't move when you did.",
  "A child's music box. It starts playing on its own. Then stops.",
  "A photograph. Everyone is smiling except the one looking at you.",
  "A door that opens to a brick wall. 'WRONG WAY' scratched in mortar.",
  "A rocking chair. It's still moving.",
  "A straitjacket on the floor. It's warm.",
  "A pile of wristbands. One has your name.",
  "A phone on the wall. Someone is breathing on the other end.",
  "Scratches inside a cell door. They form a face.",
  "A bottle of pills. Label reads: 'FOR FORGETTING'.",
];

const ROT_SHIFTS = [7, 13, 19];
const ROMAN_SETS = [
  ['XIV', 'XLII', 'LXXVII'],
  ['IX', 'MCMXCIX', 'CXLIV'],
  ['XXVI', 'DCLXVI', 'LXXXVIII'],
];

const SCARE_TYPES: ScareType[] = ['face_flash', 'hand_reach', 'mirror_distortion'];

export function generateWard(seedHex: string, isCoOp: boolean): WardConfig {
  const rand = mulberry32(seedFromHex(seedHex));
  const W = 800;
  const H = 600;
  const MARGIN = 48;

  // ── Pick 3 puzzles ──
  const chosenPuzzles = seededPickN(rand, PUZZLE_POOL, 3);
  const puzzles: PuzzleConfig[] = chosenPuzzles.map((p) => ({
    id: p.id,
    name: p.name,
    params: generatePuzzleParams(rand, p.id),
    solved: false,
  }));

  // ── Pick 2 co-op tasks ──
  const coopTasks: CoopTaskConfig[] = isCoOp
    ? seededPickN(rand, COOP_POOL, 2).map((type) => ({
        type,
        params: generateCoopParams(rand, type),
        resolved: false,
      }))
    : [];

  // ── Place 12 objects ──
  const objects: WardObject[] = [];
  const clueIndices = new Set<number>();
  while (clueIndices.size < 3) {
    clueIndices.add(seededInt(rand, 12));
  }

  // Pick 2 objects for jump scares (from non-clue objects)
  const scareObjectIndices = new Set<number>();
  while (scareObjectIndices.size < 2) {
    const idx = seededInt(rand, 12);
    if (!clueIndices.has(idx)) scareObjectIndices.add(idx);
  }

  for (let i = 0; i < 12; i++) {
    let x: number, y: number;
    let attempts = 0;
    do {
      x = MARGIN + rand() * (W - MARGIN * 2);
      y = MARGIN + rand() * (H - MARGIN * 2);
      attempts++;
    } while (attempts < 50 && objects.some((o) => {
      const dx = o.x - x;
      const dy = o.y - y;
      return Math.sqrt(dx * dx + dy * dy) < 64;
    }));

    const hasClue = clueIndices.has(i);
    const isScary = scareObjectIndices.has(i);

    objects.push({
      id: `obj-${i}`,
      type: OBJECT_TYPES[i % OBJECT_TYPES.length],
      x: Math.round(x),
      y: Math.round(y),
      hasClue,
      isScary,
      scareType: isScary ? seededPick(rand, SCARE_TYPES) : undefined,
      flavorText: hasClue ? undefined : seededPick(rand, HORROR_FLAVOR_TEXTS),
      investigated: false,
    });
  }

  // ── Scare events ──
  const scareEvents: ScareEvent[] = objects
    .filter((o) => o.isScary)
    .map((o) => ({
      objectId: o.id,
      scareType: o.scareType!,
      triggered: false,
      durationMs: 200,
    }));

  // ── Ghost patrol paths (2-3 ghosts) ──
  const ghostCount = 2 + seededInt(rand, 2); // 2 or 3
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

  // ── Blackout events (2–4 during a session) ──
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

function generatePuzzleParams(rand: () => number, id: PuzzleId): Record<string, unknown> {
  switch (id) {
    case 'P1': return { shift: seededPick(rand, ROT_SHIFTS), plaintext: 'ASYLUM' };
    case 'P2': return { numerals: seededPick(rand, ROMAN_SETS) };
    case 'P3': return { sequence: '... --- ...' }; // SOS for now
    case 'P4': return { values: Array.from({ length: 4 }, () => seededInt(rand, 16).toString(2).padStart(4, '0')) };
    case 'P5': return { sequence: seededShuffle(rand, ['#8b0000', '#f5f0e1', '#2d6a4f', '#4a90d9', '#bfa14a']) };
    case 'P6': return { word: seededPick(rand, ['ASYLUM', 'WARDEN', 'PATIENT', 'CURSED', 'ESCAPE', 'SPIRIT', 'SHADOW', 'PHOBIA']) };
    default: return {};
  }
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
