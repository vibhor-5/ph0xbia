// ─── PH0xBIA — Shared Game Types ───

// ---------- On-chain / Session ----------

export type Address = `0x${string}`;

export interface Session {
  id: number;
  creator: Address;
  stake: bigint;
  maxPlayers: number;
  isCoOp: boolean;
  curseSeed: bigint;          // 0 until startSession()
  startedAt: number;          // unix seconds
  duration: number;           // seconds
  state: SessionState;
  escapedPlayers: Address[];
}

export enum SessionState {
  WAITING   = 0,
  ACTIVE    = 1,
  COMPLETED = 2,
  EXPIRED   = 3,
}

export interface Coven {
  id: number;
  sessionId: number;
  members: Address[];
  name: string;
  color: CovenColor;
}

export type CovenColor = 'crimson' | 'phantom' | 'shadow' | 'emerald';

// ---------- Ward / Room Generation ----------

export interface WardConfig {
  seed: string;               // hex string from curseSeed
  isCoOp: boolean;
  puzzles: PuzzleConfig[];
  tasks: CoOpTask[];
  horrorObjects: HorrorObject[];
  ghostPaths: GhostPath[];
  scareEvents: ScareEvent[];
  blackouts: BlackoutEvent[];
}

export type PuzzleType =
  | 'blood-cipher'
  | 'patient-numbers'
  | 'evp-recording'
  | 'binary-locks'
  | 'ritual-sequence'
  | 'patient-anagram';

export interface PuzzleConfig {
  id: string;
  type: PuzzleType;
  difficulty: 1 | 2 | 3;
  roomIndex: number;
  solution: string;           // hashed or encoded
  clues: string[];
  isRedHerring: boolean;
  timeLimit?: number;         // seconds
}

export interface PuzzleSolveResult {
  puzzleId: string;
  correct: boolean;
  attempts: number;
  lockedUntil?: number;       // unix ms — 30s lockout on wrong
}

// ---------- Co-Op Tasks ----------

export type CoOpTaskType =
  | 'whisper-code'
  | 'seance-circle'
  | 'possessed-relay'
  | 'blood-ritual-levers';

export interface CoOpTask {
  id: string;
  type: CoOpTaskType;
  roomIndex: number;
  requiredPlayers: number;
  syncWindowMs: number;       // e.g. 5000
  payload: Record<string, unknown>;
}

// ---------- Horror Objects ----------

export type HorrorObjectType =
  | 'patient-file'
  | 'bloodstain'
  | 'broken-mirror'
  | 'whisper-vent'
  | 'rusted-wheelchair'
  | 'flickering-light'
  | 'scratched-wall'
  | 'old-photograph';

export interface HorrorObject {
  id: string;
  type: HorrorObjectType;
  roomIndex: number;
  x: number;
  y: number;
  interactText: string;
  sanityDrain: number;        // 0–15
}

// ---------- Ghost NPCs ----------

export interface GhostPath {
  id: string;
  waypoints: { x: number; y: number }[];
  speed: number;              // px per second
  phasesThroughWalls: boolean;
  sanityDrainOnContact: number;
  slowDurationMs: number;     // e.g. 2000
}

// ---------- Scare / Blackout Events ----------

export interface ScareEvent {
  id: string;
  triggerRoomIndex: number;
  triggerTimeOffset: number;  // seconds after ward start
  type: 'visual' | 'audio' | 'both';
  asset: string;              // key for preloaded asset
  durationMs: number;
}

export interface BlackoutEvent {
  id: string;
  triggerTimeOffset: number;
  durationMs: number;
  flashlightOnly: boolean;
}

// ---------- Sanity ----------

export interface SanityState {
  current: number;            // 0–100
  max: number;
  drainRate: number;          // per second (ambient)
  thresholdEffects: ThresholdEffect[];
}

export interface ThresholdEffect {
  threshold: number;          // e.g. 75, 50, 25, 0
  effects: SanityEffectType[];
  triggered: boolean;
}

export type SanityEffectType =
  | 'vignette'
  | 'grain'
  | 'chromatic-aberration'
  | 'whispers'
  | 'hallucination'
  | 'screen-shake'
  | 'inverted-controls'
  | 'false-walls'
  | 'game-over';

// ---------- Player / Multiplayer ----------

export interface PlayerState {
  address: Address;
  displayName: string;
  covenId?: number;
  x: number;
  y: number;
  sanity: SanityState;
  solvedPuzzles: string[];    // puzzle IDs
  isEscaped: boolean;
}

export interface RemotePhantom {
  address: Address;
  covenId?: number;
  x: number;
  y: number;
  lastUpdate: number;         // unix ms
  phantomColor: 'blue' | 'red'; // blue = same coven, red = rival
}

// ---------- Chat ----------

export interface ChatMessage {
  id: string;
  sender: Address;
  senderName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

// ---------- HUD ----------

export interface HUDState {
  sanity: number;
  timeRemainingMs: number;
  solvedCount: number;
  requiredCount: number;
  covenMembers: { name: string; sanity: number; alive: boolean }[];
  minimapFog: boolean[][];
}

// ---------- Lobby ----------

export interface LobbySession {
  id: number;
  creator: Address;
  creatorName: string;
  stake: string;              // formatted ether
  maxPlayers: number;
  currentPlayers: number;
  isCoOp: boolean;
  state: SessionState;
}
