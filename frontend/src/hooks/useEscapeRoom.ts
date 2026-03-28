/* ──────────────────────────────────────────────────────────────────────
 *  useEscapeRoom — Contract interaction hooks (viem/wagmi)
 * ────────────────────────────────────────────────────────────────────── */
'use client';

import { useReadContract, useWriteContract, useWatchContractEvent, useAccount } from 'wagmi';
import { parseEther, formatEther } from 'viem';
import { PH0xBIA_ABI, PH0xBIA_ADDRESS } from '@/lib/contract';

// ─── Read Hooks ──────────────────────────────────────────────────────

export function useSessionData(sessionId: bigint) {
  return useReadContract({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: 'getSession',
    args: [sessionId],
  });
}

export function useSessionExists(sessionId: bigint) {
  return useReadContract({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: 'sessionExists',
    args: [sessionId],
  });
}

export function useCovenMembers(sessionId: bigint, covenId: number) {
  return useReadContract({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: 'getCovenMembers',
    args: [sessionId, covenId],
  });
}

export function useHasEscaped(sessionId: bigint, player: `0x${string}`) {
  return useReadContract({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: 'hasPlayerEscaped',
    args: [sessionId, player],
  });
}

export function useHasClaimed(sessionId: bigint, player: `0x${string}`) {
  return useReadContract({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    functionName: 'hasPlayerClaimed',
    args: [sessionId, player],
  });
}

// ─── Write Hooks ─────────────────────────────────────────────────────

export function useCreateSession() {
  const { writeContractAsync } = useWriteContract();

  return async (
    sessionId: bigint,
    stakeEth: string,
    isCoOp: boolean,
    maxCovens: number,
    maxPlayersPerCoven: number,
    timeLimitSec: number,
  ) => {
    const stake = parseEther(stakeEth);
    return writeContractAsync({
      address: PH0xBIA_ADDRESS,
      abi: PH0xBIA_ABI,
      functionName: 'createSession',
      args: [sessionId, stake, isCoOp, maxCovens, maxPlayersPerCoven, BigInt(timeLimitSec)],
      value: stake,
    });
  };
}

export function useJoinSession() {
  const { writeContractAsync } = useWriteContract();

  return async (sessionId: bigint, covenId: number, stakeEth: string) => {
    const stake = parseEther(stakeEth);
    return writeContractAsync({
      address: PH0xBIA_ADDRESS,
      abi: PH0xBIA_ABI,
      functionName: 'joinSession',
      args: [sessionId, covenId],
      value: stake,
    });
  };
}

export function useStartSession() {
  const { writeContractAsync } = useWriteContract();

  return async (sessionId: bigint) => {
    return writeContractAsync({
      address: PH0xBIA_ADDRESS,
      abi: PH0xBIA_ABI,
      functionName: 'startSession',
      args: [sessionId],
    });
  };
}

export function useMarkEscaped() {
  const { writeContractAsync } = useWriteContract();

  return async (sessionId: bigint, wardenSig: `0x${string}`) => {
    return writeContractAsync({
      address: PH0xBIA_ADDRESS,
      abi: PH0xBIA_ABI,
      functionName: 'markEscaped',
      args: [sessionId, wardenSig],
    });
  };
}

export function useClaimReward() {
  const { writeContractAsync } = useWriteContract();

  return async (sessionId: bigint) => {
    return writeContractAsync({
      address: PH0xBIA_ADDRESS,
      abi: PH0xBIA_ABI,
      functionName: 'claimReward',
      args: [sessionId],
    });
  };
}

export function useExpireSession() {
  const { writeContractAsync } = useWriteContract();

  return async (sessionId: bigint) => {
    return writeContractAsync({
      address: PH0xBIA_ADDRESS,
      abi: PH0xBIA_ABI,
      functionName: 'expireSession',
      args: [sessionId],
    });
  };
}

// ─── Escape Flow (Warden + Contract) ─────────────────────────────────

export function useEscapeFlow() {
  const markEscaped = useMarkEscaped();
  const { address } = useAccount();

  return async (sessionId: bigint) => {
    if (!address) throw new Error('Wallet not connected');

    // 1. Request signature from The Warden
    const res = await fetch('/api/sign-escape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: sessionId.toString(),
        playerAddr: address,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'The Warden denied your escape');
    }

    const { signature } = await res.json();

    // 2. Submit escape proof on-chain
    return markEscaped(sessionId, signature as `0x${string}`);
  };
}

// ─── Event Watchers ──────────────────────────────────────────────────

export function useWatchSessionCreated(onEvent: (log: any) => void) {
  useWatchContractEvent({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    eventName: 'SessionCreated',
    onLogs: (logs) => logs.forEach(onEvent),
  });
}

export function useWatchPlayerEscaped(onEvent: (log: any) => void) {
  useWatchContractEvent({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    eventName: 'PlayerEscaped',
    onLogs: (logs) => logs.forEach(onEvent),
  });
}

export function useWatchSessionResolved(onEvent: (log: any) => void) {
  useWatchContractEvent({
    address: PH0xBIA_ADDRESS,
    abi: PH0xBIA_ABI,
    eventName: 'SessionResolved',
    onLogs: (logs) => logs.forEach(onEvent),
  });
}

export { parseEther, formatEther };
