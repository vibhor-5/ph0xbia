'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  Play Page — Mounts the 3D asylum game
 * ────────────────────────────────────────────────────────────────────── */
import { useMemo, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAccount } from 'wagmi';
import { IS_DEV_MODE, DEV_SEED, DEV_SESSION_ID, isAdmin } from '@/lib/devMode';
import { generateWard } from '@/lib/roomGenerator';
import { useSessionData } from '@/hooks/useEscapeRoom';

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

function PlayClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { address } = useAccount();
  const hasDevAccess = IS_DEV_MODE || isAdmin(address);

  const rawSessionId = searchParams.get('sessionId');
  const sessionId = rawSessionId ? BigInt(rawSessionId) : (hasDevAccess ? DEV_SESSION_ID : null);

  const { data: sessionData, isLoading, isError } = useSessionData(sessionId || 0n);

  // Generate deterministic seed out of the sessionID if exists
  const seed = sessionId ? `0x${sessionId.toString(16).padStart(64, '0')}` : DEV_SEED;
  const wardConfig = useMemo(() => generateWard(seed, false), [seed]);

  useEffect(() => {
    if (!hasDevAccess && !rawSessionId) {
      alert("Unauthorized: Staking and active session required.");
      router.push('/');
    }
  }, [hasDevAccess, rawSessionId, router]);

  // If no dev access and validation failed
  const isInvalidSession = !hasDevAccess && (!sessionId || isError || (!isLoading && !sessionData));
  if (isInvalidSession) {
    return (
      <div style={{ color: '#ff3333', textAlign: 'center', marginTop: '20vh', fontFamily: '"Courier New", monospace' }}>
        <h2>Invalid Session</h2>
        <p>No active session found on-chain. Did you stake MON?</p>
        <button onClick={() => router.push('/')} style={{ marginTop: '20px', padding: '10px 20px', background: '#222', color: '#fff', border: '1px solid #444', cursor: 'pointer' }}>
          Return to Lobby
        </button>
      </div>
    );
  }


  if (isLoading && !hasDevAccess) {
    return <div style={{ color: 'white', textAlign: 'center', marginTop: '20vh' }}>Verifying on-chain session...</div>;
  }

  return (
    <main className="play-page">
      {hasDevAccess && !rawSessionId && <div className="dev-badge">⚠ DEV MODE BYPASS</div>}
      <h2 className="play-header">ASHWORTH ASYLUM</h2>
      {sessionId !== null && <AsylumGame wardConfig={wardConfig} sessionId={sessionId} />}
      <p className="play-info">
        WASD to move · E to investigate nearby objects · Collect 3 clues to unlock puzzles
      </p>
    </main>
  );
}

export default function PlayPage() {
  return (
    <Suspense fallback={<div style={{color:'white', textAlign:'center', marginTop:'20vh'}}>Loading...</div>}>
      <PlayClient />
    </Suspense>
  );
}
