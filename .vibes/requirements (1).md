# PH0xBIA — Haunted Escape Room Requirements Document

> Version 2.0 | Monad Hackathon 2026
> Theme: **Psychological Horror** — Ashworth Asylum

---

## Changelog (v1.1 → v2.0 — Horror Overhaul)
- **All requirements updated** with horror theme terminology (asylum, covens, The Warden, etc.)
- **F-NEW: Sanity system** — F-62 to F-68 covering sanity mechanics, visual effects, and recovery
- **F-NEW: Dynamic lighting** — F-69 to F-73 covering flashlight, fog-of-war, flickering, blackouts
- **F-NEW: Ghost NPCs** — F-74 to F-77 covering patrol, collision, sanity drain
- **F-NEW: Jump-scare system** — F-78 to F-80 covering seed-determined scares
- **F-NEW: Horror audio** — F-81 to F-84 covering ambient layers, proximity audio, stingers
- **F-NEW: Intro cutscene** — F-85 covering asylum intro scene
- **Puzzle names re-themed** — Blood Cipher, Patient Numbers, EVP Recording, Binary Locks, Ritual Sequence, Patient Anagram
- **Co-op tasks re-themed** — Whisper Code, Séance Circle, Possessed Relay, Blood Ritual Levers
- **Contract renamed** — `PH0xBIA.sol`, groups → covens, host → summoner
- **NF performance targets updated** for lighting and particle rendering

---

## 1. Functional Requirements

### 1.1 Wallet & Staking ("Blood Offering")
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-01 | Player connects wallet via wagmi (MetaMask, Rabby) | ✅ wagmi boilerplate | Monad RPC URL config |
| F-02 | Solo player stakes MON ("blood offering") and enters session (coven 0) | ✅ `useWriteContract` hook | Min stake UX decision |
| F-03 | Co-op host ("summoner") creates séance session with stake, max covens, max players per coven | ✅ contract function | Stake range policy |
| F-04 | Co-op players join session by cursed link, select their coven, pay same stake | ✅ join flow | — |
| F-05 | Contract locks all stakes from all covens until session resolved | ✅ Solidity | Audit for reentrancy |
| F-06 | Solo: first player to call `markEscaped()` with valid Warden sig wins net pot (all stakes minus 2.5% tithe) | ✅ Solidity payout | — |
| F-07 | Co-op: first coven where all members call `markEscaped()` wins net pot split equally per member | ✅ Solidity payout | Treasury address config |
| F-08 | Protocol fee ("Asylum's Tithe"): 2.5% of pot on every resolve sent to treasury | ✅ Solidity | Treasury address decision |
| F-09 | Losing players/covens receive 0 MON — stakes feed the asylum | ✅ Solidity | — |
| F-10 | `expireSession()`: after timeLimit with no winner, refunds all stakes minus 2.5% tithe | ✅ Solidity | — |
| F-11 | Emergency withdraw with 24h timelock, owner only | ✅ Solidity | Owner key management |

### 1.2 Session & Curse Seed Generation
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-12 | `startSession()` stores `keccak256(abi.encodePacked(sessionId, block.prevrandao))` as curse seed | ✅ Solidity | — |
| F-13 | Frontend reads seed from `SessionStarted` event via wagmi `useWatchContractEvent` | ✅ wagmi hook | — |
| F-14 | `seededRandom(seed, index)` PRNG → deterministic float, mulberry32 implementation | ✅ mulberry32 impl | — |
| F-15 | Asylum ward layout (cracked walls, padded cells) generated from seed — same for all players/covens | ✅ tilemap generator | Asylum tileset assets |
| F-16 | 10–15 horror objects placed at seed-determined (x, y); no two within 64px | ✅ object placer | Horror object art |
| F-17 | Exactly 3 objects hold real patient file clues; remaining are red herrings (disturbing flavor text) or empty | ✅ seeded assignment | Horror flavor text writing |
| F-18 | 3 puzzles drawn from pool of 6 horror-themed puzzles per session by seed | ✅ seeded picker | — |
| F-19 | 2 co-op tasks drawn from pool of 4 occult tasks per session by seed (co-op only) | ✅ seeded picker | — |

### 1.3 Free-Roam Engine (Phaser.js)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-20 | WASD movement with collision detection against asylum walls | ✅ Phaser physics | — |
| F-21 | Click-to-walk pathfinding to clicked position | ✅ Phaser pathfinder | — |
| F-22 | Camera follows local player, bounded to ward edges | ✅ Phaser camera | — |
| F-23 | Press `E` or click within 32px of object to trigger investigate (with jump-scare chance) | ✅ Phaser overlap zone | — |
| F-24 | Hotspot outcomes: real clue → patient file / red herring → horror flavor text + sanity drain / empty → "Dust and silence." | ✅ HotspotManager class | Horror flavor text |
| F-25 | Investigated objects show "checked" state (eerie glow or X mark sprite overlay) | ✅ sprite tinting | — |
| F-26 | Remote players rendered as ghost-tinted phantom sprites at synced positions | ✅ Supabase + Phaser | — |
| F-27 | Co-op: same-coven players tinted blue phantom; rival coven players tinted red phantom | ✅ sprite tinting by coven | — |
| F-28 | 60fps target on desktop Chrome/Firefox/Safari (with lighting and particle effects active) | ✅ Phaser + WebGL | QA testing |
| F-29 | Phaser canvas mounted by React after seed loaded; lobby entirely in React/Next.js | ✅ component design | — |

### 1.4 Sanity System (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-62 | Each player starts with 100% sanity, tracked client-side and synced to `session_players.sanity` | ✅ state machine | — |
| F-63 | Sanity drains on: red herring investigation (-5%), ghost NPC contact (-10%), failed puzzle (-3%), jump-scare (-8%) | ✅ event handlers | Balance tuning |
| F-64 | Sanity recovers: +1%/sec while stationary, +15% on puzzle solve | ✅ timer logic | Balance tuning |
| F-65 | At 75% sanity: screen vignette darkens, faint whisper audio begins | ✅ shader/overlay | — |
| F-66 | At 50% sanity: screen grain/static overlay, hallucination sprites appear at vision edges | ✅ particle + overlay | — |
| F-67 | At 25% sanity: heavy chromatic aberration, phantom objects appear (fake interactive objects) | ✅ post-processing | — |
| F-68 | At 0% sanity: 5-second blackout + random teleport, sanity resets to 30% | ✅ state machine | — |

### 1.5 Dynamic Lighting & Fog-of-War (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-69 | Player has flashlight radius: 128px bright circle, 192px dim outer circle | ✅ Phaser light | — |
| F-70 | Room outside flashlight radius rendered as pitch black silhouettes | ✅ light pipeline | — |
| F-71 | Flickering light effect: seed-determined pattern of brightness variation | ✅ animation system | — |
| F-72 | Periodic blackout events (3–5 sec, seed-determined timing): complete darkness, only player glows faintly | ✅ timed events | — |
| F-73 | Fog-of-war: unexplored areas black on minimap, revealed as player explores | ✅ tile reveal system | — |

### 1.6 Ghost NPC System (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-74 | 2–3 ghost NPCs per ward, patrol paths seed-determined from waypoint grid | ✅ pathfinding | — |
| F-75 | Ghosts move through walls, flicker in/out of visibility (50% opacity, intermittent) | ✅ sprite animation | Ghost sprites |
| F-76 | Contact with ghost: -10% sanity + 2-second movement slow debuff | ✅ collision handler | — |
| F-77 | Ghosts have visible patrol pause points (observant players can avoid them) | ✅ AI state machine | — |

### 1.7 Jump-Scare System (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-78 | Max 3 jump-scares per session, triggered on seed-determined object interactions | ✅ seeded triggers | — |
| F-79 | Scare types: face flash (200ms overlay), hand reach, mirror distortion — with stinger sound + screen shake | ✅ overlay + audio | Scare art assets |
| F-80 | Each scare drains -8% sanity; never repeated for same player in same session | ✅ state tracking | — |

### 1.8 Horror Audio (NEW)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-81 | Ambient audio layers: deep drone, water dripping, metallic creaking, distant moaning (looping) | ✅ Phaser audio | Audio assets |
| F-82 | Proximity audio: whispers intensify near clue objects; heartbeat at low sanity | ✅ distance-based volume | Audio assets |
| F-83 | Stinger sounds on jump-scares: sharp violin hit, door slam, glass break | ✅ triggered audio | Audio assets |
| F-84 | Co-op: distorted radio static when teammates far away; clear when close | ✅ distance-based filter | Audio assets |
| F-85 | IntroScene: 5-second asylum hallway camera pan with text overlay before gameplay | ✅ Phaser scene | — |

### 1.9 Horror Puzzle System (re-themed from §1.4)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-30 | P1: Blood Cipher — ROT cipher written in blood on asylum wall; shift (7, 13, 19) seeded | ✅ cipher logic | — |
| F-31 | P2: Patient Numbers — Roman numerals carved into patient cell doors; number set seeded | ✅ numeral logic | — |
| F-32 | P3: EVP Recording — Morse code hidden in static audio (Electronic Voice Phenomenon); sequence seeded | ✅ morse lookup | — |
| F-33 | P4: Binary Locks — Binary code on electronic cell door locks (red/green LED blinks); 4-bit values seeded | ✅ binary logic | — |
| F-34 | P5: Ritual Sequence — Candles lit in correct colour order (blood red, ghost white, etc.); shuffled by seed | ✅ sequence UI | — |
| F-35 | P6: Patient Anagram — Unscramble asylum/horror term from scrambled file letters; word from curated 20-word horror list | ✅ anagram logic | Write 20 horror words |
| F-36 | Wrong answer: 3 attempts then 30s cooldown; text: *"The walls are watching. Try again in 30 seconds."* | ✅ attempt tracker | — |
| F-37 | Solved puzzle recorded in `task_state` with `action: 'puzzle_solved'` | ✅ Supabase write | — |
| F-38 | All 3 puzzles solved → player requests escape sig from The Warden API | ✅ fetch call | — |
| F-39 | The Warden verifies 3 `puzzle_solved` rows in Supabase then signs escape proof | ✅ Edge Function | Signer key mgmt |
| F-40 | Player submits `markEscaped(sessionId, sig)` on-chain with Warden signature | ✅ wagmi hook | — |
| F-41 | All 3 puzzles solved + valid escape → asylum gate rises in Phaser (iron gate animation) | ✅ state machine | — |

### 1.10 Occult Co-op Task System (re-themed from §1.5)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-42 | T1 Whisper Code: patient admission digits split by role; séance chat required; electroshock terminal input | ✅ Supabase + UI | — |
| F-43 | T2 Séance Circle: 3 ritual circles all occupied within 5s window; server timestamps; circles glow eerie green | ✅ server timestamp | Window tuning |
| F-44 | T3 Possessed Relay: cursed wristband pickup, drains sanity while held (-2%/sec), proximity transfer at 48px | ✅ inventory + sanity | — |
| F-45 | T4 Blood Ritual Levers: both pulls within 5s window; 3 failures = 30s lockout; walls bleed on success | ✅ Supabase + timer | Window/lockout tuning |
| F-46 | Co-op task UI shows each coven member's real-time status (triggered / completed / failed) | ✅ Supabase presence | — |
| F-47 | All co-op task actions recorded in `task_state` with server `created_at` | ✅ Supabase write | — |

### 1.11 Multiplayer Sync
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-48 | Player positions broadcast at **10fps** via Supabase Broadcast; only if moved >4px (delta compression) | ✅ channel + delta | — |
| F-49 | Presence channel `session:{sessionId}` tracks online/offline per session | ✅ presence setup | — |
| F-50 | Postgres Changes on `task_state` triggers co-op resolution logic client-side | ✅ realtime listener | — |
| F-51 | On reconnect: load last position from `player_positions` table; re-subscribe to all channels; restore sanity | ✅ reconnect handler | — |
| F-52 | Max players per coven enforced contract-side in `joinSession()` | ✅ Solidity require | — |
| F-53 | Max covens per session enforced contract-side in `joinSession()` | ✅ Solidity require | — |

### 1.12 Séance Chat (re-themed from §1.7)
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-54 | In-game séance chat via Supabase Broadcast channel `chat:{sessionId}` — styled as old radio | ✅ broadcast channel | — |
| F-55 | Chat visible only to co-op players (hidden in solo mode) | ✅ conditional render | — |
| F-56 | Chat messages include sender's truncated wallet address and timestamp | ✅ payload design | — |
| F-57 | Chat input dismisses on Escape key; does not interfere with WASD movement | ✅ Phaser key capture | — |

### 1.13 Backend Signer ("The Warden") Service
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| F-58 | `POST /api/sign-escape` verifies 3 puzzle_solved rows for requesting player | ✅ Edge Function | — |
| F-59 | Returns ECDSA-signed escape proof on success | ✅ ethers.js sign | Signer key mgmt |
| F-60 | Returns 403: *"The Warden denies your release."* if puzzles incomplete or player not in session | ✅ validation logic | — |
| F-61 | Signer private key in `SIGNER_PRIVATE_KEY` env var, never exposed client-side | ✅ env design | Key generation |

---

## 2. Non-Functional Requirements

### 2.1 Performance
| ID | Requirement | Target |
|----|-------------|--------|
| NF-01 | Phaser game renders at (with lighting + particles) | ≥ 60fps on desktop Chrome |
| NF-02 | Position sync latency | ≤ 100ms round-trip (Supabase Broadcast) |
| NF-03 | Ward load time (seed → Phaser scene rendered with lighting) | ≤ 4 seconds |
| NF-04 | Contract `startSession()` confirmation | ≤ 2 seconds on Monad testnet |
| NF-05 | Supabase co-op task write → all clients updated | ≤ 200ms |
| NF-06 | Backend signer (Warden) response time | ≤ 500ms |
| NF-07 | Lighting system overhead (flashlight + fog-of-war) | ≤ 3ms/frame on mid-range GPU |
| NF-08 | Particle effects (dust, embers, flies) | ≤ 2ms/frame with 200 active particles |

### 2.2 Security
| ID | Requirement | Agent Can Build | Manual |
|----|-------------|----------------|--------|
| NF-09 | Seed comes from on-chain event only — no client-side injection | ✅ design enforced | — |
| NF-10 | `markEscaped()` requires valid ECDSA signature from The Warden | ✅ ECDSA.recover | Key management |
| NF-11 | Reentrancy guard on all ETH-transfer functions | ✅ OpenZeppelin | Code review |
| NF-12 | Supabase RLS — players can only write rows where `wallet_address = auth.uid()` | ✅ SQL RLS | Policy review |
| NF-13 | Puzzle answers validated server-side via Warden before escape sig issued | ✅ enforced by F-58 | — |
| NF-14 | Sanity cannot be manipulated client-side to skip effects (server validates sanity events) | ✅ server validation | — |
| NF-15 | Jump-scare triggers validated server-side (cannot be skipped or replayed) | ✅ seed-determined | — |

### 2.3 Compatibility
- Desktop browsers: Chrome 110+, Firefox 110+, Safari 16+ (WebGL 2.0 required for lighting)
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
phaser >= 3.x        # game engine (WebGL pipeline for lighting)
next.js >= 14        # frontend framework
wagmi 2.x + viem 2.x # contract interaction
@supabase/supabase-js 2.x
ethers 6.x           # backend signer (The Warden)
typescript 5.x
howler.js             # audio engine for horror atmosphere
```

### 3.2 Environment Variables
```env
# .env.local — fill manually after setup
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_CONTRACT_ADDRESS=      # PH0xBIA contract after deploy
NEXT_PUBLIC_MONAD_RPC_URL=
NEXT_PUBLIC_WALLETCONNECT_ID=
PRIVATE_KEY=                       # deployer wallet — NEVER COMMIT
SIGNER_PRIVATE_KEY=                # The Warden signer — NEVER COMMIT, different from deployer
TREASURY_ADDRESS=                  # where The Asylum's Tithe goes
```

### 3.3 Supabase Setup
- Create project at supabase.com
- Run `supabase/schema.sql` in SQL editor (includes `sanity_events` table)
- Run `supabase/rls.sql` in SQL editor
- Enable Realtime on: `task_state`, `session_players`, `player_positions`, `sanity_events`
- Verify RLS enabled on all tables

---

## 4. Agent Prompting Guide

### Prompt Templates

**PRNG + Ward Generator:**
> "Generate `lib/roomGenerator.ts`. Export `generateWard(seedHex: string, isCoOp: boolean)`. Use mulberry32 PRNG. Return: 3 puzzles from HORROR_PUZZLE_POOL (P1–P6), 2 co-op tasks from OCCULT_COOP_POOL (T1–T4) if isCoOp, array of 12 objects `{id, type, x, y, hasClue: boolean, isScary: boolean, scareType?: string}` within 800×600 bounds (no two within 64px), array of 2–3 ghost patrol paths `{waypoints: {x,y}[], pauseDuration: number}`, array of blackout event timings `{startSec: number, durationSec: number}[]`, and flicker pattern seed. Use horror object types: 'bloodstained_cabinet', 'patient_file', 'shattered_mirror', 'rusted_surgical_tray', 'old_radio', 'medicine_bottle', 'rocking_chair', 'wheelchair'. Export all TypeScript types."

**Smart Contract (PH0xBIA):**
> "Generate Solidity 0.8.24 contract `PH0xBIA.sol`. Uses OpenZeppelin ReentrancyGuard, Ownable, ECDSA. Implements: Session struct with covens mapping, Coven struct with escaped mapping. Functions: `createSession` payable, `joinSession(sessionId, covenId)` payable, `startSession` host-only generating curse seed, `markEscaped(sessionId, bytes wardenSig)` verifying ECDSA from trustedSigner (The Warden), `claimReward(sessionId)` with solo and co-op payout, `expireSession` for timeout, 2.5% Asylum's Tithe to treasury. Emit horror-themed events including `AsylumClaimed`. Full NatSpec."

**Horror Puzzle Components:**
> "Generate 6 React TypeScript components in `components/puzzles/`. Horror-themed dark UI with torn paper textures, blood smears, rusty metal frames. Each accepts `{config: PuzzleConfig, sessionId, playerAddr, onSolve}`. Implement: BloodCipher (ROT), PatientNumbers (Roman), EVPRecording (Morse), BinaryLocks (Binary), RitualSequence (colour candles), PatientAnagram. Wrong answers: screen flash red + distorted error + screen shake. Correct: lock-click + green glow + 'The asylum releases its grip...'. 3-attempt lockout with horror text."

**Sanity System:**
> "Generate `lib/sanity.ts`. Export class `SanityManager` with: initial sanity 100%, drain methods per event type (-5 red herring, -10 ghost, -3 puzzle fail, -8 scare), recovery (+1%/sec idle, +15% puzzle solve). Threshold effects at 75/50/25/0%. At 0%: trigger blackout callback. Track applied effects. Prevent duplicate drain from same source. Export `SanityEffects` React component with vignette, grain, chromatic aberration overlays driven by sanity %. All values configurable."

---

## 5. Deliverables Checklist

### Agent-Generated (zero manual effort)
- [ ] `lib/prng.ts`
- [ ] `lib/roomGenerator.ts` (horror ward generator with ghosts, scares, blackouts)
- [ ] `lib/puzzles/index.ts` (horror-themed validators for all 6)
- [ ] `lib/sanity.ts` (sanity state machine)
- [ ] `lib/lighting.ts` (flashlight, fog-of-war, flickering, blackout logic)
- [ ] `contracts/PH0xBIA.sol` (full contract with session/coven/payout)
- [ ] `contracts/deploy.ts` (Hardhat deploy script)
- [ ] `hooks/useEscapeRoom.ts` (all wagmi hooks, session/coven model)
- [ ] `supabase/schema.sql` (all tables including sanity_events)
- [ ] `supabase/rls.sql`
- [ ] `lib/supabase/channels.ts` (positions, séance chat, sanity, task_state, presence)
- [ ] `app/api/sign-escape/route.ts` (The Warden edge function)
- [ ] `scenes/IntroScene.ts` (asylum intro cutscene)
- [ ] `scenes/GameScene.ts` (horror scene with lighting, fog, sanity, ghosts)
- [ ] `components/puzzles/*.tsx` (all 6 horror-themed puzzle UIs)
- [ ] `components/CoopTaskOverlay.tsx` (all 4 occult task overlays)
- [ ] `components/HUD.tsx` (timer, patient file, sanity bar, coven status, séance chat)
- [ ] `components/SanityEffects.tsx` (vignette, grain, chromatic aberration overlays)
- [ ] `components/JumpScare.tsx` (scare overlay + stinger audio)
- [ ] `components/ChatWidget.tsx` (séance chat styled as old radio)
- [ ] `types/game.ts` (all TypeScript types including horror additions)
- [ ] `scripts/setup-env.sh`

### Manual Tasks (human required)
- [ ] Purchase/create asylum tileset + horror character sprites
- [ ] Create ghost NPC sprites (translucent patient figures)
- [ ] Create jump-scare overlay images (face flash, hand reach, mirror distortion)
- [ ] Record/source horror audio assets (ambient layers, stingers, whispers, heartbeat)
- [ ] Write 20 horror/asylum-themed words for P6 Patient Anagram pool
- [ ] Write horror flavor text for red herring objects (≥ 10 unique texts)
- [ ] Generate signer private key (The Warden) and store securely
- [ ] Set all env vars in `.env.local`
- [ ] Fund deployer wallet with Monad testnet MON
- [ ] Deploy PH0xBIA contract + paste address in env
- [ ] Create Supabase project + run schema + RLS SQL
- [ ] Enable Realtime on `task_state`, `session_players`, `player_positions`, `sanity_events`
- [ ] Decide: minimum stake, maximum covens, treasury address
- [ ] Playtest and tune: sanity drain rates, scare frequency, sync windows, flashlight radius
- [ ] Record atmospheric demo clip for judges

---

## 6. Reward Model — Quick Reference

| Scenario | Winner Gets | Loser Gets |
|----------|------------|------------|
| Solo, 4 patients × 0.05 MON | 0.195 MON (net of 2.5% tithe) | 0 MON |
| Co-op, 2 covens × 3 × 0.05 MON | 0.0975 MON each (net ÷ 3) | 0 MON |
| Co-op, 4 covens × 4 × 0.05 MON | 0.195 MON each (net ÷ 4) | 0 MON |
| Timeout, no winner | Stake refunded minus 2.5% tithe | partial refund |

**Key principle:** The pot is always fully funded by players' own stakes. No external funds. The asylum sustains itself. Larger séance sessions = bigger pots = deeper terror.
