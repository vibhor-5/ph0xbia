/**
 * PH0xBIA — wagmi Hooks for Smart Contract Interaction
 *
 * All hooks for session lifecycle:
 * - useCreateSession: create a new escape session
 * - useJoinSession: join an existing session
 * - useStartSession: host starts session, generates curse seed
 * - useMarkEscaped: submit Warden-signed escape proof
 * - useClaimReward: pull reward after session resolves
 * - useExpireSession: expire timed-out session
 * - useClaimRefund: claim refund after session expires
 * - useSessionData: read session state
 * - useCovenMembers: read coven member list
 * - useSessionEvents: watch for session events
 */

"use client";

import {
  useWriteContract,
  useReadContract,
  useWatchContractEvent,
  useWaitForTransactionReceipt,
} from "wagmi";
import { parseEther, type Abi } from "viem";
import { useState, useCallback } from "react";
import type { Address, SessionState } from "../../../types/game";

// ────── Contract Config ──────
// ABI will be imported from compiled artifacts after deployment.
// This is a typed subset covering the functions we need.

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x") as Address;

export const PH0xBIA_ABI = [
  // ── Write Functions ──
  {
    name: "createSession",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "stakePerPlayer", type: "uint256" },
      { name: "isCoOp", type: "bool" },
      { name: "maxCovens", type: "uint8" },
      { name: "maxPlayersPerCoven", type: "uint8" },
      { name: "timeLimitSec", type: "uint256" },
    ],
    outputs: [],
  },
  {
    name: "joinSession",
    type: "function",
    stateMutability: "payable",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "covenId", type: "uint8" },
    ],
    outputs: [],
  },
  {
    name: "startSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "sessionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "markEscaped",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "wardenSig", type: "bytes" },
    ],
    outputs: [],
  },
  {
    name: "claimReward",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "sessionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "expireSession",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "sessionId", type: "uint256" }],
    outputs: [],
  },
  {
    name: "claimRefund",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [{ name: "sessionId", type: "uint256" }],
    outputs: [],
  },
  // ── Read Functions ──
  {
    name: "getSession",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "sessionId", type: "uint256" }],
    outputs: [
      { name: "host", type: "address" },
      { name: "stakePerPlayer", type: "uint256" },
      { name: "seed", type: "bytes32" },
      { name: "isCoOp", type: "bool" },
      { name: "maxCovens", type: "uint8" },
      { name: "startTime", type: "uint256" },
      { name: "timeLimit", type: "uint256" },
      { name: "resolved", type: "bool" },
      { name: "expired", type: "bool" },
      { name: "winner", type: "address" },
      { name: "winnerCovenId", type: "uint8" },
      { name: "totalPlayers", type: "uint256" },
    ],
  },
  {
    name: "getCovenMembers",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "covenId", type: "uint8" },
    ],
    outputs: [{ name: "", type: "address[]" }],
  },
  {
    name: "hasPlayerEscaped",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    name: "hasPlayerClaimed",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "sessionId", type: "uint256" },
      { name: "player", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  // ── Events ──
  {
    name: "SessionCreated",
    type: "event",
    inputs: [
      { name: "sessionId", type: "uint256", indexed: true },
      { name: "host", type: "address", indexed: true },
      { name: "stakePerPlayer", type: "uint256", indexed: false },
      { name: "isCoOp", type: "bool", indexed: false },
      { name: "maxCovens", type: "uint8", indexed: false },
    ],
  },
  {
    name: "SessionStarted",
    type: "event",
    inputs: [
      { name: "sessionId", type: "uint256", indexed: true },
      { name: "curseSeed", type: "bytes32", indexed: false },
      { name: "startTime", type: "uint256", indexed: false },
    ],
  },
  {
    name: "PlayerJoined",
    type: "event",
    inputs: [
      { name: "sessionId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "covenId", type: "uint8", indexed: false },
    ],
  },
  {
    name: "PlayerEscaped",
    type: "event",
    inputs: [
      { name: "sessionId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "covenId", type: "uint8", indexed: false },
    ],
  },
  {
    name: "SessionResolved",
    type: "event",
    inputs: [
      { name: "sessionId", type: "uint256", indexed: true },
      { name: "isCoOp", type: "bool", indexed: false },
      { name: "winnerCovenId", type: "uint8", indexed: false },
      { name: "netPayout", type: "uint256", indexed: false },
    ],
  },
  {
    name: "RewardClaimed",
    type: "event",
    inputs: [
      { name: "sessionId", type: "uint256", indexed: true },
      { name: "player", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
    ],
  },
] as const satisfies Abi;

// ════════════════════════════════════════════════════════════════
//                       WRITE HOOKS
// ════════════════════════════════════════════════════════════════

export function useCreateSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const createSession = useCallback(
    (params: {
      sessionId: bigint;
      stakeEther: string;
      isCoOp: boolean;
      maxCovens: number;
      maxPlayersPerCoven: number;
      timeLimitSec: number;
    }) => {
      const stakeWei = parseEther(params.stakeEther);
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "createSession",
        args: [
          params.sessionId,
          stakeWei,
          params.isCoOp,
          params.maxCovens,
          params.maxPlayersPerCoven,
          BigInt(params.timeLimitSec),
        ],
        value: stakeWei,
      });
    },
    [writeContract]
  );

  return { createSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useJoinSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const joinSession = useCallback(
    (sessionId: bigint, covenId: number, stakeEther: string) => {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "joinSession",
        args: [sessionId, covenId],
        value: parseEther(stakeEther),
      });
    },
    [writeContract]
  );

  return { joinSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useStartSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const startSession = useCallback(
    (sessionId: bigint) => {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "startSession",
        args: [sessionId],
      });
    },
    [writeContract]
  );

  return { startSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useMarkEscaped() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const markEscaped = useCallback(
    (sessionId: bigint, wardenSig: `0x${string}`) => {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "markEscaped",
        args: [sessionId, wardenSig],
      });
    },
    [writeContract]
  );

  return { markEscaped, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimReward() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimReward = useCallback(
    (sessionId: bigint) => {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "claimReward",
        args: [sessionId],
      });
    },
    [writeContract]
  );

  return { claimReward, hash, isPending, isConfirming, isSuccess, error };
}

export function useExpireSession() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const expireSession = useCallback(
    (sessionId: bigint) => {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "expireSession",
        args: [sessionId],
      });
    },
    [writeContract]
  );

  return { expireSession, hash, isPending, isConfirming, isSuccess, error };
}

export function useClaimRefund() {
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash });

  const claimRefund = useCallback(
    (sessionId: bigint) => {
      writeContract({
        address: CONTRACT_ADDRESS,
        abi: PH0xBIA_ABI,
        functionName: "claimRefund",
        args: [sessionId],
      });
    },
    [writeContract]
  );

  return { claimRefund, hash, isPending, isConfirming, isSuccess, error };
}

// ════════════════════════════════════════════════════════════════
//                       READ HOOKS
// ════════════════════════════════════════════════════════════════

export function useSessionData(sessionId: bigint) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: "getSession",
    args: [sessionId],
  });

  const session = data
    ? {
        host: data[0] as Address,
        stakePerPlayer: data[1] as bigint,
        seed: data[2] as `0x${string}`,
        isCoOp: data[3] as boolean,
        maxCovens: data[4] as number,
        startTime: Number(data[5]),
        timeLimit: Number(data[6]),
        resolved: data[7] as boolean,
        expired: data[8] as boolean,
        winner: data[9] as Address,
        winnerCovenId: data[10] as number,
        totalPlayers: Number(data[11]),
      }
    : null;

  return { session, isLoading, refetch };
}

export function useCovenMembers(sessionId: bigint, covenId: number) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: "getCovenMembers",
    args: [sessionId, covenId],
  });

  return { members: (data || []) as Address[], isLoading, refetch };
}

export function useHasEscaped(sessionId: bigint, player: Address) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: "hasPlayerEscaped",
    args: [sessionId, player],
  });
}

export function useHasClaimed(sessionId: bigint, player: Address) {
  return useReadContract({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: "hasPlayerClaimed",
    args: [sessionId, player],
  });
}

// ════════════════════════════════════════════════════════════════
//                       EVENT HOOKS
// ════════════════════════════════════════════════════════════════

export function useWatchSessionStarted(
  sessionId: bigint,
  onStarted: (seed: `0x${string}`, startTime: bigint) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    eventName: "SessionStarted",
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args.sessionId === sessionId) {
          onStarted(log.args.curseSeed!, log.args.startTime!);
        }
      }
    },
  });
}

export function useWatchPlayerEscaped(
  sessionId: bigint,
  onEscape: (player: Address, covenId: number) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    eventName: "PlayerEscaped",
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args.sessionId === sessionId) {
          onEscape(log.args.player! as Address, Number(log.args.covenId));
        }
      }
    },
  });
}

export function useWatchSessionResolved(
  sessionId: bigint,
  onResolved: (isCoOp: boolean, winnerCovenId: number, netPayout: bigint) => void
) {
  useWatchContractEvent({
    address: CONTRACT_ADDRESS,
    abi: PH0xBIA_ABI,
    eventName: "SessionResolved",
    onLogs: (logs) => {
      for (const log of logs) {
        if (log.args.sessionId === sessionId) {
          onResolved(log.args.isCoOp!, Number(log.args.winnerCovenId), log.args.netPayout!);
        }
      }
    },
  });
}

// ════════════════════════════════════════════════════════════════
//                       ESCAPE FLOW HELPER
// ════════════════════════════════════════════════════════════════

/**
 * Request escape signature from The Warden backend.
 * Call this after solving all 3 puzzles.
 */
export async function requestEscapeSignature(
  sessionId: bigint,
  playerAddr: Address
): Promise<`0x${string}`> {
  const res = await fetch("/api/sign-escape", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId: sessionId.toString(),
      playerAddr,
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || "The Warden denies your release.");
  }

  const { signature } = await res.json();
  return signature as `0x${string}`;
}
