# Monad Escape Room — Requirements Document

> Version 1.1 | Monad Hackathon 2026

---

## Changelog (v1.0 → v1.1)
- **F-06/F-07 rewritten** — reward model now funded entirely by losing players/groups' stakes
- **Session/group model added** — F-03 to F-05 updated for multi-group co-op sessions
- **F-NEW: Backend signer** — escape proof signing service added as F-45 to F-47
- **F-NEW: In-game chat** — added as F-48 (required for T1 Split Code task)
- **F-NEW: position_state** — added as F-49 for reconnect recovery
- **F-35/F-37 updated** — sync windows extended to 5s; server timestamps enforced
- **NF-09 updated** — puzzle answers validated server-side via signer service
- **LobbyScene removed** from Phaser scene requirements

---

## 1. Functional Requirements

### 1.1 Wallet & Staking
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-01 | Player connects wallet via wagmi (MetaMask, Rabby) | ✅ wagmi boilerplate | Monad RPC URL config |
| F-02 | Solo player stakes MON and enters session (group 0) | ✅ `useWriteContract` hook | Min stake UX decision |
| F-03 | Co-op host creates session with stake per player, max groups, max players per group | ✅ contract function | Stake range policy |
| F-04 | Co-op players join session by group link, select their group, pay same stake | ✅ join flow | — |
| F-05 | Contract locks all stakes from all groups until `resolveSession()` | ✅ Solidity | Audit for reentrancy |
| F-06 | Solo: first player to call `markEscaped()` with valid sig wins net pot (all stakes minus 2.5% fee) | ✅ Solidity payout | — |
| F-07 | Co-op: first group where all members call `markEscaped()` wins net pot split equally per member | ✅ Solidity payout | Treasury address config |
| F-08 | Protocol fee: 2.5% of pot on every `resolveSession()` sent to treasury address | ✅ Solidity | Treasury address decision |
| F-09 | Losing players/groups receive 0 MON — stakes fund the pot | ✅ Solidity | — |
| F-10 | `expireSession()`: after timeLimit with no winner, refunds all stakes minus 2.5% fee | ✅ Solidity | — |
| F-11 | Emergency withdraw with 24h timelock, owner only | ✅ Solidity | Owner key management |

### 1.2 Session & Seed Generation
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-12 | `startSession()` stores `keccak256(abi.encodePacked(sessionId, block.prevrandao))` as seed | ✅ Solidity | — |
| F-13 | Frontend reads seed from `SessionStarted` event via wagmi `useWatchContractEvent` | ✅ wagmi hook | — |
| F-14 | `seededRandom(seed, index)` PRNG → deterministic float, mulberry32 implementation | ✅ mulberry32 impl | — |
| F-15 | Room layout (walls, floors) generated from seed — same for all players/groups in session | ✅ tilemap generator | Tileset asset selection |
| F-16 | 10–15 objects placed at seed-determined (x, y) positions, no two within 64px | ✅ object placer | Object art assets |
| F-17 | Exactly 3 objects hold real clues; remaining objects are red herrings or empty | ✅ seeded assignment | Flavor text writing |
| F-18 | 3 puzzles drawn from pool of 6 per session by seed | ✅ seeded picker | — |
| F-19 | 2 co-op tasks drawn from pool of 4 per session by seed (co-op only) | ✅ seeded picker | — |

### 1.3 Free-Roam Engine (Phaser.js)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-20 | WASD movement with collision detection against tilemap walls | ✅ Phaser physics | — |
| F-21 | Click-to-walk pathfinding to clicked position | ✅ Phaser pathfinder | — |
| F-22 | Camera follows local player, bounded to room edges | ✅ Phaser camera | — |
| F-23 | Press `E` or click within 32px of object to trigger investigate | ✅ Phaser overlap zone | — |
| F-24 | Hotspot outcomes: real clue adds to inventory / red herring shows flavor text / empty shows "Nothing here" | ✅ HotspotManager class | Flavor text writing |
| F-25 | Investigated objects show a visually distinct "checked" state (sprite tint or overlay) | ✅ sprite tinting | — |
| F-26 | Remote players (same session) rendered as ghost sprites at synced positions | ✅ Supabase + Phaser | — |
| F-27 | Co-op: remote players in same group rendered distinctly from players in rival groups | ✅ sprite tinting by group | — |
| F-28 | 60fps target on desktop Chrome/Firefox/Safari | ✅ Phaser default | QA testing |
| F-29 | Phaser canvas mounted by React after seed loaded; lobby entirely in React/Next.js | ✅ component design | — |

### 1.4 Puzzle System
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-30 | P1: ROT cipher — shift value (7, 13, or 19) seeded per run | ✅ cipher logic | — |
| F-31 | P2: Roman numeral decode — number set seeded per run | ✅ numeral logic | — |
| F-32 | P3: Morse code — character sequence seeded per run | ✅ morse lookup table | — |
| F-33 | P4: Binary-to-decimal — 4-bit values seeded per run | ✅ binary logic | — |
| F-34 | P5: Colour sequence memory — sequence order shuffled by seed | ✅ sequence UI | — |
| F-35 | P6: Monad anagram — word drawn from curated 20-word list by seed | ✅ anagram logic | Write 20 Monad-themed words |
| F-36 | Wrong answer: 3 attempts then 30s cooldown before retry | ✅ attempt tracker | — |
| F-37 | Solved puzzle recorded in `task_state` with `action: 'puzzle_solved'` | ✅ Supabase write | — |
| F-38 | All 3 puzzles solved → player requests escape signature from backend signer API | ✅ fetch call | — |
| F-39 | Backend signer verifies 3 `puzzle_solved` rows in Supabase then signs escape proof | ✅ Edge Function | Signer private key mgmt |
| F-40 | Player submits `markEscaped(sessionId, sig)` on-chain with backend signature | ✅ wagmi hook | — |
| F-41 | All 3 puzzles solved + valid escape on-chain → exit door unlocks in Phaser | ✅ state machine | — |

### 1.5 Co-op Task System
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-42 | T1 Split Code: digits split by role; in-game chat required for coordination; shared terminal accepts full 6-digit code | ✅ Supabase + UI | — |
| F-43 | T2 Pressure Plates: 3 plates all active within 5-second window; window measured by server `created_at` timestamps | ✅ server timestamp comparison | Window tuning (playtesting) |
| F-44 | T3 Relay Chain: keycard item pickup and proximity transfer (within 48px) between players | ✅ inventory + proximity | — |
| F-45 | T4 Sync Levers: both lever pulls within 5-second window measured by server `created_at`; 3 failures = 30s lockout | ✅ Supabase + timer | Window/lockout tuning |
| F-46 | Co-op task UI shows each teammate's real-time task status (triggered / completed / failed) | ✅ Supabase presence | — |
| F-47 | All co-op task actions recorded in `task_state` with server `created_at` for authoritative timing | ✅ Supabase write | — |

### 1.6 Multiplayer Sync
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-48 | Player positions broadcast at **10fps** via Supabase Broadcast; only if moved >4px (delta compression) | ✅ channel + delta check | — |
| F-49 | Presence channel `session:{sessionId}` tracks online/offline per session | ✅ presence setup | — |
| F-50 | Postgres Changes on `task_state` triggers co-op resolution logic client-side | ✅ realtime listener | — |
| F-51 | On reconnect: load last known position from `player_positions` table; re-subscribe to all channels | ✅ reconnect handler | — |
| F-52 | Max players per group enforced contract-side in `joinSession()` | ✅ Solidity require | Player count UX |
| F-53 | Max groups per session enforced contract-side in `joinSession()` | ✅ Solidity require | — |

### 1.7 In-Game Chat (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-54 | In-game text chat via Supabase Broadcast channel `chat:{sessionId}` | ✅ broadcast channel | — |
| F-55 | Chat visible only to co-op players (hidden in solo mode) | ✅ conditional render | — |
| F-56 | Chat messages include sender's truncated wallet address and timestamp | ✅ payload design | — |
| F-57 | Chat input dismisses on Escape key; does not interfere with WASD movement | ✅ Phaser key capture | — |

### 1.8 Backend Signer Service (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-58 | `POST /api/sign-escape` verifies 3 puzzle_solved rows in Supabase for the requesting player | ✅ Edge Function | — |
| F-59 | Returns `ethers.signMessage(keccak256(sessionId, playerAddr, "ESCAPED"))` on success | ✅ ethers.js sign | Signer private key mgmt |
| F-60 | Returns 403 with error if puzzles not all solved or player not in session | ✅ validation logic | — |
| F-61 | Signer private key stored in `SIGNER_PRIVATE_KEY` env var, never exposed client-side | ✅ env design | Key generation + storage |

---

## 2. Non-Functional Requirements

### 2.1 Performance
| ID | Requirement | Target |
|----|-------------|--------|
| NF-01 | Phaser game renders at | ≥ 60fps on desktop Chrome |
| NF-02 | Position sync latency | ≤ 100ms round-trip (Supabase Broadcast) |
| NF-03 | Room load time (seed → Phaser scene rendered) | ≤ 3 seconds |
| NF-04 | Contract `startSession()` confirmation | ≤ 2 seconds on Monad testnet |
| NF-05 | Supabase co-op task write → all clients updated | ≤ 200ms |
| NF-06 | Backend signer response time | ≤ 500ms |

### 2.2 Security
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| NF-07 | Seed comes from on-chain event only — no client-side seed injection possible | ✅ design enforced | — |
| NF-08 | `markEscaped()` requires valid ECDSA signature from trusted backend signer | ✅ ECDSA.recover in Solidity | Signer key management |
| NF-09 | Reentrancy guard on all ETH-transfer functions (`claimReward`, `expireSession`, `emergencyWithdraw`) | ✅ OpenZeppelin | Code review |
| NF-10 | Supabase RLS — players can only write rows where `wallet_address = auth.uid()` | ✅ SQL RLS policies | Policy review |
| NF-11 | Puzzle answers validated server-side via signer service before escape sig is issued | ✅ enforced by F-58 | — |
| NF-12 | `resolveSession()` / `expireSession()` callable only after timeLimit elapsed or all escaped | ✅ Solidity modifier | — |
| NF-13 | `claimReward()` callable only by winning player/group member, only once per address | ✅ Solidity mapping | — |
| NF-14 | Signer private key never in frontend bundle — server-side only | ✅ env separation | Key generation |

### 2.3 Compatibility
- Desktop browsers: Chrome 110+, Firefox 110+, Safari 16+
- Wallets: MetaMask, Rabby, WalletConnect (via wagmi)
- Chain: Monad Testnet (EVM-compatible, chainId TBD)
- Node.js: 18.x LTS for local dev

---

## 3. Developer Environment Requirements

### 3.1 Required Tools
```bash
node >= 18.x
pnpm >= 8.x
hardhat              # contract dev + deploy
supabase CLI         # local dev + migrations
phaser >= 3.x        # game engine
next.js >= 14        # frontend framework
wagmi 2.x + viem 2.x # contract interaction
@supabase/supabase-js 2.x
ethers 6.x           # backend signer
typescript 5.x
```

### 3.2 Environment Variables
```env
# .env.local — fill manually after setup
NEXT_PUBLIC_SUPABASE_URL=          # Supabase dashboard → Project Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # same
NEXT_PUBLIC_CONTRACT_ADDRESS=      # after deploy
NEXT_PUBLIC_MONAD_RPC_URL=         # Monad testnet RPC endpoint
NEXT_PUBLIC_WALLETCONNECT_ID=      # cloud.walletconnect.com (free)
PRIVATE_KEY=                       # deployer wallet — NEVER COMMIT
SIGNER_PRIVATE_KEY=                # backend escape signer — NEVER COMMIT, different key from deployer
TREASURY_ADDRESS=                  # where protocol fees go
```

### 3.3 Supabase Setup
- Create project at supabase.com
- Run `supabase/schema.sql` in SQL editor
- Run `supabase/rls.sql` in SQL editor
- Enable Realtime on: `task_state`, `session_players`, `player_positions`
- Verify RLS enabled on all tables

---

## 4. Agent Prompting Guide

### Prompt Templates

**PRNG + Room Generator:**
> "Generate a TypeScript module `lib/roomGenerator.ts`. Export `generateRoom(seedHex: string, isCoOp: boolean)`. Use mulberry32 PRNG from the seed. Return: 3 puzzles from PUZZLE_POOL (P1–P6), 2 co-op tasks from COOP_POOL (T1–T4) if isCoOp, array of 12 objects `{id, type, x, y, hasClue: boolean}` within 800×600 bounds, no two objects within 64px. Export all TypeScript types."

**Smart Contract:**
> "Generate Solidity 0.8.24 contract `MonadEscapeRoom.sol`. Uses OpenZeppelin ReentrancyGuard, Ownable, ECDSA. Implements: Session struct with groups mapping, Group struct with escaped mapping. Functions: `createSession(sessionId, stakePerPlayer, isCoOp, maxGroups, maxPlayersPerGroup, timeLimitSec)` payable, `joinSession(sessionId, groupId)` payable, `startSession(sessionId)` host-only generating seed from block.prevrandao, `markEscaped(sessionId, bytes sig)` verifying ECDSA sig from trustedSigner, `claimReward(sessionId)` with solo (winner gets net pot) and co-op (split net pot by group size) payout, `expireSession(sessionId)` for timeout refunds, 2.5% protocol fee to treasury. Emit all events. Full NatSpec."

**Backend Signer:**
> "Generate a Next.js Edge Function `app/api/sign-escape/route.ts`. POST handler accepts `{sessionId, playerAddr}`. Queries Supabase to count `task_state` rows where `session_id=sessionId, player_addr=playerAddr, action='puzzle_solved'`. If count < 3 return 403. Otherwise sign `ethers.solidityPackedKeccak256(['uint256','address','string'], [sessionId, playerAddr, 'ESCAPED'])` with ethers Wallet from `process.env.SIGNER_PRIVATE_KEY`. Return `{signature}`. TypeScript strict mode."

**Supabase Channels:**
> "Generate `lib/supabase/channels.ts`. Export: `joinSessionPresence(sessionId, wallet)`, `broadcastPosition(sessionId, x, y, lastX, lastY)` — only sends if moved >4px, `subscribeToPositions(sessionId, cb)`, `sendChatMessage(sessionId, wallet, text)`, `subscribeToChat(sessionId, cb)`, `writeTaskAction(sessionId, groupId, taskType, action, payload)`, `subscribeToTaskState(sessionId, cb)`. Handle reconnect. Supabase-js 2.x. TypeScript strict."

**Phaser GameScene:**
> "Generate Phaser 3 TypeScript class `GameScene extends Phaser.Scene`. Accepts `RoomConfig` from `generateRoom()` plus `sessionId`, `playerWallet`, `groupId`. Creates tilemap from config. Places object sprites. WASD + click-to-walk player. E key within 32px triggers 'investigate' event with objectId. Remote player positions synced from Supabase at 10fps as ghost sprites — tinted blue for same group, red for rival groups. Export all types."

**All 6 Puzzle Components:**
> "Generate 6 React TypeScript components in `components/puzzles/`. Each accepts `{config: PuzzleConfig, sessionId: bigint, playerAddr: string, onSolve: () => void}`. On solve: write `task_state` row with `action: 'puzzle_solved'` before calling onSolve. Implement: ROTCipher (shift from config), RomanNumerals (numbers from config), MorseCode (sequence from config), BinaryDecimal (values from config), ColourSequence (order from config, click-sequence UI), MonadAnagram (word from config). 3-attempt lockout with 30s timer. All dark-themed."

**Co-op Task Overlays:**
> "Generate `components/CoopTaskOverlay.tsx`. Accepts active tasks from `generateRoom()`, sessionId, groupId, playerRole. Renders 4 task UIs conditionally: SplitCode (shows your half-digits, input for full code, result from Supabase), PressurePlates (3 buttons, green when held, 5s server-window countdown), RelayChain (inventory slot, proximity indicator for handoff), SyncLevers (left/right lever buttons, 5s window progress bar, attempt counter). Reads task_state realtime for teammate status."

---

## 5. Deliverables Checklist

### Agent-Generated (zero manual effort)
- [ ] `lib/prng.ts`
- [ ] `lib/roomGenerator.ts`
- [ ] `lib/puzzles/index.ts` (validators for all 6)
- [ ] `contracts/MonadEscapeRoom.sol`
- [ ] `contracts/deploy.ts` (Hardhat script)
- [ ] `hooks/useEscapeRoom.ts` (all wagmi hooks, session/group model)
- [ ] `supabase/schema.sql` (all tables including player_positions)
- [ ] `supabase/rls.sql`
- [ ] `lib/supabase/channels.ts` (positions, chat, task_state, presence)
- [ ] `app/api/sign-escape/route.ts` (backend signer Edge Function)
- [ ] `scenes/GameScene.ts`
- [ ] `scenes/PreloadScene.ts`
- [ ] `components/puzzles/*.tsx` (all 6 components)
- [ ] `components/CoopTaskOverlay.tsx` (all 4 task UIs)
- [ ] `components/HUD.tsx` (timer, inventory, group status, chat toggle)
- [ ] `components/ChatWidget.tsx` (co-op in-game chat)
- [ ] `types/game.ts` (all TypeScript types)
- [ ] `scripts/setup-env.sh`

### Manual Tasks (human required)
- [ ] Purchase/download room tileset + character sprites (Kenney.nl — free)
- [ ] Write 20 Monad-themed words for P6 anagram pool
- [ ] Generate signer private key (`cast wallet new`) and store securely
- [ ] Set all env vars in `.env.local`
- [ ] Fund deployer wallet with Monad testnet MON
- [ ] Deploy contract + paste address in env
- [ ] Create Supabase project + run schema + RLS SQL
- [ ] Enable Realtime on `task_state`, `session_players`, `player_positions` in Supabase dashboard
- [ ] Decide: minimum stake, maximum groups per session, treasury address
- [ ] Playtest and tune: 5s sync windows, lockout durations, clue count
- [ ] Record demo clip for judges

---

## 6. Reward Model — Quick Reference

| Scenario | Winner Gets | Loser Gets |
|----------|------------|------------|
| Solo, 4 players × 0.05 MON | 0.195 MON (net of 2.5% fee) | 0 MON |
| Co-op, 2 groups × 3 × 0.05 MON | 0.0975 MON each (net ÷ 3) | 0 MON |
| Co-op, 4 groups × 4 × 0.05 MON | 0.195 MON each (net ÷ 4) | 0 MON |
| Timeout, no winner | Stake refunded minus 2.5% fee | partial refund |

**Key principle:** The pot is always fully funded by players' own stakes. No external funds, no protocol subsidy. Larger sessions and bigger groups create larger pots and stronger incentives to play again.
