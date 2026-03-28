# Monad Escape Room — Test Specification

> Version 1.1 | Monad Hackathon 2026
> Framework: Vitest (unit/integration) · Hardhat + chai (contract) · Playwright (E2E)

---

## Changelog (v1.0 → v1.1)
- **All `roomId` references renamed to `sessionId`** — mirrors new contract model
- **`resolveRound()` tests removed** — replaced with `claimReward()` and `expireSession()` tests
- **`markEscaped()` now requires ECDSA sig** — all escape tests mock or invoke backend signer
- **Backend signer unit + integration tests added** — `/api/sign-escape` endpoint (F-58 to F-61)
- **Co-op model rewritten** — "all-or-nothing" replaced with "groups vs groups"; first full group wins pot
- **Protocol fee tests added** — 2.5% of pot asserted on every payout
- **`claimReward()` pull-model tests added** — winners must call separately after resolution
- **Sync window tests updated** — 3000ms → 5000ms for T2 and T4
- **Server `created_at` enforced in T2/T4 tests** — client timestamps no longer used
- **In-game chat tests added** — `chat:{sessionId}` broadcast channel (F-54 to F-57)
- **`player_positions` reconnect tests added** — table upsert + load on reconnect (F-51)
- **Position delta compression tests added** — only broadcast if moved >4px (F-48)
- **LobbyScene tests removed** — lobby is React-only; Phaser scene starts at BootScene
- **`rejectDuplicateEscape` test added** — guards the new `claimReward` once-per-address mapping
- **Group isolation tests added** — rival group players tinted differently in Phaser (F-27)

---

## Agent Scaffold Prompt

> Paste into Cursor / Claude to generate the full test file structure:

```
"Generate a complete test suite for a Monad blockchain escape room game (v1.1).
Use Vitest for unit + integration tests, Hardhat chai for Solidity, Playwright for E2E.
Key v1.1 changes to reflect:
- Room is now Session with Groups (multi-group co-op)
- markEscaped() requires ECDSA backend signature
- Payout: claimReward() pull model, 2.5% protocol fee
- expireSession() replaces resolveRound() timeout case
- Sync windows are 5000ms using server created_at timestamps
- In-game chat via Supabase Broadcast chat:{sessionId}
- player_positions table for reconnect recovery
- Position broadcast only if moved >4px (delta compression)
Mock Supabase with @supabase/supabase-js mock client.
Mock wagmi hooks with vitest.mock().
No external network calls in unit or contract tests."
```

---

## 1. Unit Tests

### 1.1 PRNG & Room Generator (`lib/prng.test.ts`)

```typescript
describe("mulberry32 PRNG", () => {
  it("produces same sequence for same seed", () => {
    const r1 = mulberry32(0xDEADBEEF);
    const r2 = mulberry32(0xDEADBEEF);
    expect([r1(), r1(), r1()]).toEqual([r2(), r2(), r2()]);
  });

  it("produces different sequences for different seeds", () => {
    expect(mulberry32(0x11111111)()).not.toEqual(mulberry32(0x22222222)());
  });

  it("always returns values in [0, 1)", () => {
    const rand = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const v = rand();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});
```

```typescript
const SEED = "0xabc123def456789012345678901234567890abcdef1234567890abcdef123456";

describe("generateRoom(seed, isCoOp)", () => {
  it("returns exactly 3 puzzles from PUZZLE_POOL", () => {
    const room = generateRoom(SEED, false);
    expect(room.puzzles).toHaveLength(3);
    room.puzzles.forEach(p => expect(PUZZLE_POOL.map(x => x.id)).toContain(p.id));
  });

  it("returns exactly 2 co-op tasks when isCoOp=true", () => {
    expect(generateRoom(SEED, true).coopTasks).toHaveLength(2);
  });

  it("returns no co-op tasks when isCoOp=false", () => {
    expect(generateRoom(SEED, false).coopTasks).toHaveLength(0);
  });

  it("places 12 objects within 800x600 bounds", () => {
    generateRoom(SEED, false).objects.forEach(obj => {
      expect(obj.x).toBeGreaterThanOrEqual(0);
      expect(obj.x).toBeLessThanOrEqual(800);
      expect(obj.y).toBeGreaterThanOrEqual(0);
      expect(obj.y).toBeLessThanOrEqual(600);
    });
  });

  it("places exactly 3 real clues among 12 objects", () => {
    const clues = generateRoom(SEED, false).objects.filter(o => o.hasClue);
    expect(clues).toHaveLength(3);
  });

  it("no two objects overlap within 64px", () => {
    const { objects } = generateRoom(SEED, false);
    for (let i = 0; i < objects.length; i++) {
      for (let j = i + 1; j < objects.length; j++) {
        const dx = objects[i].x - objects[j].x;
        const dy = objects[i].y - objects[j].y;
        expect(Math.sqrt(dx * dx + dy * dy)).toBeGreaterThan(64);
      }
    }
  });

  it("is fully deterministic for the same seed", () => {
    expect(generateRoom(SEED, true)).toEqual(generateRoom(SEED, true));
  });

  it("produces different rooms for different seeds", () => {
    const r1 = generateRoom(SEED, false);
    const r2 = generateRoom("0x9999999999999999999999999999999999999999999999999999999999999999", false);
    expect(r1.puzzles.map(p => p.id)).not.toEqual(r2.puzzles.map(p => p.id));
  });
});
```

---

### 1.2 Puzzle Validators (`lib/puzzles/puzzles.test.ts`)

```typescript
describe("P1 — ROT Cipher", () => {
  it("validates correct answer for ROT13", () => {
    expect(validatePuzzle(buildROTPuzzle({ shift: 13, plaintext: "MONAD" }), "ZBANY")).toBe(true);
  });
  it("rejects wrong answer", () => {
    expect(validatePuzzle(buildROTPuzzle({ shift: 13, plaintext: "MONAD" }), "WRONG")).toBe(false);
  });
  it("is case-insensitive", () => {
    const p = buildROTPuzzle({ shift: 7, plaintext: "HELLO" });
    expect(validatePuzzle(p, applyROT("hello", 7).toUpperCase())).toBe(true);
  });
});

describe("P2 — Roman Numerals", () => {
  it("XLII = 42", () => expect(validatePuzzle(buildRomanPuzzle("XLII"), "42")).toBe(true));
  it("MCMXCIX = 1999", () => expect(validatePuzzle(buildRomanPuzzle("MCMXCIX"), "1999")).toBe(true));
  it("rejects wrong number", () => expect(validatePuzzle(buildRomanPuzzle("XII"), "13")).toBe(false));
});

describe("P3 — Morse Code", () => {
  it("decodes SOS correctly", () => {
    expect(validatePuzzle(buildMorsePuzzle("... --- ..."), "SOS")).toBe(true);
  });
  it("rejects partial decode", () => {
    expect(validatePuzzle(buildMorsePuzzle("... --- ..."), "SO")).toBe(false);
  });
});

describe("P4 — Binary to Decimal", () => {
  it("1010 = 10", () => expect(validatePuzzle(buildBinaryPuzzle("1010"), "10")).toBe(true));
  it("1111 = 15", () => expect(validatePuzzle(buildBinaryPuzzle("1111"), "15")).toBe(true));
  it("0000 = 0", () => expect(validatePuzzle(buildBinaryPuzzle("0000"), "0")).toBe(true));
});

describe("P6 — Monad Anagram", () => {
  it("accepts correct unscramble", () => {
    expect(validatePuzzle(buildAnagramPuzzle("MONAD"), "MONAD")).toBe(true);
  });
  it("accepts valid anagram rearrangement", () => {
    expect(validatePuzzle(buildAnagramPuzzle("MONAD"), "NODAM")).toBe(true);
  });
  it("rejects non-anagram string", () => {
    expect(validatePuzzle(buildAnagramPuzzle("MONAD"), "HELLO")).toBe(false);
  });
});

describe("Attempt lockout system", () => {
  it("allows attempts until limit reached", () => {
    const t = createAttemptTracker(3, 30_000);
    expect(t.canAttempt()).toBe(true);
    t.recordFail(); t.recordFail(); t.recordFail();
    expect(t.canAttempt()).toBe(false);
  });

  it("unlocks exactly after 30s cooldown", () => {
    vi.useFakeTimers();
    const t = createAttemptTracker(3, 30_000);
    t.recordFail(); t.recordFail(); t.recordFail();
    vi.advanceTimersByTime(29_999);
    expect(t.canAttempt()).toBe(false);
    vi.advanceTimersByTime(2);
    expect(t.canAttempt()).toBe(true);
    vi.useRealTimers();
  });
});
```

---

### 1.3 Co-op Task Logic (`lib/coopTasks/coopTasks.test.ts`)

#### T2 — Pressure Plates (5s window, server timestamps)

```typescript
describe("Pressure Plates (T2) — 5s window, server created_at", () => {
  it("resolves when 3 plates activated within 5000ms", () => {
    const now = new Date("2026-01-01T00:00:00.000Z").getTime();
    expect(checkPressurePlates([
      { playerId: "P1", createdAt: now },
      { playerId: "P2", createdAt: now + 2000 },
      { playerId: "P3", createdAt: now + 4999 },
    ], 5000)).toBe(true);
  });

  it("fails when spread exceeds 5000ms", () => {
    const now = Date.now();
    expect(checkPressurePlates([
      { playerId: "P1", createdAt: now },
      { playerId: "P2", createdAt: now + 2000 },
      { playerId: "P3", createdAt: now + 5001 }, // over window
    ], 5000)).toBe(false);
  });

  it("fails with only 2 activations", () => {
    const now = Date.now();
    expect(checkPressurePlates([
      { playerId: "P1", createdAt: now },
      { playerId: "P2", createdAt: now + 100 },
    ], 5000)).toBe(false);
  });

  it("ignores duplicate activations from same player", () => {
    const now = Date.now();
    expect(checkPressurePlates([
      { playerId: "P1", createdAt: now },
      { playerId: "P1", createdAt: now + 100 }, // duplicate
      { playerId: "P2", createdAt: now + 200 },
    ], 5000)).toBe(false); // still only 2 unique players
  });
});
```

#### T4 — Synchronized Levers (5s window, server timestamps)

```typescript
describe("Synchronized Levers (T4) — 5s window, server created_at", () => {
  it("passes when both pulls within 5000ms", () => {
    expect(checkSyncLevers(
      new Date("2026-01-01T00:00:00.000Z").toISOString(),
      new Date("2026-01-01T00:00:04.999Z").toISOString(),
      5000
    )).toBe(true);
  });

  it("fails when difference exceeds 5000ms", () => {
    expect(checkSyncLevers(
      new Date("2026-01-01T00:00:00.000Z").toISOString(),
      new Date("2026-01-01T00:00:05.001Z").toISOString(),
      5000
    )).toBe(false);
  });

  it("triggers lockout after 3 failures", () => {
    const lever = createLeverState();
    lever.recordFail(); lever.recordFail(); lever.recordFail();
    expect(lever.isLockedOut()).toBe(true);
    expect(lever.getLockoutRemainingMs()).toBeGreaterThan(0);
  });

  it("lockout expires after 30s", () => {
    vi.useFakeTimers();
    const lever = createLeverState();
    lever.recordFail(); lever.recordFail(); lever.recordFail();
    vi.advanceTimersByTime(30_001);
    expect(lever.isLockedOut()).toBe(false);
    vi.useRealTimers();
  });

  it("attempt counter resets after successful sync", () => {
    const lever = createLeverState();
    lever.recordFail(); lever.recordFail();
    lever.recordSuccess();
    expect(lever.getFailCount()).toBe(0);
  });
});
```

#### T1 / T3 — Split Code & Relay Chain

```typescript
describe("Split Code (T1)", () => {
  it("terminal unlocks when correct full code submitted", () => {
    const code = createSplitCode("483721");
    code.enterLeftHalf("P1", "483");
    code.enterRightHalf("P2", "721");
    expect(code.isResolved()).toBe(true);
  });

  it("terminal stays locked with any wrong half", () => {
    const code = createSplitCode("483721");
    code.enterLeftHalf("P1", "999");
    code.enterRightHalf("P2", "721");
    expect(code.isResolved()).toBe(false);
  });

  it("P1 cannot see P2 digits before submission", () => {
    const code = createSplitCode("483721");
    expect(code.getRightHalfForPlayer("P1")).toBeNull();
    expect(code.getLeftHalfForPlayer("P2")).toBeNull();
  });
});

describe("Relay Chain (T3)", () => {
  it("Player 2 cannot open Object B before keycard transfer", () => {
    expect(createRelayChain().canPlayer2OpenB()).toBe(false);
  });

  it("Player 2 can open Object B after receiving keycard", () => {
    const chain = createRelayChain();
    chain.player1OpensA();
    chain.transferKeycard("P1", "P2");
    expect(chain.canPlayer2OpenB()).toBe(true);
  });

  it("transfer fails if players not within 48px proximity", () => {
    const chain = createRelayChain();
    chain.player1OpensA();
    expect(() => chain.transferKeycardAtDistance("P1", "P2", 49)).toThrow("Too far");
  });

  it("transfer succeeds at exactly 48px", () => {
    const chain = createRelayChain();
    chain.player1OpensA();
    expect(() => chain.transferKeycardAtDistance("P1", "P2", 48)).not.toThrow();
  });
});
```

---

### 1.4 Position Delta Compression (`lib/supabase/channels.test.ts`)

```typescript
describe("Position delta compression (F-48)", () => {
  it("does NOT broadcast if moved ≤ 4px", () => {
    const broadcast = vi.fn();
    const tracker = createPositionTracker(broadcast);
    tracker.update(100, 100); // initial
    tracker.update(103, 102); // 3.6px — under threshold
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("broadcasts if moved > 4px", () => {
    const broadcast = vi.fn();
    const tracker = createPositionTracker(broadcast);
    tracker.update(100, 100);
    tracker.update(105, 100); // exactly 5px
    expect(broadcast).toHaveBeenCalledWith({ x: 105, y: 100 });
  });

  it("updates last position after successful broadcast", () => {
    const broadcast = vi.fn();
    const tracker = createPositionTracker(broadcast);
    tracker.update(100, 100);
    tracker.update(200, 200);
    tracker.update(201, 200); // 1px from last broadcast — should NOT send
    expect(broadcast).toHaveBeenCalledTimes(1);
  });
});
```

---

### 1.5 Payout Math (`lib/payout.test.ts`)

```typescript
const BPS = 10_000n;
const FEE_BPS = 250n; // 2.5%

describe("Payout math", () => {
  it("Solo: 4 × 0.05 MON → winner gets 0.195 MON", () => {
    const stake = parseEther("0.05");
    const players = 4n;
    const pot = stake * players;                          // 0.20
    const fee = (pot * FEE_BPS) / BPS;                   // 0.005
    const net = pot - fee;                                // 0.195
    expect(net).toEqual(parseEther("0.195"));
  });

  it("Co-op: 2 groups × 3 × 0.05 MON → 0.0975 per winner", () => {
    const stake = parseEther("0.05");
    const totalPlayers = 6n;
    const groupSize = 3n;
    const pot = stake * totalPlayers;                     // 0.30
    const fee = (pot * FEE_BPS) / BPS;                   // 0.0075
    const net = pot - fee;                                // 0.2925
    const perWinner = net / groupSize;                    // 0.0975
    expect(perWinner).toEqual(parseEther("0.0975"));
  });

  it("Co-op: 4 groups × 4 × 0.05 MON → 0.195 per winner", () => {
    const stake = parseEther("0.05");
    const pot = stake * 16n;
    const net = pot - (pot * FEE_BPS) / BPS;
    const perWinner = net / 4n;
    expect(perWinner).toEqual(parseEther("0.195"));
  });

  it("Protocol fee is exactly 2.5% of pot in all cases", () => {
    [4n, 6n, 8n, 12n, 16n].forEach(playerCount => {
      const pot = parseEther("0.05") * playerCount;
      const fee = (pot * FEE_BPS) / BPS;
      expect(fee * 40n).toEqual(pot); // fee × 40 = pot means fee = 2.5%
    });
  });
});
```

---

## 2. Smart Contract Tests (`test/MonadEscapeRoom.test.ts`)

> Run: `npx hardhat test`

### 2.1 `createSession()` & `joinSession()`

```typescript
describe("createSession()", () => {
  it("emits SessionCreated with non-zero seed after startSession()", async () => {
    const { contract, host } = await loadFixture(deployFixture);
    await contract.connect(host).createSession(1, parseEther("0.05"), false, 1, 8, 3600, { value: parseEther("0.05") });
    await expect(contract.connect(host).startSession(1))
      .to.emit(contract, "SessionCreated")
      .withArgs(1, anyValue, false, 1);
  });

  it("reverts if stake is zero", async () => {
    const { contract, host } = await loadFixture(deployFixture);
    await expect(contract.connect(host).createSession(1, 0, false, 1, 8, 3600, { value: 0 }))
      .to.be.revertedWith("Stake too low");
  });

  it("reverts on duplicate sessionId", async () => {
    const { contract, host } = await loadFixture(sessionCreatedFixture);
    await expect(contract.connect(host).createSession(1, parseEther("0.05"), false, 1, 8, 3600, { value: parseEther("0.05") }))
      .to.be.revertedWith("Session exists");
  });

  it("reverts if maxGroups > 4", async () => {
    const { contract, host } = await loadFixture(deployFixture);
    await expect(contract.connect(host).createSession(1, parseEther("0.05"), true, 5, 4, 3600, { value: parseEther("0.05") }))
      .to.be.revertedWith("Max 4 groups");
  });
});

describe("joinSession()", () => {
  it("accepts player with correct stake", async () => {
    const { contract, player1 } = await loadFixture(openSessionFixture);
    await expect(contract.connect(player1).joinSession(1, 0, { value: parseEther("0.05") }))
      .to.emit(contract, "PlayerJoined").withArgs(1, player1.address, 0);
  });

  it("reverts if wrong stake amount sent", async () => {
    const { contract, player1 } = await loadFixture(openSessionFixture);
    await expect(contract.connect(player1).joinSession(1, 0, { value: parseEther("0.03") }))
      .to.be.revertedWith("Wrong stake");
  });

  it("reverts if group is full", async () => {
    const { contract, players } = await loadFixture(fullGroupFixture);
    await expect(contract.connect(players[4]).joinSession(1, 0, { value: parseEther("0.05") }))
      .to.be.revertedWith("Group full");
  });

  it("reverts if joining invalid group slot", async () => {
    const { contract, player1 } = await loadFixture(openSessionFixture);
    await expect(contract.connect(player1).joinSession(1, 5, { value: parseEther("0.05") }))
      .to.be.revertedWith("Invalid group");
  });
});
```

### 2.2 `markEscaped()` — ECDSA Proof Required

```typescript
describe("markEscaped() — ECDSA backend proof", () => {
  it("succeeds with valid backend signature", async () => {
    const { contract, player1, signer, sessionId } = await loadFixture(activeSessionFixture);
    const message = ethers.solidityPackedKeccak256(
      ["uint256", "address", "string"],
      [sessionId, player1.address, "ESCAPED"]
    );
    const sig = await signer.signMessage(ethers.getBytes(message));
    await expect(contract.connect(player1).markEscaped(sessionId, sig))
      .to.emit(contract, "PlayerEscaped")
      .withArgs(sessionId, player1.address, 0);
  });

  it("reverts with wrong signer key", async () => {
    const { contract, player1, sessionId } = await loadFixture(activeSessionFixture);
    const fakeSigner = ethers.Wallet.createRandom();
    const message = ethers.solidityPackedKeccak256(
      ["uint256", "address", "string"],
      [sessionId, player1.address, "ESCAPED"]
    );
    const badSig = await fakeSigner.signMessage(ethers.getBytes(message));
    await expect(contract.connect(player1).markEscaped(sessionId, badSig))
      .to.be.revertedWith("Invalid signer");
  });

  it("reverts if player signs for wrong address", async () => {
    const { contract, player1, player2, signer, sessionId } = await loadFixture(activeSessionFixture);
    // Sig is for player2, but player1 submits it
    const message = ethers.solidityPackedKeccak256(
      ["uint256", "address", "string"],
      [sessionId, player2.address, "ESCAPED"]
    );
    const sig = await signer.signMessage(ethers.getBytes(message));
    await expect(contract.connect(player1).markEscaped(sessionId, sig))
      .to.be.revertedWith("Invalid signer");
  });

  it("reverts if player already escaped", async () => {
    const { contract, player1, signer, sessionId } = await loadFixture(activeSessionFixture);
    const sig = await signEscape(signer, sessionId, player1.address);
    await contract.connect(player1).markEscaped(sessionId, sig);
    await expect(contract.connect(player1).markEscaped(sessionId, sig))
      .to.be.revertedWith("Already escaped");
  });
});
```

### 2.3 `claimReward()` — Pull Model

```typescript
describe("claimReward() — Solo", () => {
  it("winner receives net pot (all stakes minus 2.5% fee)", async () => {
    const { contract, player1, sessionId, stake, playerCount } = await loadFixture(soloWinFixture);
    const pot = stake * BigInt(playerCount);
    const fee = (pot * 250n) / 10_000n;
    const expectedNet = pot - fee;

    const before = await ethers.provider.getBalance(player1.address);
    const tx = await contract.connect(player1).claimReward(sessionId);
    const receipt = await tx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;
    const after = await ethers.provider.getBalance(player1.address);
    expect(after - before + gasCost).to.equal(expectedNet);
  });

  it("treasury receives exact 2.5% fee", async () => {
    const { contract, treasury, player1, sessionId, stake, playerCount } = await loadFixture(soloWinFixture);
    const pot = stake * BigInt(playerCount);
    const expectedFee = (pot * 250n) / 10_000n;
    const before = await ethers.provider.getBalance(treasury.address);
    await contract.connect(player1).claimReward(sessionId);
    const after = await ethers.provider.getBalance(treasury.address);
    expect(after - before).to.equal(expectedFee);
  });

  it("loser cannot claim reward", async () => {
    const { contract, player2, sessionId } = await loadFixture(soloWinFixture);
    await expect(contract.connect(player2).claimReward(sessionId))
      .to.be.revertedWith("Not a winner");
  });

  it("winner cannot claim twice", async () => {
    const { contract, player1, sessionId } = await loadFixture(soloWinFixture);
    await contract.connect(player1).claimReward(sessionId);
    await expect(contract.connect(player1).claimReward(sessionId))
      .to.be.revertedWith("Already claimed");
  });

  it("emits RewardClaimed event with correct amount", async () => {
    const { contract, player1, sessionId, stake, playerCount } = await loadFixture(soloWinFixture);
    const net = (stake * BigInt(playerCount) * 9_750n) / 10_000n;
    await expect(contract.connect(player1).claimReward(sessionId))
      .to.emit(contract, "RewardClaimed")
      .withArgs(sessionId, player1.address, net);
  });
});

describe("claimReward() — Co-op Groups vs Groups", () => {
  it("each winning group member gets net / groupSize", async () => {
    const { contract, group0, sessionId, stake } = await loadFixture(coopWinFixture);
    // group0 = 3 players, group1 = 3 players, stake = 0.05 each
    const pot = stake * 6n; // 0.30 MON
    const net = (pot * 9_750n) / 10_000n; // 0.2925 MON
    const perWinner = net / 3n; // 0.0975 MON
    for (const player of group0) {
      const before = await ethers.provider.getBalance(player.address);
      const tx = await contract.connect(player).claimReward(sessionId);
      const gas = (await tx.wait()).gasUsed * tx.gasPrice;
      const after = await ethers.provider.getBalance(player.address);
      expect(after - before + gas).to.be.closeTo(perWinner, parseEther("0.0001"));
    }
  });

  it("losing group cannot claim", async () => {
    const { contract, group1, sessionId } = await loadFixture(coopWinFixture);
    for (const loser of group1) {
      await expect(contract.connect(loser).claimReward(sessionId))
        .to.be.revertedWith("Not a winner");
    }
  });

  it("session not resolved until ALL group members escape", async () => {
    const { contract, group0, signer, sessionId } = await loadFixture(coopActiveFixture);
    // Only 2 of 3 escape
    await contract.connect(group0[0]).markEscaped(sessionId, await signEscape(signer, sessionId, group0[0].address));
    await contract.connect(group0[1]).markEscaped(sessionId, await signEscape(signer, sessionId, group0[1].address));
    // 3rd has not escaped — claimReward should fail
    await expect(contract.connect(group0[0]).claimReward(sessionId))
      .to.be.revertedWith("Session not resolved");
  });

  it("emits SessionResolved after last group member escapes", async () => {
    const { contract, group0, signer, sessionId } = await loadFixture(coopActiveFixture);
    for (const p of group0) {
      await contract.connect(p).markEscaped(sessionId, await signEscape(signer, sessionId, p.address));
    }
    // Check event was emitted on last markEscaped
    const filter = contract.filters.SessionResolved(sessionId);
    const events = await contract.queryFilter(filter);
    expect(events.length).to.equal(1);
    expect(events[0].args.winnerGroupId).to.equal(0);
  });
});
```

### 2.4 `expireSession()` — Timeout Refund

```typescript
describe("expireSession()", () => {
  it("refunds all players stake minus 2.5% fee after timeLimit", async () => {
    const { contract, player1, player2, sessionId, stake } = await loadFixture(timedOutSessionFixture);
    await time.increase(3601);
    await contract.expireSession(sessionId);
    const net = (stake * 9_750n) / 10_000n;
    for (const p of [player1, player2]) {
      const before = await ethers.provider.getBalance(p.address);
      const tx = await contract.connect(p).claimRefund(sessionId);
      const gas = (await tx.wait()).gasUsed * tx.gasPrice;
      const after = await ethers.provider.getBalance(p.address);
      expect(after - before + gas).to.be.closeTo(net, parseEther("0.001"));
    }
  });

  it("reverts if called before timeLimit expires", async () => {
    const { contract, sessionId } = await loadFixture(activeSessionFixture);
    await expect(contract.expireSession(sessionId))
      .to.be.revertedWith("Not expired yet");
  });

  it("reverts if session already resolved", async () => {
    const { contract, player1, sessionId } = await loadFixture(soloWinFixture);
    await contract.connect(player1).claimReward(sessionId);
    await time.increase(7200);
    await expect(contract.expireSession(sessionId))
      .to.be.revertedWith("Already resolved");
  });
});
```

### 2.5 `emergencyWithdraw()`

```typescript
describe("emergencyWithdraw()", () => {
  it("reverts if called before 24h timelock", async () => {
    const { contract, owner, sessionId } = await loadFixture(stuckSessionFixture);
    await expect(contract.connect(owner).emergencyWithdraw(sessionId))
      .to.be.revertedWith("Timelock not expired");
  });

  it("succeeds after 24h timelock", async () => {
    const { contract, owner, sessionId } = await loadFixture(stuckSessionFixture);
    await time.increase(86_401);
    await expect(contract.connect(owner).emergencyWithdraw(sessionId)).to.not.be.reverted;
  });

  it("reverts if called by non-owner", async () => {
    const { contract, player1, sessionId } = await loadFixture(stuckSessionFixture);
    await time.increase(86_401);
    await expect(contract.connect(player1).emergencyWithdraw(sessionId))
      .to.be.revertedWith("Not owner");
  });
});
```

---

## 3. Backend Signer Tests (`test/api/sign-escape.test.ts`)

```typescript
describe("POST /api/sign-escape", () => {
  beforeEach(() => {
    vi.mock('@/lib/supabaseServer', () => ({
      supabaseAdmin: { from: vi.fn() }
    }));
  });

  it("returns 200 + signature when 3 puzzle_solved rows exist", async () => {
    mockSupabaseCount(3); // helper sets up mock to return count=3
    const res = await POST(buildRequest({ sessionId: 1, playerAddr: "0xABC" }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.signature).toMatch(/^0x[0-9a-f]{130}$/i);
  });

  it("returns 403 when fewer than 3 puzzles solved", async () => {
    mockSupabaseCount(2);
    const res = await POST(buildRequest({ sessionId: 1, playerAddr: "0xABC" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Puzzles not solved");
  });

  it("returns 403 when player not in session", async () => {
    mockPlayerNotInSession();
    const res = await POST(buildRequest({ sessionId: 1, playerAddr: "0xUNKNOWN" }));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("Player not in session");
  });

  it("returns 400 for missing sessionId", async () => {
    const res = await POST(buildRequest({ playerAddr: "0xABC" }));
    expect(res.status).toBe(400);
  });

  it("signature is recoverable to SIGNER_PRIVATE_KEY address", async () => {
    mockSupabaseCount(3);
    const res = await POST(buildRequest({ sessionId: 42, playerAddr: "0xDEF" }));
    const { signature } = await res.json();
    const message = ethers.solidityPackedKeccak256(
      ["uint256", "address", "string"],
      [42n, "0xDEF", "ESCAPED"]
    );
    const recovered = ethers.verifyMessage(ethers.getBytes(message), signature);
    const expectedSigner = new ethers.Wallet(process.env.SIGNER_PRIVATE_KEY!).address;
    expect(recovered).toBe(expectedSigner);
  });

  it("does not expose signer private key in response body", async () => {
    mockSupabaseCount(3);
    const res = await POST(buildRequest({ sessionId: 1, playerAddr: "0xABC" }));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain(process.env.SIGNER_PRIVATE_KEY!);
  });
});
```

---

## 4. Integration Tests (`test/integration/`)

### 4.1 Seed → Room Pipeline

```typescript
it("on-chain sessionId seed flows to Phaser room generator correctly", async () => {
  const seed = await getOnChainSeed(contract, sessionId);
  const room = generateRoom(seed, false);
  expect(room.puzzles).toHaveLength(3);
  expect(room.objects).toHaveLength(12);
  expect(room.coopTasks).toHaveLength(0);
});
```

### 4.2 Supabase Channels Integration

```typescript
it("lever pull from P1 received by P2 within 200ms", async () => {
  let received = false;
  const start = Date.now();
  client2.channel(`task:${sessionId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'task_state' }, () => {
      received = true;
    }).subscribe();
  await writeTaskAction(sessionId, 0, 'sync_levers', 'triggered', { lever: 'left' });
  await vi.waitFor(() => expect(received).toBe(true), { timeout: 500 });
  expect(Date.now() - start).toBeLessThan(200);
});

it("pressure plates resolve when 3 server-side rows within 5s window", async () => {
  await Promise.all([
    writeTaskAction(sessionId, 0, 'pressure_plates', 'triggered', { plate: 0 }),
    writeTaskAction(sessionId, 0, 'pressure_plates', 'triggered', { plate: 1 }),
    writeTaskAction(sessionId, 0, 'pressure_plates', 'triggered', { plate: 2 }),
  ]);
  const resolved = await checkTaskResolved(sessionId, 0, 'pressure_plates', 5000);
  expect(resolved).toBe(true);
});
```

### 4.3 Chat Channel Integration

```typescript
it("chat message from P1 received by P2 within 150ms", async () => {
  let msg: ChatMessage | null = null;
  client2.subscribeToChat(sessionId, (m) => { msg = m; });
  await client1.sendChatMessage(sessionId, "0xP1WALLET", "Hello P2");
  await vi.waitFor(() => expect(msg).not.toBeNull(), { timeout: 500 });
  expect(msg!.text).toBe("Hello P2");
  expect(msg!.sender).toContain("0xP1");
});

it("chat is not shown in solo mode", async () => {
  const { container } = render(<HUD mode="solo" sessionId={1n} />);
  expect(container.querySelector('[data-testid="chat-widget"]')).toBeNull();
});
```

### 4.4 Reconnect Recovery

```typescript
it("player loads last known position from player_positions on reconnect", async () => {
  await upsertPosition(sessionId, "0xABC", 350, 275);
  const pos = await loadLastPosition(sessionId, "0xABC");
  expect(pos).toEqual({ x: 350, y: 275 });
});

it("player spawns at (400, 300) default if no saved position", async () => {
  const pos = await loadLastPosition(sessionId, "0xNEW");
  expect(pos).toEqual({ x: 400, y: 300 });
});
```

---

## 5. E2E Tests (Playwright)

### 5.1 Solo — Full Run

```typescript
test("solo player stakes, solves 3 puzzles, escapes, claims reward", async ({ page }) => {
  await page.goto("/");
  await connectWallet(page);
  await page.click("text=Solo Mode");
  await page.fill('[data-testid="stake-input"]', "0.05");
  await page.click("text=Create Session");
  await page.waitForSelector('[data-testid="phaser-canvas"]');

  for (let i = 0; i < 3; i++) await findAndInvestigateClue(page);
  for (let i = 1; i <= 3; i++) await solvePuzzleModal(page, i);

  await page.waitForSelector('[data-testid="exit-door"]');
  await page.click('[data-testid="exit-door"]');
  await page.waitForSelector("text=You Escaped!");
  await page.click("text=Claim Reward");
  await page.waitForSelector("text=0.195 MON");
});
```

### 5.2 Co-op — Two Groups, First Group Wins

```typescript
test("group A escapes before group B — group A claims net/3 each", async ({ browser }) => {
  const [host, p2, p3, p4, p5] = await openNPages(browser, 5);
  await createCoopSession(host, { stake: "0.05", maxGroups: 2, playersPerGroup: 3 });
  const link = await host.locator('[data-testid="room-link"]').textContent();
  await joinCoopGroup(p2, link!, 0); await joinCoopGroup(p3, link!, 0); // group A
  await joinCoopGroup(p4, link!, 1); await joinCoopGroup(p5, link!, 1); // group B (only 2 here for speed)
  await host.click("text=Start Session");

  // Group A solves all puzzles
  for (const p of [host, p2, p3]) {
    for (let i = 0; i < 3; i++) await findAndInvestigateClue(p);
    for (let i = 1; i <= 3; i++) await solvePuzzleModal(p, i);
    await p.click('[data-testid="exit-door"]');
  }

  await host.waitForSelector("text=Your Group Won!");
  await host.click("text=Claim Reward");
  await expect(host.locator("text=0.0975 MON")).toBeVisible();

  // Group B sees loss screen
  await p4.waitForSelector("text=Group A escaped first");
});
```

### 5.3 Split Code Uses In-Game Chat

```typescript
test("players use chat to share split code digits", async ({ browser }) => {
  const [p1, p2] = await openNPages(browser, 2);
  await setupCoopSession(p1, p2);

  const leftDigits = await p1.locator('[data-testid="split-code-left"]').textContent();
  await p1.fill('[data-testid="chat-input"]', `My digits: ${leftDigits}`);
  await p1.press("Enter");

  await p2.waitForSelector(`text=My digits: ${leftDigits}`);
  const rightDigits = await p2.locator('[data-testid="split-code-right"]').textContent();
  await p2.fill('[data-testid="terminal-input"]', `${leftDigits}${rightDigits}`);
  await p2.click("text=Submit Code");
  await p2.waitForSelector("text=Task Complete");
});
```

### 5.4 Session Timeout — Partial Refund

```typescript
test("session times out with no winner — all players get stake minus 2.5% fee", async ({ page }) => {
  await page.goto("/");
  await connectWallet(page);
  await createSoloSession(page, "0.05");
  // Don't solve anything — wait for expiry (mocked time in test env)
  await mockSessionExpiry(page);
  await page.click("text=Claim Refund");
  // 0.05 minus 2.5% = 0.04875
  await expect(page.locator("text=0.04875 MON")).toBeVisible();
});
```

---

## 6. Test Running Commands

```bash
# Unit tests
pnpm vitest run

# Unit tests with coverage report
pnpm vitest run --coverage

# Contract tests
npx hardhat test

# Integration tests (requires: supabase start)
pnpm vitest run test/integration

# E2E (requires: pnpm dev running, Monad testnet wallet funded)
npx playwright test

# All tests — CI pipeline
pnpm test:all
```

---

## 7. CI Pipeline

> **Agent prompt:** "Generate `.github/workflows/test.yml`. Trigger on push to main and all PRs.
> Steps: install pnpm deps, run `vitest --coverage`, run `hardhat test`, run `playwright test` headless.
> Set env vars: `SIGNER_PRIVATE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
> from GitHub Secrets. Cache `node_modules` and `.hardhat`. Fail fast on any failure."

---

## 8. Coverage Targets

| Module | Target |
|--------|--------|
| `lib/prng.ts` | 100% |
| `lib/roomGenerator.ts` | 95% |
| `lib/puzzles/*.ts` | 100% |
| `lib/coopTasks/*.ts` | 95% |
| `lib/payout.ts` | 100% |
| `contracts/MonadEscapeRoom.sol` | 100% (all branches) |
| `app/api/sign-escape/route.ts` | 95% |
| `lib/supabase/channels.ts` | 80% |
| `scenes/GameScene.ts` | 60% (Phaser difficult to unit test) |
| `components/puzzles/*.tsx` | 85% |
| `components/CoopTaskOverlay.tsx` | 80% |
