# PH0xBIA — Implementation Plan (3-Developer Split)

> Monad Hackathon 2026 · Horror-themed on-chain escape room

---

## Developer Assignments

| Dev | Focus Area | Key Deliverables |
|-----|-----------|-----------------|
| **Dev 1 — Chain & Backend** | Smart contract, deploy, backend signer, Supabase, wagmi hooks | `PH0xBIA.sol`, The Warden API, DB schema, channels, hooks |
| **Dev 2 — Game Engine** | Phaser scenes, lighting, fog-of-war, ghost NPCs, audio, multiplayer sync | All scenes + managers, position sync, particles |
| **Dev 3 — Frontend & Logic** | Next.js app, puzzles, co-op overlays, HUD, sanity, PRNG, room generator | Landing, lobby, all UI components, game logic libs |

---

## Dev 1 — Chain & Backend

#### [NEW] [PH0xBIA.sol](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/contracts/PH0xBIA.sol)
- Session/Coven structs, `createSession()`, `joinSession()`, `startSession()` (curse seed)
- `markEscaped()` with ECDSA (The Warden), `claimReward()` (solo + co-op), `expireSession()`, `emergencyWithdraw()`
- 2.5% Asylum's Tithe, all events

#### [NEW] [deploy.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/contracts/deploy.ts)
- Hardhat deploy script for Monad testnet

#### [NEW] [MonadEscapeRoom.test.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/test/MonadEscapeRoom.test.ts)
- Full contract test suite (create, join, escape, claim, expire, emergency)

#### [NEW] [schema.sql](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/supabase/schema.sql)
- Tables: `sessions`, `session_covens`, `session_players`, `task_state`, `player_positions`, `sanity_events`

#### [NEW] [rls.sql](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/supabase/rls.sql)

#### [NEW] [sign-escape/route.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/app/api/sign-escape/route.ts)
- The Warden — verify 3 puzzles solved, return ECDSA sig

#### [NEW] [channels.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/lib/supabase/channels.ts)
- Presence, position broadcast (>4px delta), chat, sanity, task_state listeners

#### [NEW] [useEscapeRoom.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/hooks/useEscapeRoom.ts)
- All wagmi hooks: create/join/start session, escape, claim, expire, read seed/state

#### [NEW] [setup-env.sh](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scripts/setup-env.sh)

---

## Dev 2 — Game Engine

#### [NEW] [BootScene.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/BootScene.ts) / [PreloadScene.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/PreloadScene.ts)
- Asset loading, horror-themed loading bar

#### [NEW] [IntroScene.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/IntroScene.ts)
- 5-second asylum hallway pan + text overlay

#### [NEW] [GameScene.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/GameScene.ts)
- Main orchestrator: tilemap, player (WASD + click-to-walk), hotspots, remote phantom rendering

#### [NEW] [ResultScene.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/ResultScene.ts)
- Win / Loss / Timeout screens with horror atmosphere

#### [NEW] [LightingManager.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/managers/LightingManager.ts)
- Flashlight (128px/192px), flickering, blackout events

#### [NEW] [FogOfWarManager.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/managers/FogOfWarManager.ts)
- Unexplored = black, minimap fog overlay

#### [NEW] [GhostNPCManager.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/managers/GhostNPCManager.ts)
- 2–3 ghosts, seed-determined patrols, wall-phasing, sanity drain on contact (-10%, 2s slow)

#### [NEW] [AudioManager.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/managers/AudioManager.ts)
- Ambient layers, proximity whispers/heartbeat, stingers, co-op radio static

#### [NEW] [ParticleManager.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/scenes/managers/ParticleManager.ts)
- Dust, embers, flies, dripping water

#### Multiplayer Sync (in GameScene)
- Remote phantoms (blue = same coven, red = rival), 10fps delta broadcast, reconnect recovery

---

## Dev 3 — Frontend & Game Logic

#### [NEW] [game.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/types/game.ts)
- All shared TypeScript types (Session, Coven, WardConfig, PuzzleConfig, SanityState, GhostPath, etc.)

> [!IMPORTANT]
> **Must be delivered Day 1** — both other devs depend on these types.

#### [NEW] [prng.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/lib/prng.ts)
- mulberry32 + seeded helpers (pick, shuffle, float, int)

#### [NEW] [roomGenerator.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/lib/roomGenerator.ts)
- `generateWard(seedHex, isCoOp)` → puzzles, tasks, horror objects, ghost paths, scares, blackouts

#### [NEW] [sanity.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/lib/sanity.ts)
- SanityManager: drain/recover, threshold effects at 75/50/25/0%, configurable rates

#### [NEW] [puzzles/index.ts](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/lib/puzzles/index.ts)
- All 6 validators: BloodCipher, PatientNumbers, EVPRecording, BinaryLocks, RitualSequence, PatientAnagram

#### [NEW] [app/page.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/app/page.tsx)
- Landing: "ASHWORTH ASYLUM" — fog, lightning, glitchy title, rusted connect button

#### [NEW] [app/lobby/page.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/app/lobby/page.tsx)
- Solo/co-op session creation & join flow

#### [NEW] [app/layout.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/app/layout.tsx)
- Dark horror theme, Creepster + Inter fonts, wagmi/RainbowKit providers

#### [NEW] [components/puzzles/*.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/components/puzzles/)
- 6 horror puzzle UIs: grimy aesthetic, blood/rust, wrong=red flash, correct=green glow, 30s lockout

#### [NEW] [CoopTaskOverlay.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/components/CoopTaskOverlay.tsx)
- Whisper Code, Séance Circle, Possessed Relay, Blood Ritual Levers

#### [NEW] [HUD.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/components/HUD.tsx)
- Sanity bar, timer (clock face), patient file, coven status, minimap

#### [NEW] [SanityEffects.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/components/SanityEffects.tsx) / [JumpScare.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/components/JumpScare.tsx)
- Vignette, grain, chromatic aberration overlays; scare overlay + stinger

#### [NEW] [ChatWidget.tsx](file:///Users/vibhorkumar/Desktop/codes/PH0xBIA/components/ChatWidget.tsx)
- Séance chat (old radio style, co-op only)

---

## Dependency Graph

```mermaid
graph TD
    D3_Types["Dev 3: types/game.ts ⚡ DAY 1"] --> D3_PRNG["Dev 3: PRNG + Room Generator"]
    D3_Types --> D3_Sanity["Dev 3: Sanity Manager"]
    D3_Types --> D3_Puzzles["Dev 3: Puzzle Validators"]
    D3_Types --> D1_Contract["Dev 1: PH0xBIA.sol"]
    D3_Types --> D2_Scenes["Dev 2: Phaser Scenes"]
    
    D1_Contract --> D1_Hooks["Dev 1: wagmi Hooks"]
    D1_Schema["Dev 1: Supabase Schema"] --> D1_Channels["Dev 1: Channels"]
    D1_Schema --> D1_Warden["Dev 1: The Warden API"]
    
    D3_PRNG --> D2_GameScene["Dev 2: GameScene"]
    D3_Sanity --> D2_GameScene
    D1_Channels --> D2_GameScene
    D1_Hooks --> D3_Lobby["Dev 3: Lobby UI"]
    
    D3_Puzzles --> D3_PuzzleUI["Dev 3: Puzzle Components"]

    style D3_Types fill:#2d6a4f,color:#fff
    style D1_Contract fill:#8b0000,color:#fff
    style D2_GameScene fill:#16213e,color:#fff
```

---

## Verification Plan

### Automated Tests
```bash
npx hardhat test                    # Contract tests (Dev 1)
pnpm vitest run                     # Unit: PRNG, puzzles, sanity, payout (Dev 3)
pnpm vitest run test/integration    # Supabase channels (Dev 1, requires: supabase start)
npx playwright test                 # E2E full flow (all devs)
```

### Manual Verification
1. Deploy to Monad testnet → create session → join → escape → claim reward → verify balances
2. GameScene in browser → confirm flashlight, fog, ghosts, ambient audio
3. Interact with red herrings → confirm sanity effects at 75/50/25/0%
4. Solve each puzzle type → verify horror UI, lockout, feedback
5. Two browsers, co-op Séance Circle → verify 5s sync window
6. Full solo flow: start → investigate → solve 3 puzzles → escape → claim on-chain
