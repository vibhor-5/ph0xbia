'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Landing Page — "ASHWORTH ASYLUM"
 * ────────────────────────────────────────────────────────────────────── */
import { useRouter } from 'next/navigation';
import { IS_DEV_MODE } from '@/lib/devMode';

export default function LandingPage() {
  const router = useRouter();

  const handleEnter = () => {
    router.push('/play');
  };

  return (
    <main className="landing">
      <div className="fog-layer" />

      {IS_DEV_MODE && <div className="dev-badge">⚠ DEV MODE</div>}

      <h1 className="landing-title">PH0xBIA</h1>
      <p className="landing-subtitle">ASHWORTH ASYLUM — EST. 1952</p>
      <p className="landing-tagline">&quot;No survivors.&quot;</p>

      <button className="landing-enter-btn" onClick={handleEnter}>
        {IS_DEV_MODE ? 'Enter (Dev Mode)' : 'Connect Wallet'}
      </button>

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
