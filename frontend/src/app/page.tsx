'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Landing Page — Create or Join a session, then wait in lobby
 * ────────────────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { IS_DEV_MODE, isAdmin } from '@/lib/devMode';
import { useCreateSession, useJoinSession } from '@/hooks/useEscapeRoom';

type Tab = 'create' | 'join';

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const createSession = useCreateSession();
  const joinSession = useJoinSession();

  const [tab, setTab] = useState<Tab>('create');
  const [stakeAmount, setStakeAmount] = useState('0.01');
  const [maxPlayers, setMaxPlayers] = useState('4');
  const [joinSessionId, setJoinSessionId] = useState('');
  const [joinStake, setJoinStake] = useState('0.01');
  const [isPending, setIsPending] = useState(false);

  const hasDevAccess = IS_DEV_MODE || isAdmin(address);

  const handleCreate = async () => {
    if (!publicClient) return alert('Web3 provider not ready');
    try {
      setIsPending(true);
      const sessionId = BigInt(Math.floor(Date.now() / 1000));
      const max = Math.max(1, Math.min(8, parseInt(maxPlayers) || 4));
      // Solo if max=1, otherwise co-op with 1 coven
      const isCoOp = max > 1;
      const txHash = await createSession(sessionId, stakeAmount, isCoOp, 1, max, 3600);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      router.push(`/lobby?sessionId=${sessionId.toString()}`);
    } catch (e: any) {
      console.error(e);
      alert(e.shortMessage || e.message || 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  const handleJoin = async () => {
    if (!publicClient || !joinSessionId) return alert('Enter a Session ID');
    try {
      setIsPending(true);
      const sessionId = BigInt(joinSessionId.trim());
      const txHash = await joinSession(sessionId, 0, joinStake);
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      router.push(`/lobby?sessionId=${sessionId.toString()}`);
    } catch (e: any) {
      console.error(e);
      alert(e.shortMessage || e.message || 'Failed to join session');
    } finally {
      setIsPending(false);
    }
  };

  const tabStyle = (t: Tab): React.CSSProperties => ({
    flex: 1,
    padding: '8px 0',
    background: tab === t ? 'rgba(139,0,0,0.15)' : 'transparent',
    border: 'none',
    borderBottom: tab === t ? '2px solid #8b0000' : '2px solid #222',
    color: tab === t ? '#cc3333' : '#555',
    fontFamily: 'monospace',
    fontSize: 12,
    letterSpacing: 2,
    cursor: 'pointer',
  });

  const inputStyle: React.CSSProperties = {
    padding: '8px 12px',
    background: 'rgba(0,0,0,0.5)',
    border: '1px solid #333',
    color: '#fff',
    fontFamily: '"Courier New", monospace',
    fontSize: 13,
    width: '100%',
    boxSizing: 'border-box',
  };

  return (
    <main className="landing">
      <div className="fog-layer" />
      {hasDevAccess && <div className="dev-badge">⚠ DEV MODE</div>}

      <h1 className="landing-title">PH0xBIA</h1>
      <p className="landing-subtitle">ASHWORTH ASYLUM — EST. 1952</p>
      <p className="landing-tagline">&quot;No survivors.&quot;</p>

      {isConnected ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 2, width: 340 }}>
          <ConnectButton showBalance={true} />

          {/* Dev bypass */}
          {hasDevAccess && (
            <button
              className="landing-enter-btn"
              onClick={() => router.push('/play')}
              style={{ borderColor: '#ff6600', color: '#ff6600' }}
              disabled={isPending}
            >
              Enter Asylum (Dev Bypass)
            </button>
          )}

          {/* Tab Switcher */}
          <div style={{ display: 'flex', width: '100%', borderBottom: '1px solid #1a1a2e' }}>
            <button style={tabStyle('create')} onClick={() => setTab('create')}>SUMMON SESSION</button>
            <button style={tabStyle('join')} onClick={() => setTab('join')}>JOIN COVEN</button>
          </div>

          {tab === 'create' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <label style={{ color: '#555', fontFamily: 'monospace', fontSize: 11 }}>STAKE PER PLAYER (MON)</label>
              <input
                type="text"
                value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
                style={inputStyle}
                disabled={isPending}
                placeholder="0.01"
              />
              <label style={{ color: '#555', fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>MAX PLAYERS (1–8)</label>
              <input
                type="number"
                min={1} max={8}
                value={maxPlayers}
                onChange={e => setMaxPlayers(e.target.value)}
                style={inputStyle}
                disabled={isPending}
              />
              <button
                className="landing-enter-btn"
                onClick={handleCreate}
                disabled={isPending}
                style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer', marginTop: 4 }}
              >
                {isPending ? 'CONFIRMING...' : 'CREATE & ENTER LOBBY'}
              </button>
            </div>
          )}

          {tab === 'join' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
              <label style={{ color: '#555', fontFamily: 'monospace', fontSize: 11 }}>SESSION ID</label>
              <input
                type="text"
                value={joinSessionId}
                onChange={e => setJoinSessionId(e.target.value)}
                style={inputStyle}
                disabled={isPending}
                placeholder="Paste session ID from host"
              />
              <label style={{ color: '#555', fontFamily: 'monospace', fontSize: 11, marginTop: 4 }}>STAKE AMOUNT (MON)</label>
              <input
                type="text"
                value={joinStake}
                onChange={e => setJoinStake(e.target.value)}
                style={inputStyle}
                disabled={isPending}
                placeholder="Must match host's stake"
              />
              <button
                className="landing-enter-btn"
                onClick={handleJoin}
                disabled={isPending}
                style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer', marginTop: 4 }}
              >
                {isPending ? 'JOINING...' : 'JOIN SESSION'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div style={{ zIndex: 2 }}>
          <ConnectButton label="Connect Wallet to Enter" />
        </div>
      )}

      <p style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '1.5rem', zIndex: 2 }}>
        Stake MON · Solve puzzles · Escape before your sanity shatters
      </p>
    </main>
  );
}
