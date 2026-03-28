'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Play Page — Mounts the 3D asylum game
 * ────────────────────────────────────────────────────────────────────── */
import { useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAccount } from 'wagmi';
import { IS_DEV_MODE, DEV_SEED, isAdmin } from '@/lib/devMode';
import { generateWard } from '@/lib/roomGenerator';

const AsylumGame = dynamic(() => import('@/components/AsylumGame'), {
  ssr: false,
  loading: () => (
    <div style={{
      width: 800, height: 600, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: '#050508', color: '#8b0000',
      fontFamily: '"Courier New", monospace',
      border: '2px solid #1a1a2e', margin: '0 auto',
      flexDirection: 'column', gap: 8,
    }}>
      <p style={{ fontSize: '1.2rem', animation: 'pulse 2s ease-in-out infinite' }}>
        ENTERING THE ASYLUM...
      </p>
      <p style={{ fontSize: '0.7rem', color: '#333' }}>Loading 3D environment</p>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.4; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  ),
});

export default function PlayPage() {
  const router = useRouter();
  const { address } = useAccount();
  const hasDevAccess = IS_DEV_MODE || isAdmin(address);

  useEffect(() => {
    // Basic protection against direct navigation by unauthorized users
    if (!hasDevAccess) {
      alert("Unauthorized: Staking and active session required.");
      router.push('/');
    }
  }, [hasDevAccess, router]);

  const seed = hasDevAccess ? DEV_SEED : DEV_SEED;
  const wardConfig = useMemo(() => generateWard(seed, false), [seed]);

  if (!hasDevAccess) return null; // Prevent flicker before redirect

  return (
    <main className="play-page">
      {hasDevAccess && <div className="dev-badge">⚠ DEV MODE BYPASS</div>}
      <h2 className="play-header">ASHWORTH ASYLUM</h2>
      <AsylumGame wardConfig={wardConfig} />
      <p className="play-info">
        WASD to move · E to investigate nearby objects · Collect 3 clues to unlock puzzles
      </p>
    </main>
  );
}
