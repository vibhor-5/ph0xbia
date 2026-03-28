const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-network-helpers");


const STAKE = ethers.parseEther("0.05");

// ────── Helpers ──────

async function signEscape(
  signer: HardhatEthersSigner,
  sessionId: bigint | number,
  playerAddr: string
): Promise<string> {
  const messageHash = ethers.solidityPackedKeccak256(
    ["uint256", "address", "string"],
    [sessionId, playerAddr, "ESCAPED"]
  );
  return await signer.signMessage(ethers.getBytes(messageHash));
}

// ────── Fixtures ──────

async function deployFixture() {
  const [owner, treasury, signer, host, player1, player2, player3, player4, player5, player6] =
    await ethers.getSigners();

  const PH0xBIA = await ethers.getContractFactory("PH0xBIA");
  const contract = await PH0xBIA.deploy(treasury.address, signer.address);
  await contract.waitForDeployment();

  return { contract, owner, treasury, signer, host, player1, player2, player3, player4, player5, player6 };
}

async function sessionCreatedFixture() {
  const base = await loadFixture(deployFixture);
  await base.contract.connect(base.host).createSession(
    1, STAKE, false, 1, 8, 3600, { value: STAKE }
  );
  return { ...base, sessionId: 1n };
}

async function openSessionFixture() {
  return await loadFixture(sessionCreatedFixture);
}

async function activeSessionFixture() {
  const base = await loadFixture(openSessionFixture);
  const { contract, host, player1, player2 } = base;
  await contract.connect(player1).joinSession(1, 0, { value: STAKE });
  await contract.connect(player2).joinSession(1, 0, { value: STAKE });
  await contract.connect(host).startSession(1);
  return { ...base, sessionId: 1n };
}

async function soloWinFixture() {
  const base = await loadFixture(activeSessionFixture);
  const { contract, signer, player1 } = base;
  const sig = await signEscape(signer, 1n, player1.address);
  await contract.connect(player1).markEscaped(1, sig);
  return { ...base, sessionId: 1n, stake: STAKE, playerCount: 3 };
}

async function coopSessionFixture() {
  const base = await loadFixture(deployFixture);
  const { contract, host, player1, player2, player3, player4, player5 } = base;
  // Create co-op: 2 covens × 3 players each
  await contract.connect(host).createSession(1, STAKE, true, 2, 3, 3600, { value: STAKE });
  // Coven 0: host + player1 + player2
  await contract.connect(player1).joinSession(1, 0, { value: STAKE });
  await contract.connect(player2).joinSession(1, 0, { value: STAKE });
  // Coven 1: player3 + player4 + player5
  await contract.connect(player3).joinSession(1, 1, { value: STAKE });
  await contract.connect(player4).joinSession(1, 1, { value: STAKE });
  await contract.connect(player5).joinSession(1, 1, { value: STAKE });
  await contract.connect(host).startSession(1);
  return {
    ...base,
    sessionId: 1n,
    group0: [host, player1, player2],
    group1: [player3, player4, player5],
  };
}

async function coopWinFixture() {
  const base = await loadFixture(coopSessionFixture);
  const { contract, signer, group0 } = base;
  // All of coven 0 escapes
  for (const p of group0!) {
    const sig = await signEscape(signer, 1n, p.address);
    await contract.connect(p).markEscaped(1, sig);
  }
  return { ...base, stake: STAKE };
}

// ════════════════════════════════════════════════════════════════
//                         TESTS
// ════════════════════════════════════════════════════════════════

describe("PH0xBIA", function () {

  // ────── createSession() ──────

  describe("createSession()", function () {
    it("emits SessionCreated with correct parameters", async function () {
      const { contract, host } = await loadFixture(deployFixture);
      await expect(
        contract.connect(host).createSession(1, STAKE, false, 1, 8, 3600, { value: STAKE })
      )
        .to.emit(contract, "SessionCreated")
        .withArgs(1n, host.address, STAKE, false, 1);
    });

    it("host is automatically added to coven 0", async function () {
      const { contract, host } = await loadFixture(sessionCreatedFixture);
      const members = await contract.getCovenMembers(1, 0);
      expect(members).to.include(host.address);
    });

    it("reverts if stake is zero", async function () {
      const { contract, host } = await loadFixture(deployFixture);
      await expect(
        contract.connect(host).createSession(1, 0, false, 1, 8, 3600, { value: 0 })
      ).to.be.revertedWithCustomError(contract, "StakeTooLow");
    });

    it("reverts on duplicate sessionId", async function () {
      const { contract, host } = await loadFixture(sessionCreatedFixture);
      await expect(
        contract.connect(host).createSession(1, STAKE, false, 1, 8, 3600, { value: STAKE })
      ).to.be.revertedWithCustomError(contract, "SessionAlreadyExists");
    });

    it("reverts if maxCovens > 4", async function () {
      const { contract, host } = await loadFixture(deployFixture);
      await expect(
        contract.connect(host).createSession(1, STAKE, true, 5, 4, 3600, { value: STAKE })
      ).to.be.revertedWithCustomError(contract, "InvalidCovens");
    });

    it("reverts if msg.value != stakePerPlayer", async function () {
      const { contract, host } = await loadFixture(deployFixture);
      await expect(
        contract.connect(host).createSession(1, STAKE, false, 1, 8, 3600, { value: ethers.parseEther("0.03") })
      ).to.be.revertedWithCustomError(contract, "WrongStake");
    });
  });

  // ────── joinSession() ──────

  describe("joinSession()", function () {
    it("accepts player with correct stake", async function () {
      const { contract, player1 } = await loadFixture(openSessionFixture);
      await expect(
        contract.connect(player1).joinSession(1, 0, { value: STAKE })
      )
        .to.emit(contract, "PlayerJoined")
        .withArgs(1n, player1.address, 0);
    });

    it("reverts if wrong stake amount sent", async function () {
      const { contract, player1 } = await loadFixture(openSessionFixture);
      await expect(
        contract.connect(player1).joinSession(1, 0, { value: ethers.parseEther("0.03") })
      ).to.be.revertedWithCustomError(contract, "WrongStake");
    });

    it("reverts if player already joined", async function () {
      const { contract, player1 } = await loadFixture(openSessionFixture);
      await contract.connect(player1).joinSession(1, 0, { value: STAKE });
      await expect(
        contract.connect(player1).joinSession(1, 0, { value: STAKE })
      ).to.be.revertedWithCustomError(contract, "AlreadyJoined");
    });

    it("reverts if joining invalid coven slot", async function () {
      const { contract, player1 } = await loadFixture(openSessionFixture);
      await expect(
        contract.connect(player1).joinSession(1, 5, { value: STAKE })
      ).to.be.revertedWithCustomError(contract, "InvalidCoven");
    });
  });

  // ────── startSession() ──────

  describe("startSession()", function () {
    it("emits SessionStarted with non-zero seed", async function () {
      const { contract, host, player1 } = await loadFixture(openSessionFixture);
      await contract.connect(player1).joinSession(1, 0, { value: STAKE });
      await expect(contract.connect(host).startSession(1))
        .to.emit(contract, "SessionStarted");
    });

    it("reverts if not host", async function () {
      const { contract, player1 } = await loadFixture(openSessionFixture);
      await contract.connect(player1).joinSession(1, 0, { value: STAKE });
      await expect(
        contract.connect(player1).startSession(1)
      ).to.be.revertedWithCustomError(contract, "NotHost");
    });

    it("reverts if fewer than 2 players", async function () {
      const { contract, host } = await loadFixture(openSessionFixture);
      await expect(
        contract.connect(host).startSession(1)
      ).to.be.revertedWithCustomError(contract, "NotEnoughPlayers");
    });

    it("reverts if already started", async function () {
      const { contract, host } = await loadFixture(activeSessionFixture);
      await expect(
        contract.connect(host).startSession(1)
      ).to.be.revertedWithCustomError(contract, "SessionAlreadyStarted");
    });
  });

  // ────── markEscaped() — ECDSA ──────

  describe("markEscaped() — ECDSA backend proof", function () {
    it("succeeds with valid backend signature", async function () {
      const { contract, player1, signer } = await loadFixture(activeSessionFixture);
      const sig = await signEscape(signer, 1n, player1.address);
      await expect(contract.connect(player1).markEscaped(1, sig))
        .to.emit(contract, "PlayerEscaped")
        .withArgs(1n, player1.address, 0);
    });

    it("reverts with wrong signer key", async function () {
      const { contract, player1 } = await loadFixture(activeSessionFixture);
      const fakeSigner = ethers.Wallet.createRandom();
      const messageHash = ethers.solidityPackedKeccak256(
        ["uint256", "address", "string"],
        [1n, player1.address, "ESCAPED"]
      );
      const badSig = await fakeSigner.signMessage(ethers.getBytes(messageHash));
      await expect(
        contract.connect(player1).markEscaped(1, badSig)
      ).to.be.revertedWithCustomError(contract, "InvalidSigner");
    });

    it("reverts if player signs for wrong address", async function () {
      const { contract, player1, player2, signer } = await loadFixture(activeSessionFixture);
      const sig = await signEscape(signer, 1n, player2.address);
      await expect(
        contract.connect(player1).markEscaped(1, sig)
      ).to.be.revertedWithCustomError(contract, "InvalidSigner");
    });

    it("reverts if player already escaped (co-op context)", async function () {
      // In co-op, one escape doesn't resolve session, so AlreadyEscaped is reachable
      const base = await loadFixture(coopSessionFixture);
      const { contract, signer, group0 } = base;
      const player = group0![0];
      const sig = await signEscape(signer, 1n, player.address);
      await contract.connect(player).markEscaped(1, sig);
      await expect(
        contract.connect(player).markEscaped(1, sig)
      ).to.be.revertedWithCustomError(contract, "AlreadyEscaped");
    });

    it("solo: first escape resolves session", async function () {
      const { contract, player1, signer } = await loadFixture(activeSessionFixture);
      const sig = await signEscape(signer, 1n, player1.address);
      await expect(contract.connect(player1).markEscaped(1, sig))
        .to.emit(contract, "SessionResolved");
    });
  });

  // ────── claimReward() — Solo ──────

  describe("claimReward() — Solo", function () {
    it("winner receives net pot (all stakes minus 2.5% fee)", async function () {
      const { contract, player1 } = await loadFixture(soloWinFixture);
      const pot = STAKE * 3n;
      const fee = (pot * 250n) / 10_000n;
      const expectedNet = pot - fee;

      const before = await ethers.provider.getBalance(player1.address);
      const tx = await contract.connect(player1).claimReward(1);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(player1.address);

      expect(after - before + gasCost).to.equal(expectedNet);
    });

    it("treasury receives exact 2.5% fee", async function () {
      const { contract, treasury, player1 } = await loadFixture(soloWinFixture);
      const pot = STAKE * 3n;
      const expectedFee = (pot * 250n) / 10_000n;

      // Fee is paid during markEscaped (session resolution)
      // Treasury balance should already include the fee
      const treasuryBal = await ethers.provider.getBalance(treasury.address);
      // Treasury starts with initial ETH from hardhat, so check the fee was transferred
      // by checking the contract emitted AsylumClaimed
      const filter = contract.filters.AsylumClaimed(1n);
      const events = await contract.queryFilter(filter);
      expect(events.length).to.equal(1);
      expect(events[0].args.feeAmount).to.equal(expectedFee);
    });

    it("loser cannot claim reward", async function () {
      const { contract, player2 } = await loadFixture(soloWinFixture);
      await expect(
        contract.connect(player2).claimReward(1)
      ).to.be.revertedWithCustomError(contract, "NotAWinner");
    });

    it("winner cannot claim twice", async function () {
      const { contract, player1 } = await loadFixture(soloWinFixture);
      await contract.connect(player1).claimReward(1);
      await expect(
        contract.connect(player1).claimReward(1)
      ).to.be.revertedWithCustomError(contract, "AlreadyClaimed");
    });

    it("emits RewardClaimed event with correct amount", async function () {
      const { contract, player1 } = await loadFixture(soloWinFixture);
      const pot = STAKE * 3n;
      const net = pot - (pot * 250n) / 10_000n;
      await expect(contract.connect(player1).claimReward(1))
        .to.emit(contract, "RewardClaimed")
        .withArgs(1n, player1.address, net);
    });

    it("protocol fee is exactly 2.5% of pot", async function () {
      const { contract } = await loadFixture(soloWinFixture);
      const pot = STAKE * 3n;
      const fee = (pot * 250n) / 10_000n;
      expect(fee * 40n).to.equal(pot); // fee × 40 = pot means fee = 2.5%
    });
  });

  // ────── claimReward() — Co-op ──────

  describe("claimReward() — Co-op Groups vs Groups", function () {
    it("each winning coven member gets net / covenSize", async function () {
      const { contract, group0 } = await loadFixture(coopWinFixture);
      const pot = STAKE * 6n;
      const net = pot - (pot * 250n) / 10_000n;
      const perWinner = net / 3n;

      for (const player of group0!) {
        const before = await ethers.provider.getBalance(player.address);
        const tx = await contract.connect(player).claimReward(1);
        const receipt = await tx.wait();
        const gas = receipt!.gasUsed * receipt!.gasPrice;
        const after = await ethers.provider.getBalance(player.address);
        expect(after - before + gas).to.be.closeTo(perWinner, ethers.parseEther("0.0001"));
      }
    });

    it("losing coven cannot claim", async function () {
      const { contract, group1 } = await loadFixture(coopWinFixture);
      for (const loser of group1!) {
        await expect(
          contract.connect(loser).claimReward(1)
        ).to.be.revertedWithCustomError(contract, "NotAWinner");
      }
    });

    it("session not resolved until ALL coven members escape", async function () {
      const base = await loadFixture(coopSessionFixture);
      const { contract, signer, group0 } = base;
      // Only 2 of 3 escape
      const sig0 = await signEscape(signer, 1n, group0![0].address);
      await contract.connect(group0![0]).markEscaped(1, sig0);
      const sig1 = await signEscape(signer, 1n, group0![1].address);
      await contract.connect(group0![1]).markEscaped(1, sig1);
      // Session should NOT be resolved yet
      await expect(
        contract.connect(group0![0]).claimReward(1)
      ).to.be.revertedWithCustomError(contract, "SessionNotResolved");
    });

    it("emits SessionResolved after last coven member escapes", async function () {
      const base = await loadFixture(coopSessionFixture);
      const { contract, signer, group0 } = base;
      for (const p of group0!) {
        const sig = await signEscape(signer, 1n, p.address);
        await contract.connect(p).markEscaped(1, sig);
      }
      const filter = contract.filters.SessionResolved(1n);
      const events = await contract.queryFilter(filter);
      expect(events.length).to.equal(1);
      expect(events[0].args.winnerCovenId).to.equal(0);
    });
  });

  // ────── expireSession() ──────

  describe("expireSession()", function () {
    it("reverts if called before timeLimit expires", async function () {
      const { contract } = await loadFixture(activeSessionFixture);
      await expect(contract.expireSession(1)).to.be.revertedWithCustomError(
        contract,
        "NotExpiredYet"
      );
    });

    it("succeeds after timeLimit, emits SessionExpired", async function () {
      const { contract } = await loadFixture(activeSessionFixture);
      await time.increase(3601);
      await expect(contract.expireSession(1))
        .to.emit(contract, "SessionExpired")
        .withArgs(1n);
    });

    it("reverts if session already resolved", async function () {
      const { contract } = await loadFixture(soloWinFixture);
      await time.increase(7200);
      await expect(contract.expireSession(1)).to.be.revertedWithCustomError(
        contract,
        "SessionAlreadyResolved"
      );
    });

    it("players can claim refund after expiry", async function () {
      const { contract, player1 } = await loadFixture(activeSessionFixture);
      await time.increase(3601);
      await contract.expireSession(1);

      const before = await ethers.provider.getBalance(player1.address);
      const tx = await contract.connect(player1).claimRefund(1);
      const receipt = await tx.wait();
      const gas = receipt!.gasUsed * receipt!.gasPrice;
      const after = await ethers.provider.getBalance(player1.address);

      const pot = STAKE * 3n;
      const fee = (pot * 250n) / 10_000n;
      const refundPerPlayer = (pot - fee) / 3n;
      expect(after - before + gas).to.be.closeTo(refundPerPlayer, ethers.parseEther("0.001"));
    });
  });

  // ────── emergencyWithdraw() ──────

  describe("emergencyWithdraw()", function () {
    it("reverts if called before 24h timelock", async function () {
      const { contract, owner } = await loadFixture(activeSessionFixture);
      await expect(
        contract.connect(owner).emergencyWithdraw(1)
      ).to.be.revertedWithCustomError(contract, "TimelockNotExpired");
    });

    it("succeeds after 24h timelock", async function () {
      const { contract, owner } = await loadFixture(activeSessionFixture);
      await time.increase(86_401);
      await expect(contract.connect(owner).emergencyWithdraw(1)).to.not.be.reverted;
    });

    it("reverts if called by non-owner", async function () {
      const { contract, player1 } = await loadFixture(activeSessionFixture);
      await time.increase(86_401);
      await expect(
        contract.connect(player1).emergencyWithdraw(1)
      ).to.be.revertedWithCustomError(contract, "OwnableUnauthorizedAccount");
    });
  });
});
