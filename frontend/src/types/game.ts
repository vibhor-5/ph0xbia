/* ──────────────────────────────────────────────────────────────────────
 *  PH0xBIA — Shared Type Definitions
 *  All game types used across scenes, managers, components, and hooks.
 *  ⚡ This file is a DAY-1 deliverable — all devs depend on it.
 * ────────────────────────────────────────────────────────────────────── */

// ─── Session & Staking ─────────────────────────────────────────────

export interface Session {
  sessionId: bigint;
  host: string; // wallet address ("The Summoner")
  stakePerPlayer: bigint;
  seed: string; // bytes32 hex — "The Curse Seed"
  isCoOp: boolean;
  maxCovens: number;
  maxPlayersPerCoven: number;
  startTime: number; // unix timestamp
  timeLimit: number; // seconds
  resolved: boolean;
  winner: string; // solo winner address
  winnerCovenId: number;
  covenCount: number;
  status: 'open' | 'active' | 'resolved';
}

export interface Coven {
  covenId: number;
  members: string[]; // wallet addresses
  escaped: Record<string, boolean>;
  escapedCount: number;
  won: boolean;
}

export interface SessionPlayer {
  sessionId: bigint;
  covenId: number;
  walletAddress: string;
  role: 'P1' | 'P2' | 'P3' | 'P4' | null;
  escaped: boolean;
  escapedAt: string | null;
  sanity: number;
}

// ─── Ward (Room) Config ────────────────────────────────────────────

export interface WardConfig {
  puzzles: PuzzleConfig[];
  coopTasks: CoopTaskConfig[];
  objects: WardObject[];
  ghostPaths: GhostPath[];
  scareEvents: ScareEvent[];
  blackoutEvents: BlackoutEvent[];
  flickerSeed: number;
}

export type HorrorObjectType =
  | 'bloodstained_cabinet'
  | 'patient_file'
  | 'shattered_mirror'
  | 'rusted_surgical_tray'
  | 'old_radio'
  | 'medicine_bottle'
  | 'rocking_chair'
  | 'wheelchair'
  | 'broken_bed'
  | 'padded_wall'
  | 'electroshock_machine'
  | 'straitjacket';

export interface WardObject {
  id: string;
  type: HorrorObjectType;
  x: number;
  y: number;
  hasClue: boolean;
  isScary: boolean;
  scareType?: ScareType;
  flavorText?: string;
  investigated: boolean;
  /** If set, interacting opens this puzzle's modal */
  puzzleId?: PuzzleId;
  /** If set, investigating this object reveals a hint for the given puzzle */
  hintForPuzzle?: PuzzleId;
  /** The hint text shown when this object is investigated (for puzzle hints) */
  hintText?: string;
}

// ─── Puzzles ───────────────────────────────────────────────────────

export type PuzzleId = 'P1' | 'P2' | 'P3' | 'P4' | 'P5' | 'P6';

export type PuzzleName =
  | 'BloodCipher'
  | 'PatientNumbers'
  | 'EVPRecording'
  | 'BinaryLocks'
  | 'RitualSequence'
  | 'PatientAnagram';

export interface PuzzleConfig {
  id: PuzzleId;
  name: PuzzleName;
  /** Display title for the puzzle modal */
  title: string;
  /** Description/instructions shown in the puzzle modal */
  description: string;
  /** The correct answer (case-insensitive) */
  answer: string;
  /** Extra puzzle-specific params (e.g. cipher shift, color sequence) */
  params: Record<string, unknown>;
  solved: boolean;
}

/** Runtime state for the active puzzle modal */
export interface PuzzleState {
  puzzleId: PuzzleId;
  config: PuzzleConfig;
  playerInput: string;
  attempts: number;
  feedback: string;
  feedbackColor: string;
}

// ─── Co-op Tasks ───────────────────────────────────────────────────

export type CoopTaskType =
  | 'whisper_code'
  | 'seance_circle'
  | 'possessed_relay'
  | 'blood_ritual_levers';

export interface CoopTaskConfig {
  type: CoopTaskType;
  params: Record<string, unknown>;
  resolved: boolean;
}

export interface TaskStateRow {
  id: string;
  sessionId: bigint;
  covenId: number;
  taskType: CoopTaskType;
  playerAddr: string;
  action: 'triggered' | 'completed' | 'failed' | 'puzzle_solved';
  payload: Record<string, unknown>;
  createdAt: string; // ISO timestamp — server authoritative
}

// ─── Sanity ────────────────────────────────────────────────────────

export type SanityEventType =
  | 'red_herring'
  | 'ghost_contact'
  | 'jump_scare'
  | 'puzzle_fail'
  | 'puzzle_solve'
  | 'regen'
  | 'blackout_reset';

export interface SanityState {
  current: number; // 0–100
  threshold: SanityThreshold;
  isBlackedOut: boolean;
  effects: SanityEffect[];
}

export type SanityThreshold = 'normal' | 'uneasy' | 'disturbed' | 'paranoid' | 'broken';

export interface SanityEffect {
  type: 'vignette' | 'grain' | 'chromatic_aberration' | 'hallucination' | 'whispers';
  intensity: number; // 0–1
}

export interface SanityConfig {
  drainRates: Record<SanityEventType, number>;
  regenPerSec: number;
  puzzleSolveBonus: number;
  thresholds: { uneasy: number; disturbed: number; paranoid: number; broken: number };
  blackoutDurationMs: number;
  blackoutResetTo: number;
}

export const DEFAULT_SANITY_CONFIG: SanityConfig = {
  drainRates: {
    red_herring: -5,
    ghost_contact: -10,
    jump_scare: -8,
    puzzle_fail: -3,
    puzzle_solve: 15,
    regen: 1,
    blackout_reset: 0,
  },
  regenPerSec: 1,
  puzzleSolveBonus: 15,
  thresholds: { uneasy: 75, disturbed: 50, paranoid: 25, broken: 0 },
  blackoutDurationMs: 5000,
  blackoutResetTo: 30,
};

// ─── Ghost NPCs ────────────────────────────────────────────────────

export interface GhostPath {
  id: string;
  waypoints: Position[];
  speed: number; // px/sec
  pauseDurationMs: number;
  flickerPattern: number[]; // opacity values over time
}

export interface GhostNPC {
  id: string;
  path: GhostPath;
  currentWaypoint: number;
  position: Position;
  visible: boolean;
  opacity: number;
}

// ─── Jump Scares ───────────────────────────────────────────────────

export type ScareType = 'face_flash' | 'hand_reach' | 'mirror_distortion';

export interface ScareEvent {
  objectId: string;
  scareType: ScareType;
  triggered: boolean;
  durationMs: number;
}

// ─── Lighting & Atmosphere ─────────────────────────────────────────

export interface FlashlightConfig {
  brightRadius: number; // 128px
  dimRadius: number; // 192px
  color: number; // hex
  brightIntensity: number;
  dimIntensity: number;
}

export interface BlackoutEvent {
  startTimeSec: number;
  durationSec: number;
}

export type FlickerType = 'subtle' | 'heavy' | 'strobe' | 'dying';

export interface FlickerPattern {
  type: FlickerType;
  intervals: number[]; // ms between flicker states
  intensities: number[]; // brightness multipliers
}

// ─── Multiplayer ───────────────────────────────────────────────────

export interface Position {
  x: number;
  y: number;
}

export interface RemotePlayer {
  walletAddress: string;
  covenId: number;
  position: Position;
  lastUpdate: number;
  isRival: boolean; // true = red phantom, false = blue phantom
  sanity: number;
}

export interface ChatMessage {
  sender: string; // truncated wallet
  text: string;
  timestamp: number;
}

export interface PositionBroadcast {
  playerId: string;
  x: number;
  y: number;
}

// ─── Scene Data ────────────────────────────────────────────────────

export interface GameSceneData {
  sessionId: bigint;
  seed: string;
  playerWallet: string;
  covenId: number;
  isCoOp: boolean;
  wardConfig: WardConfig;
  players: SessionPlayer[];
}

export interface ResultSceneData {
  outcome: 'win' | 'loss' | 'timeout';
  sessionId: bigint;
  isCoOp: boolean;
  netPayout?: bigint;
  escapedPlayers?: string[];
}

// ─── Horror Flavor Text ────────────────────────────────────────────

export const HORROR_FLAVOR_TEXTS: string[] = [
  "A patient's journal. The last entry just says 'IT SEES ME' over and over.",
  "A rusted surgical tray. The tools are arranged in a pattern. A message?",
  "A shattered mirror. For a moment, your reflection didn't move when you did.",
  "A child's music box. It starts playing on its own. Then stops.",
  "A photograph of the asylum staff. Everyone is smiling except the one looking at the camera.",
  "A door that opens to a brick wall. Someone scratched 'WRONG WAY' into the mortar.",
  "A rocking chair. It's still moving.",
  "A straitjacket on the floor. It's warm.",
  "A pile of patient wristbands. One of them has your name on it.",
  "A phone on the wall. You pick it up. Someone is breathing on the other end.",
  "Scratches on the inside of a padded cell door. They form a face.",
  "A bottle of pills. The label reads: 'FOR FORGETTING'.",
];
