# PH0xBIA — Haunted Escape Room Product Design Document

> Version 2.0 | Monad Hackathon 2026
> Stack: Phaser.js · Supabase · Solidity (Monad EVM) · Next.js · wagmi
> Theme: **Psychological Horror** — abandoned asylum, flickering lights, whispered clues, sanity mechanics

---

## Changelog (v1.1 → v2.0 — Horror Overhaul)
- **Full horror re-skin** — generic escape room replaced with abandoned asylum setting ("Ashworth Asylum")
- **Sanity mechanic** — investigating red herrings drains sanity; at 0%, screen distorts, hallucination sprites appear
- **Horror atmosphere** — fog-of-war, dynamic lighting (flickering), ambient audio (whispers, distant screams, static)
- **Jump-scare system** — rare, seed-determined scare events triggered on certain object interactions
- **Puzzle re-theme** — all 6 puzzles now wrapped in horror narrative (blood-written ciphers, patient records, EVP morse, etc.)
- **Co-op task re-theme** — séance circles, blood ritual levers, possessed relay, whisper codes
- **Ghost NPC system** — wandering ghost NPCs that obstruct paths and trigger sanity drain on contact
- **Visual overhaul** — dark palette, vignette overlay, particle effects (dust, flies, embers), screen-shake on scares

---

## 1. Product Vision

**PH0xBIA** is a fully on-chain, horror-themed multiplayer escape room set in the cursed **Ashworth Asylum** — an abandoned psychiatric facility on the Monad blockchain. Players stake MON tokens to enter, then navigate procedurally generated wards filled with disturbing patient records, blood-scrawled puzzles, and restless spirits. Every run is seed-driven and different. The asylum fights back — a **sanity system** punishes careless exploration with hallucinations and screen distortion. Solo mode is a race through terror — first player out wins everyone else's stake. Co-op mode pits groups against groups in a frantic race to complete occult rituals and escape before the asylum claims them. Zero external funds required.

**Tagline:** *"Stake your tokens. Lose your mind. Escape the asylum... or feed it."*

---

## 2. Game Modes

### 2.1 Solo Mode — Race to Escape the Asylum

- N players (2–8) each independently stake MON to enter the same asylum ward
- Seed is generated on-chain: `keccak256(abi.encodePacked(roomId, block.prevrandao))`
- Ward layout, clue positions, ghost NPC patrol paths, and 3 puzzles are seed-determined — identical for all players, different every run
- First player to solve all 3 puzzles, reach the **asylum gate**, and call `markEscaped()` with a valid backend proof escapes alive
- Winner receives the full pot minus 2.5% protocol fee
- All other players' stakes are consumed by the asylum (slashed to the pot)
- **Horror twist:** Players can see ghost-tinted outlines of other players (rival phantoms) — adds psychological pressure

**Example — 4 players × 0.05 MON:**
| Outcome | Amount |
|---------|--------|
| Total pot | 0.200 MON |
| Protocol fee (2.5%) | 0.005 MON |
| Winner receives | 0.195 MON |
| Winner profit | +0.145 MON |
| Losers receive | 0 MON |

### 2.2 Co-op Mode — Séance Groups vs Groups

- Host creates a **séance session** and sets a stake per player
- Multiple groups (2–4 covens, each 2–4 players) register and pay stake
- All covens receive the **same shared seed** → same ward layout, same puzzles, same occult tasks
- Each coven plays simultaneously and independently — they race each other
- The first coven where **all members** call `markEscaped()` with valid proofs breaks the curse and wins
- Winners split the entire pot equally among coven members, minus 2.5% protocol fee
- All other covens forfeit their stakes — *"the asylum keeps its due"*

**Example — 2 covens × 3 players × 0.05 MON:**
| Outcome | Amount |
|---------|--------|
| Total pot | 0.300 MON |
| Protocol fee (2.5%) | 0.0075 MON |
| Winning coven receives | 0.2925 MON |
| Per winner | 0.0975 MON |
| Winner profit per player | +0.0475 MON |
| Losing coven receives | 0 MON |

**Why this works:** The pot is always fully funded by the players' own stakes. The asylum is self-sustaining.

---

## 3. Horror Atmosphere System

### 3.1 Sanity Mechanic
- Each player starts with **100% sanity**
- **Sanity drains** on: investigating red herring objects (-5%), contact with ghost NPCs (-10%), failed puzzle attempts (-3%), witnessing jump-scares (-8%)
- **Sanity effects at thresholds:**

| Sanity | Effect |
|--------|--------|
| 75% | Subtle screen vignette darkens; faint whispers in audio |
| 50% | Screen grain/static overlay; hallucination sprites appear at edges |
| 25% | Heavy screen distortion (chromatic aberration); phantom objects appear (fake clues) |
| 0% | Full blackout for 5 seconds + teleport to random room position; sanity resets to 30% |

- Sanity **recovers** slowly over time (+1%/sec while standing still) and on successful puzzle solve (+15%)

### 3.2 Dynamic Lighting & Fog-of-War
- Player has a limited **flashlight radius** (128px circle of bright light, 192px dim light)
- Room is otherwise pitch black — objects outside light radius rendered as dark silhouettes
- **Flickering effect** — lights randomly dim/brighten (seed-determined pattern, tied to ward's "power grid")
- Periodic **blackout events** (3–5 seconds, seed-determined timing) — complete darkness, only player sprite glows faintly
- Fog-of-war reveals room layout as explored — unexplored areas stay black on the minimap

### 3.3 Audio Atmosphere
- **Ambient layers** (looping): deep drone, distant water dripping, metallic creaking, patient moaning
- **Proximity audio**: whispers intensify near clue objects; heartbeat accelerates at low sanity
- **Stinger sounds**: sharp violin hits on jump-scares, door slam effects, glass breaking
- **Co-op only**: distorted radio static when teammates are far away; clear when close

### 3.4 Ghost NPC System
- 2–3 **wandering ghost NPCs** per ward (patrol paths seed-determined)
- Ghosts move through walls, flicker in/out of visibility
- **Contact penalty**: -10% sanity + 2-second movement slow
- Ghosts can be **avoided** — they have visible patrol patterns with brief pauses
- Ghost appearance: translucent, pale, asylum patient gowns, distorted faces

### 3.5 Jump-Scare System
- **Rare, seed-determined** — max 3 per session, triggered on specific object interactions
- Types: sudden face flash (200ms overlay), hand reaching from object, mirror reflection distortion
- Always paired with a stinger sound + screen shake
- Tied to sanity drain (-8% per scare)
- Never repeated for the same player in the same session

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                     Next.js Frontend                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Lobby UI   │  │  Phaser.js   │  │  Puzzle UI  │  │
│  │  "Asylum    │  │  Game Scene  │  │  Horror     │  │
│  │   Lobby"    │  │  + Lighting  │  │  Overlays   │  │
│  │  wagmi/viem │  │  + Fog/War   │  │  + Sanity   │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │
└─────────┼────────────────┼──────────────────┼─────────┘
          │                │                  │
    ┌─────▼──────┐  ┌──────▼───────┐  ┌───────▼──────┐
    │  Monad EVM │  │  Supabase    │  │  Supabase    │
    │  Contract  │  │  Realtime    │  │  Postgres    │
    │  (Stake +  │  │  (Positions  │  │  (task_state │
    │  Seed +    │  │  + Presence  │  │  + rooms     │
    │  Covens)   │  │  + Chat      │  │  + covens    │
    │            │  │  + Sanity)   │  │  + sanity)   │
    └────────────┘  └──────────────┘  └──────────────┘
          │
    ┌─────▼──────┐
    │  Backend   │
    │  Signer    │
    │  "The      │
    │   Warden"  │
    └────────────┘
```

**Backend Signer ("The Warden")** is a lightweight Node.js service (or Vercel edge function) that:
1. Receives escape request from client
2. Verifies all puzzles solved in Supabase (`task_state` rows)
3. Signs `keccak256(roomId + playerAddr + "ESCAPED")` with a trusted private key
4. Returns signature — client submits this to `markEscaped()` on-chain

---

## 5. Procedural Generation System

### Seed Formula
```solidity
bytes32 seed = keccak256(abi.encodePacked(roomId, block.prevrandao));
// Note: block.prevrandao is influenceable by validators — acceptable for hackathon.
// Production: use Chainlink VRF or commit-reveal.
```

### What the Seed Controls
| Parameter | How Derived |
|-----------|-------------|
| Which 3 puzzles from pool of 6 | `seededPick(seed, 0, puzzlePool)` |
| Which 2 co-op tasks from pool of 4 | `seededPick(seed, 1, coopPool)` |
| Object positions (x, y) | `seededFloat(seed, i) * roomWidth` |
| Clue hidden in which object | `seededInt(seed, n) % objectCount` |
| ROT cipher shift value (7, 13, 19) | `seededPick(seed, 2, [7,13,19])` |
| Anagram word | `seededPick(seed, 3, asylumWordList)` |
| Blood-stain colour sequence | `seededShuffle(seed, 4, bloodColourList)` |
| Ghost NPC patrol paths | `seededPath(seed, 5, waypointGrid)` |
| Jump-scare trigger objects | `seededPick(seed, 6, scarePool, 3)` |
| Blackout event timings | `seededIntervals(seed, 7, [60, 180])` |
| Flickering light patterns | `seededPattern(seed, 8, flickerTypes)` |

### PRNG Implementation
```js
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
}
// Usage: const rand = mulberry32(Number(BigInt(onChainSeed) & 0xFFFFFFFFn));
```

---

## 6. Free-Roam Engine (Phaser.js)

### Scene Structure
```
BootScene → PreloadScene → IntroScene (asylum cutscene) → GameScene → ResultScene
```
- **IntroScene**: 5-second atmospheric intro — camera pans through dark asylum hallway, text overlay: *"Ashworth Asylum — Condemned 1987. No survivors."*
- Lobby, wallet connection, and room/session creation are handled entirely in React/Next.js
- The Phaser canvas is mounted by React once the game session starts and the seed is loaded

### GameScene Subsystems
- **TilemapManager** — loads asylum ward tileset (cracked tiles, blood stains, broken furniture), places walls and floor from seed-determined layout
- **LightingManager** — manages flashlight radius, flickering effects, blackout events, and dynamic shadows
- **FogOfWarManager** — tracks explored regions, renders unexplored areas as pitch black
- **SanityManager** — tracks sanity %, applies visual effects (vignette, grain, chromatic aberration, hallucination sprites)
- **PlayerManager** — local player (WASD + click-to-walk), remote players rendered as ghost-tinted phantoms synced via Supabase at 10fps with delta compression
- **GhostNPCManager** — spawns and patrols ghost NPCs along seed-determined paths; collision detection for sanity drain
- **HotspotManager** — interactive zones (press `E` or click within 32px), 3 outcomes per object + jump-scare chance
- **PuzzleManager** — modal overlays for each of the 6 horror-themed puzzle types
- **CoopTaskManager** — state machine for each active occult co-op task
- **HUDManager** — timer countdown, clue inventory (styled as "patient file"), teammate status, sanity bar, in-game chat (co-op only)
- **AudioManager** — ambient layers, proximity audio, stinger sounds, heartbeat at low sanity
- **ParticleManager** — dust motes, floating embers, flies near corpse objects, dripping water

### Object Interaction Flow
```
Player walks near object (flashlight illuminates it)
  → HotspotManager fires 'investigate' event
    → Jump-scare check? → trigger scare overlay + stinger + sanity drain (-8%)
    → Object has clue? → add to "patient file" inventory → update HUD → sanity boost
    → Red herring?     → display seeded horror flavor text + sanity drain (-5%)
                         ("A child's drawing... of something with too many limbs.")
    → Empty?           → "Dust and silence."
  → 3 real clues collected → PuzzleManager unlocks first puzzle
  → All 3 puzzles solved → asylum gate appears (iron gate rising from floor) → call backendSigner
    → Valid sig received → submit markEscaped(roomId, sig) on-chain
```

### Horror Flavor Text Examples (Red Herrings)
- *"A patient's journal. The last entry just says 'IT SEES ME' over and over."*
- *"A rusted surgical tray. The tools are arranged in a pattern. A message?"*
- *"A shattered mirror. For a moment, your reflection didn't move when you did."*
- *"A child's music box. It starts playing on its own. Then stops."*
- *"A photograph of the asylum staff. Everyone is smiling except the one looking at the camera."*
- *"A door that opens to a brick wall. Someone scratched 'WRONG WAY' into the mortar."*
- *"A rocking chair. It's still moving."*

### Position Sync (updated)
- Broadcast at **10fps** (down from 20fps)
- Only broadcast if player moved **> 4px** since last frame (delta compression)
- On reconnect, load last position from `player_positions` table in Postgres

---

## 7. Puzzle Pool — Horror Re-Themed (6 Total, 3 Drawn Per Run)

| ID | Name | Horror Wrapper | Seed-Variable | Input Type |
|----|------|----------------|---------------|------------|
| P1 | Blood Cipher | ROT cipher written in blood on asylum wall | Shift: 7, 13, or 19 | Text input |
| P2 | Patient Numbers | Roman numerals carved into patient cell doors | Number set seeded | Number input |
| P3 | EVP Recording | Morse code hidden in static-filled audio recording (Electronic Voice Phenomenon) | Sequence seeded | Text input |
| P4 | Binary Locks | Binary code on electronic cell door locks (blinking red/green LEDs) | 4 values seeded | Number input |
| P5 | Ritual Sequence | Candles that must be lit in correct colour order (blood red, ghost white, poison green, etc.) | Sequence shuffled by seed | Click sequence |
| P6 | Patient Anagram | Unscramble the name of a former patient / asylum term from scrambled letters on a file | Word from curated horror list | Text input |

### Horror Puzzle UI Details
- All puzzle modals have **dark, grimy aesthetic** — torn paper textures, blood smears, rusty metal frames
- Puzzle background shows the asylum ward dimly behind a translucent overlay
- Wrong answers trigger: screen flash red, distorted error sound, subtle screen shake
- Correct answers trigger: satisfying lock-click sound, green glow, *"The asylum releases its grip... for now."*
- 3 failed attempts → 30-second lockout with text: *"The walls are watching. Try again in 30 seconds."*

---

## 8. Co-op Task Pool — Occult Re-Themed (4 Total, 2 Drawn Per Run)

### T1 — Whisper Code (was Split Code)
- Player A finds half of a **patient admission number** scrawled on a wall in Ward A
- Player B finds the other half on a bloodstained clipboard in Ward B
- Neither can see the other's digits — must communicate via **in-game séance chat** (Supabase Broadcast)
- Both enter full 6-digit code into a shared **electroshock terminal** to unlock
- *UI flavor: "The intercom crackles... share what you see before the static takes it."*

### T2 — Séance Circle (was Pressure Plates)
- 3 **ritual circles** on the floor (drawn in chalk/blood, positions seeded)
- All 3 must be occupied simultaneously within a **5-second window**
- Timestamps recorded server-side via Supabase `created_at`
- Visual feedback: circles glow eerie green when activated; room trembles when all 3 held
- *"The spirits demand three souls standing in the circle. Together. Now."*

### T3 — Possessed Relay (was Relay Chain)
- Object A: a **cursed patient wristband** locked in a glass case — only Player 1 can break it (role assigned by seed)
- Player 1 breaks case → picks up wristband → approaches Player 2 (proximity transfer, 48px)
- The wristband **drains sanity while held** (-2%/sec) — urgency to transfer quickly
- Player 2 receives wristband → uses it to unlock Object B → finds final clue
- *"The wristband burns in your hand. Pass it before it takes you."*

### T4 — Blood Ritual Levers (was Synchronized Levers)
- Two **rusted levers** on opposite walls, mounted in ceremonial alcoves (positions seeded)
- Each player pulls independently
- Both pulls must occur within a **5-second window**, measured by server `created_at`
- 3 failed attempts → 30-second lockout with text: *"The ritual rejects you. The asylum grows stronger."*
- Successful pull: walls bleed momentarily, a hidden passage opens
- *"Pull together. The asylum obeys only those who act as one."*

---

## 9. Smart Contract Design

### Contract: `PH0xBIA.sol` (was `MonadEscapeRoom.sol`)

```solidity
struct Coven {    // was "Group"
    address[]            members;
    mapping(address => bool) escaped;
    uint8                escapedCount;
    bool                 won;
}

struct Session {
    address   host;       // "The Summoner"
    uint256   stakePerPlayer;
    bytes32   seed;       // "The Curse Seed"
    bool      isCoOp;
    uint8     maxCovens;           // co-op: 2–4 covens
    uint8     maxPlayersPerCoven;
    uint256   startTime;
    uint256   timeLimit;
    bool      resolved;
    address   winner;              // solo: surviving player
    uint8     winnerCovenId;       // co-op: surviving coven
    uint8     covenCount;
    mapping(uint8 => Coven) covens;
    mapping(address => uint8) playerCoven;
}

// Protocol fee — 2.5% ("The Asylum's Tithe")
uint256 public constant PROTOCOL_FEE_BPS = 250;
uint256 public constant BPS = 10_000;
address public treasury;       // "The Asylum Vault"
address public trustedSigner;  // "The Warden" — backend escape proof signer
```

### Core Functions

```solidity
// HOST ("The Summoner"): Create session, host joins coven 0 automatically
function createSession(
    uint256 sessionId,
    uint256 stakePerPlayer,
    bool    isCoOp,
    uint8   maxCovens,
    uint8   maxPlayersPerCoven,
    uint256 timeLimitSec
) external payable;

// PLAYER: Join a session into a specific coven slot, pays stake ("blood offering")
function joinSession(uint256 sessionId, uint8 covenId) external payable;

// HOST: Lock stakes, generate curse seed, start the clock
function startSession(uint256 sessionId) external;
// seed = keccak256(abi.encodePacked(sessionId, block.prevrandao))

// PLAYER: Submit signed escape proof from The Warden
function markEscaped(uint256 sessionId, bytes calldata wardenSig) external;
// Verifies: ECDSA.recover(keccak256(sessionId, msg.sender, "ESCAPED"), sig) == trustedSigner
// Solo: if first to escape → sets winner, marks resolved
// Co-op: increments coven.escapedCount; if == covenSize and !session.resolved → sets winnerCoven

// WINNER: Pull payout after session resolved ("Claim your soul back")
function claimReward(uint256 sessionId) external nonReentrant;

// SAFETY: After timeLimit with no winner, the asylum claims its tithe but releases the rest
function expireSession(uint256 sessionId) external;

// SAFETY: Emergency drain, owner only, 24h timelock
function emergencyWithdraw(uint256 sessionId) external onlyOwner;
```

### Payout Formula

```
pot         = stakePerPlayer × totalPlayersAcrossAllCovens
fee         = pot × 2.5%  →  treasury ("The Asylum's Tithe")
net         = pot − fee

Solo winner payout   = net
Co-op winner/player  = net ÷ winningCovenSize
```

### Events
```solidity
event SessionCreated (uint256 sessionId, bytes32 curseSeed, bool isCoOp, uint8 maxCovens);
event PlayerJoined   (uint256 sessionId, address player, uint8 covenId);
event SessionStarted (uint256 sessionId, uint256 startTime);
event PlayerEscaped  (uint256 sessionId, address player, uint8 covenId);
event SessionResolved(uint256 sessionId, bool isCoOp, uint8 winnerCovenId, uint256 netPayout);
event RewardClaimed  (uint256 sessionId, address player, uint256 amount);
event AsylumClaimed  (uint256 sessionId, uint256 feeAmount); // protocol fee event
```

---

## 10. Supabase Schema

```sql
-- Sessions (mirrors on-chain session — "Asylum Wards")
create table sessions (
  session_id   bigint primary key,
  seed         text not null,
  is_coop      boolean default false,
  max_covens   int not null default 1,
  status       text not null default 'open', -- open | active | resolved
  created_at   timestamptz default now()
);

-- Covens within a session (co-op)
create table session_covens (
  id           uuid primary key default gen_random_uuid(),
  session_id   bigint references sessions(session_id) on delete cascade,
  coven_id     int not null,   -- 0, 1, 2, 3
  unique(session_id, coven_id)
);

-- Players (solo: all in coven_id 0; co-op: assigned covens)
create table session_players (
  id             uuid primary key default gen_random_uuid(),
  session_id     bigint references sessions(session_id) on delete cascade,
  coven_id       int not null default 0,
  wallet_address text not null,
  role           text,          -- 'P1','P2','P3' for co-op role assignment
  escaped        boolean not null default false,
  escaped_at     timestamptz,
  sanity         int not null default 100,   -- current sanity %
  unique(session_id, wallet_address)
);

-- Co-op task state
create table task_state (
  id           uuid primary key default gen_random_uuid(),
  session_id   bigint references sessions(session_id) on delete cascade,
  coven_id     int not null,
  task_type    text not null,  -- 'whisper_code' | 'seance_circle' | 'possessed_relay' | 'blood_ritual_levers'
  player_addr  text not null,
  action       text not null,  -- 'triggered' | 'completed' | 'failed'
  payload      jsonb,          -- e.g. {lever: 'left'} or {circle: 2}
  created_at   timestamptz default now()  -- SERVER time — used for sync window checks
);

-- Player positions (for reconnect recovery)
create table player_positions (
  session_id     bigint references sessions(session_id) on delete cascade,
  wallet_address text not null,
  x              float not null default 400,
  y              float not null default 300,
  updated_at     timestamptz default now(),
  primary key (session_id, wallet_address)
);

-- Sanity events log (for analytics and anti-cheat)
create table sanity_events (
  id             uuid primary key default gen_random_uuid(),
  session_id     bigint references sessions(session_id) on delete cascade,
  wallet_address text not null,
  event_type     text not null,  -- 'red_herring' | 'ghost_contact' | 'jump_scare' | 'puzzle_fail' | 'puzzle_solve' | 'regen'
  sanity_delta   int not null,
  sanity_after   int not null,
  created_at     timestamptz default now()
);
```

### Realtime Channels
- **Presence** `session:{sessionId}` — tracks online/offline per session, drives phantom sprites
- **Broadcast** `positions:{sessionId}` — emits `{playerId, x, y}` at 10fps (delta only, >4px moved)
- **Broadcast** `chat:{sessionId}` — in-game séance chat for co-op (required for T1 Whisper Code)
- **Broadcast** `sanity:{sessionId}` — broadcasts sanity changes (for co-op teammate sanity display)
- **Postgres Changes** on `task_state` — triggers co-op task resolution logic
- **Postgres Changes** on `session_players` — triggers escape progress UI for all players

---

## 11. Backend Signer Service ("The Warden")

A lightweight Vercel Edge Function (or Express route):

```typescript
// POST /api/sign-escape
// Body: { sessionId, playerAddr, puzzlesSolvedCount }
// Returns: { signature } or { error: "The Warden denies your release." }

export async function POST(req: Request) {
  const { sessionId, playerAddr } = await req.json()

  // 1. Verify all 3 puzzles solved in Supabase
  const { count } = await supabase
    .from('task_state')
    .select('*', { count: 'exact' })
    .eq('session_id', sessionId)
    .eq('player_addr', playerAddr)
    .eq('action', 'puzzle_solved')
  
  if (count < 3) return Response.json({ error: 'The Warden denies your release. Puzzles remain.' }, { status: 403 })

  // 2. Sign the escape message
  const message = ethers.solidityPackedKeccak256(
    ['uint256', 'address', 'string'],
    [sessionId, playerAddr, 'ESCAPED']
  )
  const sig = await signer.signMessage(ethers.getBytes(message))
  
  return Response.json({ signature: sig })
}
```

---

## 12. UI/UX Flow — Horror Experience

```
Landing Page — "ASHWORTH ASYLUM" (dark, atmospheric, fog animation)
  → Connect Wallet (wagmi + RainbowKit — custom dark horror theme)
    ↓
  SOLO: Enter blood offering (stake) → Create/Join ward → Wait for patients → Host starts
  CO-OP: Create séance session (set stake, coven count) → Share cursed link
          → Covens fill up → Host starts
    ↓
  IntroScene: Camera pans dark hallway, text: "No one has escaped Ashworth. Until now."
    ↓
  Curse seed loaded from SessionStarted event → generateWard(seed)
    ↓
  Phaser GameScene mounted — horror atmosphere activates
    → Free roam (flashlight, fog-of-war, ghost NPCs)
    → Investigate objects (jump-scare chance, sanity drain on red herrings)
    → Collect 3 patient file clues
    → Puzzle modals unlock (horror-themed UI)
    → Solve all 3 → Sanity boost
    → Request escape sig from The Warden → Submit markEscaped() on-chain
    ↓
  SOLO WIN:  "YOU SURVIVED" screen (relief, lights brighten) → claimReward() → receive net pot
  COOP WIN:  all coven members must escape → "THE COVEN BREAKS FREE" → claimReward()
  LOSS:      "THE ASYLUM CLAIMS YOU" → stake slashed → eerie loss screen (whispers fade)
  TIMEOUT:   "TIME'S UP. THE ASYLUM GROWS STRONGER." → expireSession() → partial refund
```

### Landing Page Design
- Full-screen dark background with animated fog/mist
- Asylum silhouette in background with occasional lightning flashes
- Title "PH0xBIA" in glitchy, distorted font with subtle animation
- Subtitle: *"Ashworth Asylum — Est. 1952 — Condemned 1987"*
- "Connect Wallet" button styled as rusted metal plate
- Ambient audio: distant thunder, wind, chains rattling (muted by default, toggle on)

### HUD Design (In-Game)
- **Sanity Bar**: red gradient, pulses at low sanity, skull icon — top-left
- **Timer**: countdown styled as old clock face — top-center
- **Patient File**: clue inventory styled as manila folder with blood fingerprint — top-right
- **Coven Status** (co-op): teammate portraits with sanity indicators — bottom-left
- **Chat Toggle** (co-op): old radio icon, static animation — bottom-right
- **Minimap**: small, dark, fog-of-war overlay, ghost blips shown as red dots

---

## 13. Art Direction & Asset Requirements

### Colour Palette
- **Primary**: Deep charcoal (#1a1a2e), midnight blue (#16213e)
- **Accent**: Blood red (#8b0000), sickly green (#2d6a4f), bone white (#f5f0e1)
- **UI**: Rust orange (#b8572a), tarnished gold (#bfa14a)
- **Effects**: Ghost blue glow (#4a90d9, 30% opacity), haunt purple (#6c3483, 20% opacity)

### Tileset Requirements
- Asylum ward tiles: cracked concrete floor, padded cell walls, rusted metal doors
- Furniture: overturned beds, broken chairs, shattered mirrors, filing cabinets
- Atmospheric: blood stains (decals), claw marks, abandoned wheelchairs
- Interactive: locked cabinets, old terminals, patient files, medicine bottles, ritual circles

### Character Sprites
- **Player**: asylum visitor with flashlight (4-direction walk animation)
- **Ghost NPCs**: translucent patient sprites, flickering, distorted walk cycle
- **Remote Players (solo)**: red-tinted phantom outlines (rival phantoms)
- **Remote Players (co-op, same coven)**: blue-tinted phantom outlines
- **Remote Players (co-op, rival coven)**: red-tinted phantom outlines

---

## 14. Agent-Executable Components

The following modules can be fully scaffolded by an AI coding agent with no manual intervention:

- `lib/prng.ts` — mulberry32 seeded PRNG
- `lib/puzzles/*.ts` — all 6 horror-themed puzzle logic + answer validators
- `lib/roomGenerator.ts` — full procedural asylum ward from seed (includes ghost paths, scare triggers)
- `lib/sanity.ts` — sanity state machine with threshold effects
- `lib/lighting.ts` — flashlight, flickering, and blackout event logic
- `contracts/PH0xBIA.sol` — full contract with session/coven/payout logic
- `contracts/deploy.ts` — Hardhat deploy script
- `hooks/useEscapeRoom.ts` — all wagmi hooks (updated for session/coven model)
- `supabase/schema.sql` — full schema with new tables (including sanity_events)
- `supabase/rls.sql` — RLS policies (players write own rows only)
- `lib/supabase/channels.ts` — presence, broadcast positions, broadcast chat, broadcast sanity, task_state listener
- `api/sign-escape.ts` — backend signer edge function ("The Warden")
- `scenes/IntroScene.ts` — atmospheric asylum intro cutscene
- `scenes/GameScene.ts` — Phaser scene scaffold with all horror subsystems (lighting, fog, sanity, ghosts)
- `components/puzzles/*.tsx` — all 6 horror-themed puzzle UI components
- `components/CoopTaskOverlay.tsx` — all 4 occult task overlays with teammate status
- `components/HUD.tsx` — timer, patient file inventory, sanity bar, coven progress, chat toggle
- `components/SanityEffects.tsx` — vignette, grain, chromatic aberration, hallucination overlays
- `components/JumpScare.tsx` — scare overlay with stinger audio
- `components/ChatWidget.tsx` — séance chat (co-op only, styled as old radio)
- `types/game.ts` — all TypeScript types
- `scripts/setup-env.sh` — dev environment bootstrap
