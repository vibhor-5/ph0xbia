'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Lobby Page — Real-time waiting room before session starts
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useSessionData, useStartSession } from '@/hooks/useEscapeRoom';
import { useMultiplayer } from '@/hooks/useMultiplayer';

function LobbyClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const startSession = useStartSession();

  const rawSessionId = searchParams.get('sessionId');
  const sessionId = rawSessionId ? BigInt(rawSessionId) : null;

  const { data: sessionData, isLoading, refetch } = useSessionData(sessionId ?? 0n);
  const [isStarting, setIsStarting] = useState(false);

  // getSession returns tuple: [host, stakePerPlayer, seed, isCoOp, maxCovens, startTime, timeLimit, resolved, expired, winner, winnerCovenId, totalPlayers]
  const stakeEth = sessionData
    ? (Number(sessionData[1]) / 1e18).toFixed(4)
    : '?';
  const isHost = sessionData?.[0]?.toLowerCase() === address?.toLowerCase();
  const totalPlayers = Number(sessionData?.[11] ?? 0);
  const startTime = sessionData?.[5] ?? 0n;

  // Multiplayer presence — show who's in the lobby
  const { remotePlayers, onlineCount } = useMultiplayer({
    sessionId: rawSessionId ?? '',
    wallet: address ?? '',
    covenId: 0,
    enabled: !!rawSessionId && isConnected,
  });

  // Poll on-chain data every 4s to detect new joiners
  useEffect(() => {
    if (!sessionId) return;
    const interval = setInterval(() => refetch(), 4000);
    return () => clearInterval(interval);
  }, [sessionId, refetch]);

  // When startTime is set, route everyone to /play
  useEffect(() => {
    if (startTime && startTime > 0n) {
      router.push(`/play?sessionId=${rawSessionId}`);
    }
  }, [startTime, rawSessionId, router]);

  const handleStart = async () => {
    if (!sessionId || !publicClient) return;
    try {
      setIsStarting(true);
      const tx = await startSession(sessionId);
      await publicClient.waitForTransactionReceipt({ hash: tx });
      router.push(`/play?sessionId=${rawSessionId}`);
    } catch (e: any) {
      alert(e.shortMessage || e.message || 'Failed to start session');
      setIsStarting(false);
    }
  };

  if (!isConnected) {
    return (
      <div style={styles.center}>
        <ConnectButton label="Connect Wallet to Continue" />
      </div>
    );
  }

  if (!rawSessionId) {
    return (
      <div style={styles.center}>
        <p style={{ color: '#ff3333', fontFamily: 'monospace' }}>No session ID found. Return to lobby.</p>
        <button style={styles.btn} onClick={() => router.push('/')}>← Back</button>
      </div>
    );
  }

  if (isLoading) {
    return <div style={styles.center}><p style={{ color: '#8b0000', fontFamily: 'monospace', animation: 'pulse 1.5s infinite' }}>READING THE WARDS...</p></div>;
  }

  // All players in Supabase presence + the remote ones
  const allPresent = [
    ...(address ? [address.toLowerCase()] : []),
    ...Array.from(remotePlayers.keys()),
  ];

  return (
    <main style={styles.main}>
      <style>{`@keyframes pulse{0%,100%{opacity:0.4}50%{opacity:1}}`}</style>

      <div style={styles.card}>
        <h1 style={styles.title}>ASHWORTH ASYLUM</h1>
        <p style={styles.subtitle}>WAITING ROOM</p>

        <div style={styles.infoRow}>
          <span style={styles.badge}>Session</span>
          <code style={{ color: '#bfa14a', fontSize: 11 }}>{rawSessionId?.slice(0, 20)}...</code>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.badge}>Stake</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{stakeEth} MON per player</span>
        </div>
        <div style={styles.infoRow}>
          <span style={styles.badge}>Players</span>
          <span style={{ color: '#fff', fontFamily: 'monospace' }}>{totalPlayers} staked on-chain · {onlineCount} online now</span>
        </div>

        <div style={styles.playerList}>
          <p style={{ color: '#555', fontSize: 11, fontFamily: 'monospace', marginBottom: 8 }}>CURRENTLY IN LOBBY</p>
          {allPresent.length === 0 && <p style={{ color: '#333', fontFamily: 'monospace', fontSize: 12 }}>Waiting for players...</p>}
          {allPresent.map((w, i) => (
            <div key={w} style={styles.playerRow}>
              <span style={{ color: '#2d6a4f', fontSize: 12 }}>●</span>
              <code style={{ color: i === 0 && address && w === address.toLowerCase() ? '#bfa14a' : '#aaa', fontSize: 12 }}>
                {w.slice(0, 6)}...{w.slice(-4)}
                {isHost && i === 0 ? ' 👑 Host' : ''}
              </code>
            </div>
          ))}
        </div>

        {isHost ? (
          <button
            style={{ ...styles.btn, opacity: isStarting ? 0.5 : 1 }}
            onClick={handleStart}
            disabled={isStarting}
          >
            {isStarting ? 'STARTING...' : '⚡ START THE RITUAL'}
          </button>
        ) : (
          <p style={{ color: '#555', fontFamily: 'monospace', fontSize: 13, marginTop: 20, animation: 'pulse 2s infinite' }}>
            Waiting for the Host to start the session...
          </p>
        )}

        <button style={styles.backBtn} onClick={() => router.push('/')}>← Leave Lobby</button>
      </div>
    </main>
  );
}

export default function LobbyPage() {
  return (
    <Suspense fallback={<div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Loading...</div>}>
      <LobbyClient />
    </Suspense>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: '100vh',
    background: '#050508',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    minHeight: '100vh',
    background: '#050508',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  card: {
    background: 'rgba(10,10,20,0.95)',
    border: '1px solid #1a1a2e',
    borderRadius: 8,
    padding: '40px 48px',
    width: 480,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontFamily: 'serif',
    fontSize: '2.2rem',
    color: '#8b0000',
    textShadow: '0 0 20px rgba(139,0,0,0.4)',
    margin: 0,
  },
  subtitle: {
    color: '#444',
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 4,
    marginTop: -8,
  },
  infoRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'center',
    width: '100%',
  },
  badge: {
    background: '#1a1a2e',
    color: '#555',
    fontSize: 10,
    fontFamily: 'monospace',
    padding: '2px 8px',
    borderRadius: 3,
    letterSpacing: 1,
    minWidth: 60,
    textAlign: 'center',
  },
  playerList: {
    width: '100%',
    background: '#0a0a12',
    border: '1px solid #1a1a2e',
    borderRadius: 4,
    padding: '12px 16px',
    minHeight: 80,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  playerRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  btn: {
    marginTop: 8,
    padding: '12px 32px',
    background: 'none',
    border: '1px solid #8b0000',
    color: '#8b0000',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 14,
    letterSpacing: 2,
    width: '100%',
  },
  backBtn: {
    marginTop: 4,
    padding: '8px 16px',
    background: 'none',
    border: '1px solid #222',
    color: '#444',
    cursor: 'pointer',
    fontFamily: 'monospace',
    fontSize: 12,
    width: '100%',
  },
};
