'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Landing Page — "ASHWORTH ASYLUM" with wallet connect
 * ────────────────────────────────────────────────────────────────────── */
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { IS_DEV_MODE, isAdmin } from '@/lib/devMode';

export default function LandingPage() {
  const router = useRouter();
  const { isConnected, address } = useAccount();

  const handleEnterDev = () => {
    router.push('/play');
  };

  const handleEnterGame = () => {
    alert("Staking and Session Creation UI coming soon!");
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
            >
              Enter Asylum (Dev Bypass)
            </button>
          )}
          <button className="landing-enter-btn" onClick={handleEnterGame}>
            Stake MON & Enter
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
