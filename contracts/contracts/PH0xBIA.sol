// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

/**
 * @title PH0xBIA — Haunted Escape Room
 * @notice Stake-based multiplayer escape room on Monad.
 *         Players stake MON, solve horror puzzles in seed-generated asylum wards,
 *         and race to escape. Winner takes the pot minus 2.5% Asylum's Tithe.
 * @dev    Escape proofs are ECDSA-signed by The Warden (trusted backend signer).
 */
contract PH0xBIA is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;
    using MessageHashUtils for bytes32;

    // ──────── Constants ────────
    uint256 public constant PROTOCOL_FEE_BPS = 250;   // 2.5%
    uint256 public constant BPS = 10_000;
    uint256 public constant EMERGENCY_TIMELOCK = 24 hours;
    uint8   public constant MAX_COVENS = 4;
    uint8   public constant MAX_PLAYERS_PER_COVEN = 4;

    // ──────── State ────────
    address public treasury;        // The Asylum Vault — receives protocol fees
    address public trustedSigner;   // The Warden — backend ECDSA signer

    struct Coven {
        address[] members;
        mapping(address => bool) escaped;
        uint8 escapedCount;
        bool won;
    }

    struct Session {
        address host;               // The Summoner
        uint256 stakePerPlayer;     // Blood offering per player
        bytes32 seed;               // Curse Seed (set on start)
        bool isCoOp;
        uint8 maxCovens;
        uint8 maxPlayersPerCoven;
        uint256 startTime;
        uint256 timeLimit;          // Duration in seconds
        bool resolved;
        bool expired;
        address winner;             // Solo: winning player
        uint8 winnerCovenId;        // Co-op: winning coven index
        uint8 covenCount;
        uint256 totalPlayers;
        bool feePaid;
        mapping(uint8 => Coven) covens;
        mapping(address => uint8) playerCoven;   // player => covenId
        mapping(address => bool) isPlayer;
        mapping(address => bool) hasEscaped;
        mapping(address => bool) hasClaimed;
    }

    mapping(uint256 => Session) private sessions;
    mapping(uint256 => bool) public sessionExists;

    // ──────── Events ────────
    event SessionCreated(
        uint256 indexed sessionId,
        address indexed host,
        uint256 stakePerPlayer,
        bool isCoOp,
        uint8 maxCovens
    );
    event PlayerJoined(uint256 indexed sessionId, address indexed player, uint8 covenId);
    event SessionStarted(uint256 indexed sessionId, bytes32 curseSeed, uint256 startTime);
    event PlayerEscaped(uint256 indexed sessionId, address indexed player, uint8 covenId);
    event SessionResolved(uint256 indexed sessionId, bool isCoOp, uint8 winnerCovenId, uint256 netPayout);
    event RewardClaimed(uint256 indexed sessionId, address indexed player, uint256 amount);
    event AsylumClaimed(uint256 indexed sessionId, uint256 feeAmount);
    event SessionExpired(uint256 indexed sessionId);
    event EmergencyWithdraw(uint256 indexed sessionId, uint256 amount);

    // ──────── Errors ────────
    error SessionAlreadyExists();
    error StakeTooLow();
    error InvalidCovens();
    error InvalidPlayersPerCoven();
    error WrongStake();
    error SessionNotFound();
    error SessionAlreadyStarted();
    error SessionNotStarted();
    error InvalidCoven();
    error CovenFull();
    error AlreadyJoined();
    error NotHost();
    error NotEnoughPlayers();
    error InvalidSigner();
    error AlreadyEscaped();
    error SessionAlreadyResolved();
    error SessionNotResolved();
    error NotAWinner();
    error AlreadyClaimed();
    error NotExpiredYet();
    error TimelockNotExpired();

    constructor(address _treasury, address _trustedSigner) Ownable(msg.sender) {
        require(_treasury != address(0), "Invalid treasury");
        require(_trustedSigner != address(0), "Invalid signer");
        treasury = _treasury;
        trustedSigner = _trustedSigner;
    }

    // ════════════════════════════════════════════════════════════════
    //                      SESSION MANAGEMENT
    // ════════════════════════════════════════════════════════════════

    /**
     * @notice Create a new escape session. Host joins coven 0 automatically.
     * @param sessionId       Unique session identifier
     * @param stakePerPlayer  MON required per player (msg.value must match)
     * @param isCoOp          True for coven-vs-coven mode
     * @param maxCovens       Number of covens (1 for solo, 2-4 for co-op)
     * @param maxPlayersPerCoven Max members per coven
     * @param timeLimitSec    Game duration in seconds
     */
    function createSession(
        uint256 sessionId,
        uint256 stakePerPlayer,
        bool isCoOp,
        uint8 maxCovens,
        uint8 maxPlayersPerCoven,
        uint256 timeLimitSec
    ) external payable {
        if (sessionExists[sessionId]) revert SessionAlreadyExists();
        if (stakePerPlayer == 0) revert StakeTooLow();
        if (msg.value != stakePerPlayer) revert WrongStake();
        if (maxCovens == 0 || maxCovens > MAX_COVENS) revert InvalidCovens();
        if (!isCoOp) {
            // Solo: single coven (coven 0), all players compete individually
            maxCovens = 1;
            if (maxPlayersPerCoven == 0 || maxPlayersPerCoven > 8) revert InvalidPlayersPerCoven();
        } else {
            if (maxPlayersPerCoven == 0 || maxPlayersPerCoven > MAX_PLAYERS_PER_COVEN) revert InvalidPlayersPerCoven();
        }

        sessionExists[sessionId] = true;
        Session storage s = sessions[sessionId];
        s.host = msg.sender;
        s.stakePerPlayer = stakePerPlayer;
        s.isCoOp = isCoOp;
        s.maxCovens = maxCovens;
        s.maxPlayersPerCoven = maxPlayersPerCoven;
        s.timeLimit = timeLimitSec;
        s.covenCount = maxCovens;

        // Host auto-joins coven 0
        _addPlayerToCoven(sessionId, s, msg.sender, 0);

        emit SessionCreated(sessionId, msg.sender, stakePerPlayer, isCoOp, maxCovens);
    }

    /**
     * @notice Join an existing session into a specific coven.
     * @param sessionId  Session to join
     * @param covenId    Coven slot (0-indexed)
     */
    function joinSession(uint256 sessionId, uint8 covenId) external payable {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];
        if (s.startTime != 0) revert SessionAlreadyStarted();
        if (msg.value != s.stakePerPlayer) revert WrongStake();
        if (covenId >= s.maxCovens) revert InvalidCoven();
        if (s.isPlayer[msg.sender]) revert AlreadyJoined();

        _addPlayerToCoven(sessionId, s, msg.sender, covenId);
    }

    /**
     * @notice Host starts the session, locking stakes and generating the curse seed.
     * @param sessionId  Session to start
     */
    function startSession(uint256 sessionId) external {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];
        if (msg.sender != s.host) revert NotHost();
        if (s.startTime != 0) revert SessionAlreadyStarted();
        // The host always auto-joins on createSession, so totalPlayers >= 1
        // is guaranteed. Any session — solo or co-op — can be started by the
        // host alone. Co-op rooms simply won't have rival covens if others
        // haven't joined yet, which is fine for single-player use.

        s.seed = keccak256(abi.encodePacked(sessionId, block.prevrandao));
        s.startTime = block.timestamp;

        emit SessionStarted(sessionId, s.seed, block.timestamp);
    }

    // ════════════════════════════════════════════════════════════════
    //                      ESCAPE & REWARD
    // ════════════════════════════════════════════════════════════════

    /**
     * @notice Submit a Warden-signed escape proof.
     * @dev    Verifies ECDSA signature: keccak256(sessionId, msg.sender, "ESCAPED")
     * @param sessionId   Session to escape from
     * @param wardenSig   ECDSA signature from The Warden backend
     */
    function markEscaped(uint256 sessionId, bytes calldata wardenSig) external {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];

        // Solo sessions that were created without an explicit startSession call
        // (the single-player fast-track flow) are auto-started here so the
        // on-chain escape proof and reward claim still work correctly.
        if (s.startTime == 0) {
            if (s.isCoOp) revert SessionNotStarted(); // co-op must call startSession explicitly
            s.seed = keccak256(abi.encodePacked(sessionId, block.prevrandao));
            s.startTime = block.timestamp;
            emit SessionStarted(sessionId, s.seed, block.timestamp);
        }
        if (s.resolved || s.expired) revert SessionAlreadyResolved();
        if (!s.isPlayer[msg.sender]) revert NotAWinner(); // reuse: player not in session
        if (s.hasEscaped[msg.sender]) revert AlreadyEscaped();

        // Verify The Warden's signature
        bytes32 messageHash = keccak256(abi.encodePacked(sessionId, msg.sender, "ESCAPED"));
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();
        address recovered = ethSignedHash.recover(wardenSig);
        if (recovered != trustedSigner) revert InvalidSigner();

        s.hasEscaped[msg.sender] = true;
        uint8 covenId = s.playerCoven[msg.sender];
        Coven storage coven = s.covens[covenId];
        coven.escaped[msg.sender] = true;
        coven.escapedCount++;

        emit PlayerEscaped(sessionId, msg.sender, covenId);

        // Check resolution
        if (!s.isCoOp) {
            // Solo: first to escape wins
            s.resolved = true;
            s.winner = msg.sender;
            s.winnerCovenId = 0;
            _payFee(sessionId, s);
            emit SessionResolved(sessionId, false, 0, _getNetPayout(s));
        } else {
            // Co-op: check if entire coven has escaped
            if (coven.escapedCount == uint8(coven.members.length)) {
                s.resolved = true;
                coven.won = true;
                s.winnerCovenId = covenId;
                _payFee(sessionId, s);
                emit SessionResolved(sessionId, true, covenId, _getNetPayout(s));
            }
        }
    }

    /**
     * @notice Winner(s) pull their reward after session is resolved.
     * @param sessionId  The resolved session
     */
    function claimReward(uint256 sessionId) external nonReentrant {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];
        if (!s.resolved) revert SessionNotResolved();
        if (s.hasClaimed[msg.sender]) revert AlreadyClaimed();

        uint256 payout;
        if (!s.isCoOp) {
            // Solo: only the winner can claim
            if (msg.sender != s.winner) revert NotAWinner();
            payout = _getNetPayout(s);
        } else {
            // Co-op: only winning coven members can claim
            Coven storage winCoven = s.covens[s.winnerCovenId];
            bool isMember = false;
            for (uint256 i = 0; i < winCoven.members.length; i++) {
                if (winCoven.members[i] == msg.sender) {
                    isMember = true;
                    break;
                }
            }
            if (!isMember) revert NotAWinner();
            payout = _getNetPayout(s) / winCoven.members.length;
        }

        s.hasClaimed[msg.sender] = true;
        emit RewardClaimed(sessionId, msg.sender, payout);

        (bool sent, ) = msg.sender.call{value: payout}("");
        require(sent, "Transfer failed");
    }

    // ════════════════════════════════════════════════════════════════
    //                      TIMEOUT & SAFETY
    // ════════════════════════════════════════════════════════════════

    /**
     * @notice Expire a session after timeLimit. Refunds stakes minus 2.5% tithe.
     * @param sessionId  Session that has timed out
     */
    function expireSession(uint256 sessionId) external {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];
        if (s.resolved || s.expired) revert SessionAlreadyResolved();
        if (s.startTime == 0) revert SessionNotStarted();
        if (block.timestamp < s.startTime + s.timeLimit) revert NotExpiredYet();

        s.expired = true;
        _payFee(sessionId, s);
        emit SessionExpired(sessionId);
    }

    /**
     * @notice After expiry, each player can claim their refund (stake minus fee share).
     * @param sessionId  Expired session
     */
    function claimRefund(uint256 sessionId) external nonReentrant {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];
        require(s.expired, "Not expired");
        require(!s.hasClaimed[msg.sender], "Already claimed");
        require(s.isPlayer[msg.sender], "Not a player");

        s.hasClaimed[msg.sender] = true;

        uint256 pot = s.stakePerPlayer * s.totalPlayers;
        uint256 fee = (pot * PROTOCOL_FEE_BPS) / BPS;
        uint256 refundPerPlayer = (pot - fee) / s.totalPlayers;

        emit RewardClaimed(sessionId, msg.sender, refundPerPlayer);

        (bool sent, ) = msg.sender.call{value: refundPerPlayer}("");
        require(sent, "Transfer failed");
    }

    /**
     * @notice Emergency drain. Owner only with 24h timelock from startTime.
     * @param sessionId  Stuck session
     */
    function emergencyWithdraw(uint256 sessionId) external onlyOwner nonReentrant {
        if (!sessionExists[sessionId]) revert SessionNotFound();
        Session storage s = sessions[sessionId];
        if (s.resolved || s.expired) revert SessionAlreadyResolved();
        if (s.startTime == 0 || block.timestamp < s.startTime + EMERGENCY_TIMELOCK) {
            revert TimelockNotExpired();
        }

        s.resolved = true;
        uint256 balance = s.stakePerPlayer * s.totalPlayers;

        emit EmergencyWithdraw(sessionId, balance);

        (bool sent, ) = owner().call{value: balance}("");
        require(sent, "Transfer failed");
    }

    // ════════════════════════════════════════════════════════════════
    //                      ADMIN
    // ════════════════════════════════════════════════════════════════

    function setTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    function setTrustedSigner(address _signer) external onlyOwner {
        require(_signer != address(0), "Invalid signer");
        trustedSigner = _signer;
    }

    // ════════════════════════════════════════════════════════════════
    //                      VIEW FUNCTIONS
    // ════════════════════════════════════════════════════════════════

    function getSession(uint256 sessionId) external view returns (
        address host,
        uint256 stakePerPlayer,
        bytes32 seed,
        bool isCoOp,
        uint8 maxCovens,
        uint256 startTime,
        uint256 timeLimit,
        bool resolved,
        bool expired,
        address winner,
        uint8 winnerCovenId,
        uint256 totalPlayers
    ) {
        Session storage s = sessions[sessionId];
        return (
            s.host,
            s.stakePerPlayer,
            s.seed,
            s.isCoOp,
            s.maxCovens,
            s.startTime,
            s.timeLimit,
            s.resolved,
            s.expired,
            s.winner,
            s.winnerCovenId,
            s.totalPlayers
        );
    }

    function getCovenMembers(uint256 sessionId, uint8 covenId) external view returns (address[] memory) {
        return sessions[sessionId].covens[covenId].members;
    }

    function getCovenEscapedCount(uint256 sessionId, uint8 covenId) external view returns (uint8) {
        return sessions[sessionId].covens[covenId].escapedCount;
    }

    function hasPlayerEscaped(uint256 sessionId, address player) external view returns (bool) {
        return sessions[sessionId].hasEscaped[player];
    }

    function hasPlayerClaimed(uint256 sessionId, address player) external view returns (bool) {
        return sessions[sessionId].hasClaimed[player];
    }

    function getPlayerCoven(uint256 sessionId, address player) external view returns (uint8) {
        return sessions[sessionId].playerCoven[player];
    }

    // ════════════════════════════════════════════════════════════════
    //                      INTERNAL
    // ════════════════════════════════════════════════════════════════

    function _addPlayerToCoven(
        uint256 sessionId,
        Session storage s,
        address player,
        uint8 covenId
    ) internal {
        Coven storage coven = s.covens[covenId];
        if (coven.members.length >= s.maxPlayersPerCoven) revert CovenFull();

        coven.members.push(player);
        s.playerCoven[player] = covenId;
        s.isPlayer[player] = true;
        s.totalPlayers++;

        emit PlayerJoined(sessionId, player, covenId);
    }

    function _payFee(uint256 sessionId, Session storage s) internal {
        if (s.feePaid) return;
        s.feePaid = true;

        uint256 pot = s.stakePerPlayer * s.totalPlayers;
        uint256 fee = (pot * PROTOCOL_FEE_BPS) / BPS;

        emit AsylumClaimed(sessionId, fee);

        (bool sent, ) = treasury.call{value: fee}("");
        require(sent, "Fee transfer failed");
    }

    function _getNetPayout(Session storage s) internal view returns (uint256) {
        uint256 pot = s.stakePerPlayer * s.totalPlayers;
        uint256 fee = (pot * PROTOCOL_FEE_BPS) / BPS;
        return pot - fee;
    }
}
