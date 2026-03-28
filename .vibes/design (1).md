# Monad Escape Room — Product Design Document

> Version 1.1 | Monad Hackathon 2026
> Stack: Phaser.js · Supabase · Solidity (Monad EVM) · Next.js · wagmi

---

## Changelog (v1.0 → v1.1)
- **Reward model fully redesigned** — co-op payout now funded entirely by competing groups' stakes (no external funds)
- **Co-op session concept added** — multiple groups compete simultaneously; first full group to escape wins the pot from all groups
- **Protocol fee introduced** — 2.5% of every pot on resolve, funds protocol treasury sustainably
- **markEscaped() secured** — backend-signed proof required; removed trivial exploit vector
- **LobbyScene removed from Phaser** — lobby stays in React/Next.js
- **Sync windows extended** — 3s → 5s for T2/T4 co-op tasks; server timestamps used
- **In-game chat added** — required for Split Code (T1) task; Supabase Broadcast channel
- **position_state table added** — reconnect recovery for player positions
- **Position broadcast throttled** — 20fps → 10fps with delta compression (only if moved >4px)

---

## 1. Product Vision

A fully on-chain, seed-driven multiplayer escape room where players stake MON tokens to compete or cooperate. Every run is procedurally different. Solo mode is a race — first player out wins everyone else's stake. Co-op mode pits groups against groups — the first group where all members escape wins the entire session pot from all competing groups. Zero external funds required in either mode.

---

## 2. Game Modes

### 2.1 Solo Mode — Race to Escape

- N players (2–8) each independently stake MON to enter the same room
- Seed is generated on-chain: `keccak256(abi.encodePacked(roomId, block.prevrandao))`
- Room layout, clue positions, and 3 puzzles are seed-determined — identical for all players, different every run
- First player to solve all 3 puzzles, reach the exit, and call `markEscaped()` with a valid backend proof wins
- Winner receives the full pot minus 2.5% protocol fee
- All other players' stakes are slashed to the pot

**Example — 4 players × 0.05 MON:**
| Outcome | Amount |
|---------|--------|
| Total pot | 0.200 MON |
| Protocol fee (2.5%) | 0.005 MON |
| Winner receives | 0.195 MON |
| Winner profit | +0.145 MON |
| Losers receive | 0 MON |

### 2.2 Co-op Mode — Groups vs Groups

- Host creates a **session** and sets a stake per player
- Multiple groups (2–4 groups, each 2–4 players) register into the session and pay stake
- All groups receive the **same shared seed** → same room layout, same puzzles, same co-op tasks
- Each group plays simultaneously and independently — they race each other
- The first group where **all members** call `markEscaped()` with valid proofs wins the session
- Winners split the entire pot (all groups' stakes) equally among group members, minus 2.5% protocol fee
- All other groups forfeit their stakes to the pot

**Example — 2 groups × 3 players × 0.05 MON:**
| Outcome | Amount |
|---------|--------|
| Total pot | 0.300 MON |
| Protocol fee (2.5%) | 0.0075 MON |
| Winning group receives | 0.2925 MON |
| Per winner | 0.0975 MON |
| Winner profit per player | +0.0475 MON |
| Losing group receives | 0 MON |

**Why this works:** The pot is always fully funded by the players' own stakes. No external funds, no protocol subsidy needed. Larger sessions = bigger pots = stronger incentive.

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                     Next.js Frontend                  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  │
│  │  Lobby UI   │  │  Phaser.js   │  │  Puzzle UI  │  │
│  │  wagmi/viem │  │  Game Scene  │  │  Overlays   │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬──────┘  │
└─────────┼────────────────┼──────────────────┼─────────┘
          │                │                  │
    ┌─────▼──────┐  ┌──────▼───────┐  ┌───────▼──────┐
    │  Monad EVM │  │  Supabase    │  │  Supabase    │
    │  Contract  │  │  Realtime    │  │  Postgres    │
    │  (Stake +  │  │  (Positions  │  │  (task_state │
    │  Seed +    │  │  + Presence  │  │  + rooms     │
    │  Groups)   │  │  + Chat)     │  │  + groups)   │
    └────────────┘  └──────────────┘  └──────────────┘
          │
    ┌─────▼──────┐
    │  Backend   │
    │  Signer    │
    │  (escape   │
    │   proofs)  │
    └────────────┘
```

**Backend Signer** is a lightweight Node.js service (or Vercel edge function) that:
1. Receives escape request from client
2. Verifies all puzzles solved in Supabase (`task_state` rows)
3. Signs `keccak256(roomId + playerAddr + "ESCAPED")` with a trusted private key
4. Returns signature — client submits this to `markEscaped()` on-chain

---

## 4. Procedural Generation System

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
| Anagram word | `seededPick(seed, 3, monadWordList)` |
| Colour sequence | `seededShuffle(seed, 4, colourList)` |

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

## 5. Free-Roam Engine (Phaser.js)

### Scene Structure
```
BootScene → PreloadScene → GameScene → ResultScene
```
Lobby, wallet connection, and room/session creation are handled entirely in React/Next.js.
The Phaser canvas is mounted by React once the game session starts and the seed is loaded.

### GameScene Subsystems
- **TilemapManager** — loads room tileset, places walls and floor from seed-determined layout
- **PlayerManager** — local player (WASD + click-to-walk), remote players rendered as ghost sprites synced via Supabase at 10fps with delta compression
- **HotspotManager** — interactive zones (press `E` or click within 32px), 3 outcomes per object
- **PuzzleManager** — modal overlays for each of the 6 puzzle types
- **CoopTaskManager** — state machine for each active co-op task
- **HUDManager** — timer countdown, clue inventory, teammate status, in-game chat (co-op only)

### Object Interaction Flow
```
Player walks near object
  → HotspotManager fires 'investigate' event
    → Object has clue? → add to inventory → update HUD
    → Red herring?     → display seeded flavor text
    → Empty?           → "Nothing here"
  → 3 real clues collected → PuzzleManager unlocks first puzzle
  → All 3 puzzles solved → exit door appears → call backendSigner
    → Valid sig received → submit markEscaped(roomId, sig) on-chain
```

### Position Sync (updated)
- Broadcast at **10fps** (down from 20fps)
- Only broadcast if player moved **> 4px** since last frame (delta compression)
- On reconnect, load last position from `player_positions` table in Postgres

---

## 6. Puzzle Pool (6 Total, 3 Drawn Per Run)

| ID | Name | Seed-Variable Parameter | Input Type |
|----|------|------------------------|------------|
| P1 | ROT Cipher | Shift value: 7, 13, or 19 — changes each run | Text input |
| P2 | Roman Numeral Decode | Number set seeded each run | Number input |
| P3 | Morse Code | Sequence seeded each run | Text input |
| P4 | Binary-to-Decimal | 4 values seeded each run | Number input |
| P5 | Colour Sequence Memory | Sequence shuffled by seed | Click sequence |
| P6 | Monad Anagram | Word drawn from curated list by seed | Text input |

---

## 7. Co-op Task Pool (4 Total, 2 Drawn Per Run)

### T1 — Split Code
- Player A finds left 3 digits of a 6-digit code on Object X
- Player B finds right 3 digits on Object Y (different room area)
- Neither can see the other's digits — must communicate via **in-game chat** (Supabase Broadcast)
- Both enter full 6-digit code into a shared terminal to unlock

### T2 — Pressure Plates
- 3 floor buttons scattered across room (positions seeded)
- All 3 must be held simultaneously within a **5-second window** (extended from 3s)
- Timestamps recorded server-side via Supabase `created_at` — not client clocks
- Visual feedback: buttons glow green when activated; vault opens when all 3 held
- `task_state` rows with `action: 'plate_held'` + `created_at` used for resolution

### T3 — Relay Chain
- Object A locked to Player 1 only (role assigned by seed)
- Inside Object A: a keycard for Object B
- Player 1 opens A → picks up keycard → approaches Player 2 (proximity transfer, 48px)
- Player 2 receives keycard → opens B → finds final clue

### T4 — Synchronized Levers
- Two levers on opposite walls of the room (positions seeded)
- Each player pulls independently
- Both pulls must occur within a **5-second window** (extended from 3s), measured by server `created_at`
- 3 failed attempts → 30-second lockout
- `task_state` stores `{lever: 'left'|'right', created_at}` per pull

---

## 8. Smart Contract Design

### Contract: `MonadEscapeRoom.sol`

```solidity
struct Group {
    address[]            members;
    mapping(address => bool) escaped;
    uint8                escapedCount;
    bool                 won;
}

struct Session {
    address   host;
    uint256   stakePerPlayer;
    bytes32   seed;
    bool      isCoOp;
    uint8     maxGroups;         // co-op: 2–4 groups
    uint8     maxPlayersPerGroup;
    uint256   startTime;
    uint256   timeLimit;
    bool      resolved;
    address   winner;            // solo: winning player
    uint8     winnerGroupId;     // co-op: winning group index
    uint8     groupCount;
    mapping(uint8 => Group) groups;
    mapping(address => uint8) playerGroup; // which group is this player in
}

// Protocol fee — 2.5%
uint256 public constant PROTOCOL_FEE_BPS = 250;
uint256 public constant BPS = 10_000;
address public treasury;
address public trustedSigner;   // backend escape proof signer
```

### Core Functions

```solidity
// HOST: Create session, host joins group 0 automatically
function createSession(
    uint256 sessionId,
    uint256 stakePerPlayer,
    bool    isCoOp,
    uint8   maxGroups,
    uint8   maxPlayersPerGroup,
    uint256 timeLimitSec
) external payable;

// PLAYER: Join a session into a specific group slot, pays stake
function joinSession(uint256 sessionId, uint8 groupId) external payable;

// HOST: Lock stakes, generate seed, start the clock
function startSession(uint256 sessionId) external;
// seed = keccak256(abi.encodePacked(sessionId, block.prevrandao))

// PLAYER: Submit signed escape proof from trusted backend
function markEscaped(uint256 sessionId, bytes calldata backendSig) external;
// Verifies: ECDSA.recover(keccak256(sessionId, msg.sender, "ESCAPED"), sig) == trustedSigner
// Solo: if first to escape → sets winner, marks resolved
// Co-op: increments group.escapedCount; if == groupSize and !session.resolved → sets winnerGroup

// WINNER: Pull payout after session resolved
function claimReward(uint256 sessionId) external nonReentrant;
// pot = stakePerPlayer * totalPlayers
// fee = pot * PROTOCOL_FEE_BPS / BPS → treasury
// net = pot - fee
// Solo: winner gets net
// Co-op: each winning group member gets net / winnerGroupSize

// SAFETY: After timeLimit with no winner, anyone can trigger refund for all
function expireSession(uint256 sessionId) external;
// Requires: block.timestamp > startTime + timeLimit && !resolved
// Refunds all stakes minus protocol fee (disincentivises abandonment)

// SAFETY: Emergency drain, owner only, 24h timelock
function emergencyWithdraw(uint256 sessionId) external onlyOwner;
```

### Payout Formula

```
pot         = stakePerPlayer × totalPlayersAcrossAllGroups
fee         = pot × 2.5%  →  treasury
net         = pot − fee

Solo winner payout   = net
Co-op winner/player  = net ÷ winningGroupSize
```

### Events
```solidity
event SessionCreated(uint256 sessionId, bytes32 seed, bool isCoOp, uint8 maxGroups);
event PlayerJoined  (uint256 sessionId, address player, uint8 groupId);
event SessionStarted(uint256 sessionId, uint256 startTime);
event PlayerEscaped (uint256 sessionId, address player, uint8 groupId);
event SessionResolved(uint256 sessionId, bool isCoOp, uint8 winnerGroupId, uint256 netPayout);
event RewardClaimed (uint256 sessionId, address player, uint256 amount);
```

---

## 9. Supabase Schema

```sql
-- Sessions (mirrors on-chain session)
create table sessions (
  session_id   bigint primary key,
  seed         text not null,
  is_coop      boolean default false,
  max_groups   int not null default 1,
  status       text not null default 'open', -- open | active | resolved
  created_at   timestamptz default now()
);

-- Groups within a session (co-op)
create table session_groups (
  id           uuid primary key default gen_random_uuid(),
  session_id   bigint references sessions(session_id) on delete cascade,
  group_id     int not null,   -- 0, 1, 2, 3
  unique(session_id, group_id)
);

-- Players (solo: all in group_id 0; co-op: assigned groups)
create table session_players (
  id             uuid primary key default gen_random_uuid(),
  session_id     bigint references sessions(session_id) on delete cascade,
  group_id       int not null default 0,
  wallet_address text not null,
  role           text,          -- 'P1','P2','P3' for co-op role assignment
  escaped        boolean not null default false,
  escaped_at     timestamptz,
  unique(session_id, wallet_address)
);

-- Co-op task state
create table task_state (
  id           uuid primary key default gen_random_uuid(),
  session_id   bigint references sessions(session_id) on delete cascade,
  group_id     int not null,
  task_type    text not null,  -- 'split_code' | 'pressure_plates' | 'relay_chain' | 'sync_levers'
  player_addr  text not null,
  action       text not null,  -- 'triggered' | 'completed' | 'failed'
  payload      jsonb,          -- e.g. {lever: 'left'} or {plate: 2}
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
```

### Realtime Channels
- **Presence** `session:{sessionId}` — tracks online/offline per session, drives ghost sprites
- **Broadcast** `positions:{sessionId}` — emits `{playerId, x, y}` at 10fps (delta only, >4px moved)
- **Broadcast** `chat:{sessionId}` — in-game text chat for co-op (required for T1 Split Code)
- **Postgres Changes** on `task_state` — triggers co-op task resolution logic
- **Postgres Changes** on `session_players` — triggers escape progress UI for all players

---

## 10. Backend Signer Service

A lightweight Vercel Edge Function (or Express route):

```typescript
// POST /api/sign-escape
// Body: { sessionId, playerAddr, puzzlesSolvedCount }
// Returns: { signature } or { error }

export async function POST(req: Request) {
  const { sessionId, playerAddr } = await req.json()

  // 1. Verify all 3 puzzles solved in Supabase
  const { count } = await supabase
    .from('task_state')
    .select('*', { count: 'exact' })
    .eq('session_id', sessionId)
    .eq('player_addr', playerAddr)
    .eq('action', 'puzzle_solved')
  
  if (count < 3) return Response.json({ error: 'Puzzles not solved' }, { status: 403 })

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

## 11. UI/UX Flow

```
Landing Page
  → Connect Wallet (wagmi + RainbowKit)
    ↓
  SOLO: Enter stake → Create/Join session → Wait for players → Host starts
  CO-OP: Create session (set stake, group count) → Share link
          → Groups fill up → Host starts
    ↓
  Seed loaded from RoomCreated event → generateRoom(seed)
    ↓
  Phaser GameScene mounted
    → Free roam → Investigate objects → Collect 3 clues
    → Puzzle modals unlock → Solve all 3
    → Request escape sig from backend → Submit markEscaped() on-chain
    ↓
  SOLO WIN:  winner screen → claimReward() → receive net pot
  COOP WIN:  all group members must escape → winner screen → claimReward()
  LOSS:      stake slashed · lose screen
  TIMEOUT:   expireSession() → partial refund (net of fee)
```

---

## 12. Agent-Executable Components

The following modules can be fully scaffolded by an AI coding agent with no manual intervention:

- `lib/prng.ts` — mulberry32 seeded PRNG
- `lib/puzzles/*.ts` — all 6 puzzle logic + answer validators
- `lib/roomGenerator.ts` — full procedural room from seed
- `contracts/MonadEscapeRoom.sol` — full contract with session/group/payout logic
- `contracts/deploy.ts` — Hardhat deploy script
- `hooks/useEscapeRoom.ts` — all wagmi hooks (updated for session/group model)
- `supabase/schema.sql` — full schema with new tables
- `supabase/rls.sql` — RLS policies (players write own rows only)
- `lib/supabase/channels.ts` — presence, broadcast positions, broadcast chat, task_state listener
- `api/sign-escape.ts` — backend signer edge function
- `scenes/GameScene.ts` — Phaser scene scaffold with all subsystems
- `components/puzzles/*.tsx` — all 6 puzzle UI components
- `components/CoopTaskOverlay.tsx` — all 4 co-op task overlays with teammate status
- `components/HUD.tsx` — timer, inventory, group progress, chat toggle
- `types/game.ts` — all TypeScript types
- `scripts/setup-env.sh` — dev environment bootstrap
