'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Landing Page — "ASHWORTH ASYLUM" with wallet connect
 * ────────────────────────────────────────────────────────────────────── */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAccount, usePublicClient } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { IS_DEV_MODE, isAdmin } from '@/lib/devMode';
import { useCreateSession } from '@/hooks/useEscapeRoom';

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();
  const publicClient = usePublicClient();
  const createSession = useCreateSession();
  
  const [stakeAmount, setStakeAmount] = useState('0.01');
  const [isPending, setIsPending] = useState(false);

  const handleEnterDev = () => {
    router.push('/play');
  };

  const handleEnterGame = async () => {
    if (!publicClient) return alert("Web3 provider not ready");
    try {
      setIsPending(true);
      
      const sessionId = BigInt(Math.floor(Date.now() / 1000));
      const txHash = await createSession(sessionId, stakeAmount, false, 1, 1, 3600);
      
      await publicClient.waitForTransactionReceipt({ hash: txHash });
      
      router.push(`/play?sessionId=${sessionId.toString()}`);
    } catch (e: any) {
      console.error(e);
      alert(e.shortMessage || e.message || 'Transaction failed');
    } finally {
      setIsPending(false);
    }
  };

  const hasDevAccess = IS_DEV_MODE || isAdmin(address);

  return (
    <main className="landing">
      <div className="fog-layer" />

      {hasDevAccess && <div className="dev-badge">⚠ DEV MODE</div>}

      <h1 className="landing-title">PH0xBIA</h1>
      <p className="landing-subtitle">ASHWORTH ASYLUM — EST. 1952</p>
      <p className="landing-tagline">&quot;No survivors.&quot;</p>

      {isConnected ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem', zIndex: 2 }}>
          <ConnectButton showBalance={true} />
          {hasDevAccess && (
            <button 
              className="landing-enter-btn" 
              onClick={handleEnterDev} 
              style={{ borderColor: '#ff6600', color: '#ff6600', marginTop: '0.5rem' }}
              disabled={isPending}
            >
              Enter Asylum (Dev Bypass)
            </button>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text" 
              value={stakeAmount} 
              onChange={(e) => setStakeAmount(e.target.value)} 
              style={{ padding: '8px', background: 'rgba(0,0,0,0.5)', border: '1px solid #444', color: '#fff', width: '80px', textAlign: 'center', fontFamily: '"Courier New", monospace' }}
              disabled={isPending}
            />
            <span style={{ color: '#fff', fontSize: '0.9rem', fontFamily: '"Courier New", monospace' }}>MON</span>
          </div>
          <button 
            className="landing-enter-btn" 
            onClick={handleEnterGame}
            disabled={isPending}
            style={{ opacity: isPending ? 0.5 : 1, cursor: isPending ? 'not-allowed' : 'pointer' }}
          >
            {isPending ? 'Confirming...' : 'Stake & Enter'}
          </button>
        </div>
      ) : (
        <div style={{ zIndex: 2 }}>
          <ConnectButton label="Connect Wallet to Enter" />
        </div>
      )}

      <p style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '0.7rem',
        color: 'var(--text-dim)',
        marginTop: '1.5rem',
        zIndex: 2,
      }}>
        Stake MON · Solve puzzles · Escape before your sanity shatters
      </p>
    </main>
  );
}
