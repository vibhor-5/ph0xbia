export const PH0xBIA_ABI =
[
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "_trustedSigner",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AlreadyClaimed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyEscaped",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyJoined",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "CovenFull",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ECDSAInvalidSignature",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "length",
        "type": "uint256"
      }
    ],
    "name": "ECDSAInvalidSignatureLength",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "bytes32",
        "name": "s",
        "type": "bytes32"
      }
    ],
    "name": "ECDSAInvalidSignatureS",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidCoven",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidCovens",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidPlayersPerCoven",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidSigner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotAWinner",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotEnoughPlayers",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotExpiredYet",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotHost",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "owner",
        "type": "address"
      }
    ],
    "name": "OwnableInvalidOwner",
    "type": "error"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "account",
        "type": "address"
      }
    ],
    "name": "OwnableUnauthorizedAccount",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "ReentrancyGuardReentrantCall",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SessionAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SessionAlreadyResolved",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SessionAlreadyStarted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SessionNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SessionNotResolved",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "SessionNotStarted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "StakeTooLow",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TimelockNotExpired",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WrongStake",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "feeAmount",
        "type": "uint256"
      }
    ],
    "name": "AsylumClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "EmergencyWithdraw",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "address",
        "name": "previousOwner",
        "type": "address"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "OwnershipTransferred",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "covenId",
        "type": "uint8"
      }
    ],
    "name": "PlayerEscaped",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "covenId",
        "type": "uint8"
      }
    ],
    "name": "PlayerJoined",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "player",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "RewardClaimed",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "host",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "stakePerPlayer",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isCoOp",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "maxCovens",
        "type": "uint8"
      }
    ],
    "name": "SessionCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "SessionExpired",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bool",
        "name": "isCoOp",
        "type": "bool"
      },
      {
        "indexed": false,
        "internalType": "uint8",
        "name": "winnerCovenId",
        "type": "uint8"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "netPayout",
        "type": "uint256"
      }
    ],
    "name": "SessionResolved",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "indexed": false,
        "internalType": "bytes32",
        "name": "curseSeed",
        "type": "bytes32"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      }
    ],
    "name": "SessionStarted",
    "type": "event"
  },
  {
    "inputs": [],
    "name": "BPS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "EMERGENCY_TIMELOCK",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_COVENS",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "MAX_PLAYERS_PER_COVEN",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "PROTOCOL_FEE_BPS",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "claimRefund",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "claimReward",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "stakePerPlayer",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "isCoOp",
        "type": "bool"
      },
      {
        "internalType": "uint8",
        "name": "maxCovens",
        "type": "uint8"
      },
      {
        "internalType": "uint8",
        "name": "maxPlayersPerCoven",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "timeLimitSec",
        "type": "uint256"
      }
    ],
    "name": "createSession",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "emergencyWithdraw",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "expireSession",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "covenId",
        "type": "uint8"
      }
    ],
    "name": "getCovenEscapedCount",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "covenId",
        "type": "uint8"
      }
    ],
    "name": "getCovenMembers",
    "outputs": [
      {
        "internalType": "address[]",
        "name": "",
        "type": "address[]"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "getPlayerCoven",
    "outputs": [
      {
        "internalType": "uint8",
        "name": "",
        "type": "uint8"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "getSession",
    "outputs": [
      {
        "internalType": "address",
        "name": "host",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "stakePerPlayer",
        "type": "uint256"
      },
      {
        "internalType": "bytes32",
        "name": "seed",
        "type": "bytes32"
      },
      {
        "internalType": "bool",
        "name": "isCoOp",
        "type": "bool"
      },
      {
        "internalType": "uint8",
        "name": "maxCovens",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "startTime",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "timeLimit",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "resolved",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "expired",
        "type": "bool"
      },
      {
        "internalType": "address",
        "name": "winner",
        "type": "address"
      },
      {
        "internalType": "uint8",
        "name": "winnerCovenId",
        "type": "uint8"
      },
      {
        "internalType": "uint256",
        "name": "totalPlayers",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "hasPlayerClaimed",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "player",
        "type": "address"
      }
    ],
    "name": "hasPlayerEscaped",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "uint8",
        "name": "covenId",
        "type": "uint8"
      }
    ],
    "name": "joinSession",
    "outputs": [],
    "stateMutability": "payable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      },
      {
        "internalType": "bytes",
        "name": "wardenSig",
        "type": "bytes"
      }
    ],
    "name": "markEscaped",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "renounceOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "sessionExists",
    "outputs": [
      {
        "internalType": "bool",
        "name": "",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_treasury",
        "type": "address"
      }
    ],
    "name": "setTreasury",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_signer",
        "type": "address"
      }
    ],
    "name": "setTrustedSigner",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "sessionId",
        "type": "uint256"
      }
    ],
    "name": "startSession",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "newOwner",
        "type": "address"
      }
    ],
    "name": "transferOwnership",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "treasury",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "trustedSigner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const PH0xBIA_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0') as `0x${string}`;
