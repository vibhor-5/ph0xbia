'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  AsylumGame — First-Person 3D Horror Room (Vanilla Three.js)
 *  WASD + mouse look. 6 interactive puzzles with user input.
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useAccount, usePublicClient } from 'wagmi';
import { useEscapeFlow, useClaimReward } from '@/hooks/useEscapeRoom';
import { useMultiplayer } from '@/hooks/useMultiplayer';
import { supabase } from '@/lib/supabase/client';
import type { WardConfig, WardObject, PuzzleConfig, PuzzleState, PuzzleId } from '@/types/game';
import { DEFAULT_SANITY_CONFIG } from '@/types/game';

interface Props { 
  wardConfig: WardConfig;
  sessionId: bigint;
  covenId?: number;
}

export default function AsylumGame({ wardConfig, sessionId, covenId = 0 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [sanity, setSanity] = useState(100);
  const [clues, setClues] = useState(0);
  const [puzzlesSolved, setPuzzlesSolved] = useState(0);
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#8b0000');
  const [locked, setLocked] = useState(false);
  const [outcome, setOutcome] = useState<'playing' | 'escape_pending' | 'win' | 'error'>('playing');
  const [nearObj, setNearObj] = useState('');
  const [claimPending, setClaimPending] = useState(false);
  const [claimDone, setClaimDone] = useState(false);
  // Puzzle modal state
  const [activePuzzle, setActivePuzzle] = useState<PuzzleState | null>(null);
  const [puzzleInput, setPuzzleInput] = useState('');
  // Hints journal
  const [hints, setHints] = useState<string[]>([]);
  const [showJournal, setShowJournal] = useState(false);
  // Track which puzzles are solved for HUD
  const [solvedPuzzles, setSolvedPuzzles] = useState<Set<PuzzleId>>(new Set());

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const escapeFlow = useEscapeFlow();
  const claimReward = useClaimReward();

  // Multiplayer real-time sync
  const { remotePlayers, onlineCount, broadcastPosition } = useMultiplayer({
    sessionId: sessionId.toString(),
    wallet: address ?? '',
    covenId,
    enabled: !!address,
  });

  // Broadcast position to other players at ~10fps
  useEffect(() => {
    const interval = setInterval(() => {
      if (!engineRef.current) return;
      const { x, y, z } = engineRef.current.getCameraPosition();
      const { yaw, pitch } = engineRef.current.getCameraRotation();
      broadcastPosition(x, y, z, yaw, pitch, sanity);
    }, 100);
    return () => clearInterval(interval);
  }, [broadcastPosition, sanity]);

  // Pass remote players into engine for ghost rendering
  useEffect(() => {
    engineRef.current?.updateRemotePlayers(remotePlayers);
  }, [remotePlayers]);

  const showMsg = useCallback((t: string, c = '#8b0000') => {
    setMsg(t); setMsgColor(c);
    setTimeout(() => setMsg(''), 3500);
  }, []);

  const onPuzzleSolved = useCallback(async (puzzleIdx: number) => {
    if (!address) return;
    try {
      // 1. Ensure the session exists in Supabase (upsert)
      await supabase.from('sessions').upsert({
        session_id: sessionId.toString(),
        seed: '0x0', // Placeholder until startSession is called or deterministic seed is used
        is_coop: false,
        status: 'active'
      }, { onConflict: 'session_id' });

      // 2. Insert the puzzle solved event
      const { error } = await supabase.from('task_state').insert({
        session_id: sessionId.toString(),
        player_addr: address.toLowerCase(),
        coven_id: 1,
        task_type: 'puzzle', // Required field
        action: 'puzzle_solved',
        object_id: `puzzle_${puzzleIdx}`
      });
      if (error) console.error('Supabase task_state error:', error);
    } catch (e) {
      console.error('Supabase write error:', e);
    }
  }, [address, sessionId]);

  const onExitReached = useCallback(async () => {
    setOutcome('escape_pending');
    if (document.pointerLockElement) document.exitPointerLock();
    try {
      const tx = await escapeFlow(sessionId);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash: tx });
      }
      setOutcome('win');
    } catch (e: any) {
      console.error(e);
      setOutcome('error');
    }
  }, [escapeFlow, sessionId, publicClient]);

  // Puzzle modal open callback from engine
  const openPuzzleModal = useCallback((config: PuzzleConfig) => {
    if (document.pointerLockElement) document.exitPointerLock();
    setActivePuzzle({
      puzzleId: config.id,
      config,
      playerInput: '',
      attempts: 0,
      feedback: '',
      feedbackColor: '#8b0000',
    });
    setPuzzleInput('');
  }, []);

  // Hint discovery callback
  const onHintDiscovered = useCallback((hintText: string) => {
    setHints(prev => {
      if (prev.includes(hintText)) return prev;
      return [...prev, hintText];
    });
  }, []);

  // Handle puzzle submission
  const submitPuzzle = useCallback(() => {
    if (!activePuzzle) return;
    const answer = puzzleInput.trim().toUpperCase();
    const correct = activePuzzle.config.answer.toUpperCase();
    if (answer === correct) {
      // Puzzle solved!
      const pid = activePuzzle.puzzleId;
      setSolvedPuzzles(prev => {
        const next = new Set(prev);
        next.add(pid);
        return next;
      });
      setPuzzlesSolved(prev => prev + 1);
      showMsg(`🧩 PUZZLE SOLVED: ${activePuzzle.config.title}`, '#2d6a4f');
      onPuzzleSolved(parseInt(pid.replace('P', '')));
      // Tell engine this puzzle is solved
      engineRef.current?.markPuzzleSolved(pid);
      setActivePuzzle(null);
      setPuzzleInput('');
      // Relock pointer
      setTimeout(() => containerRef.current?.requestPointerLock(), 200);
    } else {
      // Wrong answer — sanity drain
      setActivePuzzle(prev => prev ? {
        ...prev,
        attempts: prev.attempts + 1,
        feedback: `Wrong! "${answer}" is not correct. (Attempt ${prev.attempts + 1})`,
        feedbackColor: '#ff3333',
      } : null);
      setSanity(s => Math.max(0, s + DEFAULT_SANITY_CONFIG.drainRates.puzzle_fail));
      if (engineRef.current) {
        engineRef.current.drainSanity(DEFAULT_SANITY_CONFIG.drainRates.puzzle_fail);
      }
    }
  }, [activePuzzle, puzzleInput, showMsg, onPuzzleSolved]);

  const callbacksRef = useRef({ setSanity, setClues, setPuzzlesSolved, showMsg, onPuzzleSolved, onExitReached, setLocked, setNearObj, openPuzzleModal, onHintDiscovered });
  useEffect(() => {
    callbacksRef.current = { setSanity, setClues, setPuzzlesSolved, showMsg, onPuzzleSolved, onExitReached, setLocked, setNearObj, openPuzzleModal, onHintDiscovered };
  });

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;
    engineRef.current = new GameEngine(
      containerRef.current, wardConfig,
      { 
        setSanity: (fn) => callbacksRef.current.setSanity(fn),
        setClues: (fn) => callbacksRef.current.setClues(fn),
        setPuzzles: (fn) => callbacksRef.current.setPuzzlesSolved(fn),
        showMsg: (t, c) => callbacksRef.current.showMsg(t, c),
        onPuzzleSolved: (i) => callbacksRef.current.onPuzzleSolved(i),
        onExitReached: () => callbacksRef.current.onExitReached(),
        setLocked: (l) => callbacksRef.current.setLocked(l),
        setNearObj: (n) => callbacksRef.current.setNearObj(n),
        openPuzzleModal: (cfg) => callbacksRef.current.openPuzzleModal(cfg),
        onHintDiscovered: (h) => callbacksRef.current.onHintDiscovered(h),
      },
    );
    return () => { engineRef.current?.dispose(); engineRef.current = null; };
  }, []);

  // Check if all 3 puzzles solved → spawn exit
  useEffect(() => {
    if (solvedPuzzles.size === 3 && engineRef.current) {
      engineRef.current.spawnExit();
      showMsg('🚪 ALL PUZZLES SOLVED! The exit has appeared...', '#2d6a4f');
    }
  }, [solvedPuzzles.size, showMsg]);

  // Toggle journal with Q key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'q' && !activePuzzle) {
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
        setShowJournal(prev => !prev);
      }
      if (e.key === 'Escape' && activePuzzle) {
        setActivePuzzle(null);
        setPuzzleInput('');
        setTimeout(() => containerRef.current?.requestPointerLock(), 200);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [activePuzzle]);

  if (outcome === 'win') {
    const handleClaim = async () => {
      try {
        setClaimPending(true);
        const tx = await claimReward(sessionId);
        if (publicClient) await publicClient.waitForTransactionReceipt({ hash: tx });
        setClaimDone(true);
      } catch (e: any) {
        alert(e.shortMessage || e.message || 'Claim failed');
      } finally {
        setClaimPending(false);
      }
    };
    return (
      <div style={{ width: 800, height: 600, background: '#0a1a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a1a2e', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: '3rem', color: '#2d6a4f', textShadow: '0 0 30px rgba(45,106,79,0.5)' }}>YOU ESCAPED</h1>
        <p style={{ color: '#6a8a6a', fontFamily: 'monospace', marginTop: 10 }}>Session resolved on Monad.</p>
        {claimDone ? (
          <p style={{ color: '#2d6a4f', fontFamily: 'monospace', marginTop: 16, fontSize: '1.1rem' }}>✓ MON claimed to your wallet!</p>
        ) : (
          <button
            onClick={handleClaim}
            disabled={claimPending}
            style={{ marginTop: 20, padding: '12px 32px', background: 'none', border: '1px solid #bfa14a', color: '#bfa14a', cursor: claimPending ? 'not-allowed' : 'pointer', fontFamily: 'monospace', fontSize: 14, opacity: claimPending ? 0.6 : 1 }}
          >
            {claimPending ? 'CLAIMING...' : '⚡ CLAIM YOUR MON REWARD'}
          </button>
        )}
        <button onClick={() => window.location.href = '/'} style={{ marginTop: 12, padding: '8px 24px', background: 'none', border: '1px solid #2d6a4f', color: '#2d6a4f', cursor: 'pointer', fontFamily: 'monospace' }}>Return to Lobby</button>
      </div>
    );
  }

  if (outcome === 'escape_pending') {
    return (
      <div style={{ width: 800, height: 600, background: '#0a1a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a1a2e', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: '2rem', color: '#bfa14a', animation: 'pulse 1.5s infinite' }}>THE WARDEN IS WATCHING</h1>
        <p style={{ color: '#6a8a6a', fontFamily: 'monospace', marginTop: 10 }}>Confirm the transaction in your wallet to unlock the door...</p>
      </div>
    );
  }

  if (outcome === 'error') {
    return (
      <div style={{ width: 800, height: 600, background: '#1a0a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #3a0a0a', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: '2rem', color: '#ff3333' }}>ESCAPE FAILED</h1>
        <p style={{ color: '#aa5555', fontFamily: 'monospace', marginTop: 10 }}>The Warden rejected your proof or the chain reverted.</p>
        <button onClick={() => setOutcome('playing')} style={{ marginTop: 24, padding: '10px 24px', background: 'none', border: '1px solid #ff3333', color: '#ff3333', cursor: 'pointer', fontFamily: 'monospace' }}>Try the door again</button>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative', width: 800, height: 600, margin: '0 auto', border: '2px solid #1a1a2e', borderRadius: 4, overflow: 'hidden' }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {!locked && !activePuzzle && (
        <div onClick={() => containerRef.current?.requestPointerLock()}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', zIndex: 20, cursor: 'pointer', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: '#8b0000', fontFamily: 'monospace', fontSize: '1.2rem', animation: 'pulse 2s ease-in-out infinite' }}>CLICK TO ENTER THE ASYLUM</p>
          <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '0.7rem' }}>WASD move · Mouse look · E interact · Q journal · ESC release</p>
        </div>
      )}

      {/* HUD */}
      <div style={{ position: 'absolute', top: 0, left: 0, padding: 10, zIndex: 10, display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 12 }}>
        <span style={{ color: sanity > 50 ? '#cc3333' : '#ff4400', background: 'rgba(0,0,0,0.7)', padding: '3px 8px' }}>❤ {Math.floor(sanity)}%</span>
        <span style={{ color: '#bfa14a', background: 'rgba(0,0,0,0.7)', padding: '3px 8px' }}>📝 {hints.length} hints</span>
        <span style={{ color: '#2d6a4f', background: 'rgba(0,0,0,0.7)', padding: '3px 8px' }}>🧩 {solvedPuzzles.size}/3</span>
      </div>

      {/* Puzzle progress indicators */}
      <div style={{ position: 'absolute', top: 28, left: 10, zIndex: 10, display: 'flex', gap: 4, fontFamily: 'monospace', fontSize: 9 }}>
        {wardConfig.puzzles.map(p => p.id).map((pid, idx) => (
          <span key={pid} style={{
            width: 18, height: 18, borderRadius: 3,
            background: solvedPuzzles.has(pid) ? '#2d6a4f' : 'rgba(40,40,40,0.7)',
            color: solvedPuzzles.has(pid) ? '#fff' : '#555',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `1px solid ${solvedPuzzles.has(pid) ? '#2d6a4f' : '#333'}`,
          }}>{solvedPuzzles.has(pid) ? '✓' : (idx + 1).toString()}</span>
        ))}
      </div>

      <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'monospace', fontSize: 10, color: '#ff6600', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', border: '1px solid #ff6600', zIndex: 10 }}>DEV</div>

      {/* Crosshair */}
      {locked && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.4)', position: 'absolute', top: -7, left: -1 }} />
        <div style={{ width: 14, height: 2, background: 'rgba(255,255,255,0.4)', position: 'absolute', top: -1, left: -7 }} />
      </div>}

      {nearObj && locked && <div style={{ position: 'absolute', top: '62%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 11, color: '#bfa14a', background: 'rgba(0,0,0,0.7)', padding: '3px 12px', zIndex: 10, pointerEvents: 'none' }}>[E] {nearObj}</div>}
      {msg && <div style={{ position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 13, color: msgColor, background: 'rgba(0,0,0,0.9)', padding: '8px 20px', zIndex: 15, border: `1px solid ${msgColor}33`, maxWidth: 350, textAlign: 'center' }}>{msg}</div>}
      {locked && <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 9, color: '#444', zIndex: 10 }}>WASD move · Mouse look · E interact · Q journal</div>}
      {sanity < 60 && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8, boxShadow: `inset 0 0 ${70 - sanity}px rgba(${sanity < 30 ? '150,0,0' : '80,0,0'},${(60 - sanity) / 120})` }} />}

      {/* ═══ PUZZLE MODAL ═══ */}
      {activePuzzle && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 30,
          background: 'rgba(0,0,0,0.92)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 420, background: '#0c0c14', border: '2px solid #2a1a0a',
            borderRadius: 6, padding: 24, fontFamily: 'monospace',
          }}>
            <h2 style={{ color: '#8b0000', fontSize: 16, marginBottom: 12, textAlign: 'center' }}>
              {activePuzzle.config.title}
            </h2>
            <div style={{ color: '#ccc', fontSize: 11, lineHeight: 1.6, whiteSpace: 'pre-line', marginBottom: 16 }}>
              {activePuzzle.config.description}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); submitPuzzle(); }} style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={puzzleInput}
                onChange={(e) => setPuzzleInput(e.target.value)}
                placeholder="Type your answer..."
                autoFocus
                style={{
                  flex: 1, padding: '8px 12px', background: '#1a1a2e',
                  border: '1px solid #333', color: '#f5f0e1',
                  fontFamily: 'monospace', fontSize: 13, outline: 'none',
                  borderRadius: 3,
                }}
              />
              <button type="submit" style={{
                padding: '8px 16px', background: '#2d6a4f', border: 'none',
                color: '#fff', fontFamily: 'monospace', fontSize: 12,
                cursor: 'pointer', borderRadius: 3,
              }}>Submit</button>
            </form>
            {activePuzzle.feedback && (
              <p style={{ color: activePuzzle.feedbackColor, fontSize: 11, marginTop: 10, textAlign: 'center' }}>
                {activePuzzle.feedback}
              </p>
            )}
            <p style={{ color: '#444', fontSize: 9, marginTop: 12, textAlign: 'center' }}>
              Press ESC to close without answering
            </p>
          </div>
        </div>
      )}

      {/* ═══ HINTS JOURNAL ═══ */}
      {showJournal && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 25,
          background: 'rgba(0,0,0,0.88)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 380, maxHeight: 450, background: '#0c0c14',
            border: '2px solid #bfa14a33', borderRadius: 6,
            padding: 20, fontFamily: 'monospace', overflowY: 'auto',
          }}>
            <h2 style={{ color: '#bfa14a', fontSize: 14, marginBottom: 12, textAlign: 'center' }}>
              📓 INVESTIGATION JOURNAL
            </h2>
            {hints.length === 0 ? (
              <p style={{ color: '#555', fontSize: 11, textAlign: 'center', fontStyle: 'italic' }}>
                No hints discovered yet. Explore the asylum and investigate objects...
              </p>
            ) : (
              hints.map((hint, i) => (
                <div key={i} style={{
                  color: '#ccc', fontSize: 10, lineHeight: 1.5,
                  padding: '8px 0', borderBottom: '1px solid #1a1a2e',
                }}>
                  {hint}
                </div>
              ))
            )}
            <p style={{ color: '#444', fontSize: 9, marginTop: 12, textAlign: 'center' }}>
              Press Q to close
            </p>
          </div>
        </div>
      )}

      <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:1} }`}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// THREE.JS GAME ENGINE
// ═══════════════════════════════════════════════════════════════════

interface CB {
  setSanity: (fn: (s: number) => number) => void;
  setClues: (fn: (c: number) => number) => void;
  setPuzzles: (fn: (p: number) => number) => void;
  showMsg: (t: string, c?: string) => void;
  onPuzzleSolved: (idx: number) => void;
  onExitReached: () => void;
  setLocked: (l: boolean) => void;
  setNearObj: (n: string) => void;
  openPuzzleModal: (config: PuzzleConfig) => void;
  onHintDiscovered: (hintText: string) => void;
}

// Texture paths — pre-generated assets in public/textures/
const TEX = {
  wall: '/textures/wall.png',
  floor: '/textures/floor.png',
  ceiling: '/textures/ceiling.png',
  wood: '/textures/wood.png',
  metal: '/textures/metal.png',
  fabric: '/textures/fabric.png',
};

// Model paths — drop .glb files in public/models/
// If file exists → loads 3D model; if missing → falls back to box geometry
interface ModelDef {
  file: string;       // filename in public/models/
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: number;
}

const FURNITURE_MODELS: ModelDef[] = [];

const OBJ_MODELS: Record<string, string> = {
  'cabinet': 'cabinet.glb',
  'mirror': 'mirror.glb',
  'chair': 'chair.glb',
  'bed': 'hospital_bed.glb',
  'shelf': 'shelf.glb',
};

// Per-model orientation/scale/position fixes so each GLB stands correctly
interface ModelPlacement { scale: number; rotX?: number; rotY?: number; rotZ?: number; yOffset?: number; }
const MODEL_PLACEMENT: Record<string, ModelPlacement> = {
  'cabinet': { scale: 0.9, rotX: Math.PI / 2, yOffset: 0.7 },   // rotate upright + lift to sit on floor
  'mirror':  { scale: 0.6, yOffset: 1.3 },                      // wall-mounted
  'chair':   { scale: 0.7, yOffset: 0 },                        // floor-standing
  'bed':     { scale: 0.6, yOffset: 0 },                        // floor-level
  'shelf':   { scale: 0.7, yOffset: 0 },                        // floor-standing tall
};

// ─── GLOBAL ASSET CACHE ───
const GLOBAL_TEXTURES: Record<string, THREE.Texture> = {};
const GLOBAL_MODELS: Record<string, THREE.Group> = {};
let assetsLoaded = false;
let assetLoadingPromise: Promise<void> | null = null;
const globalTexLoader = new THREE.TextureLoader();
const globalGltfLoader = new GLTFLoader();

async function loadAllAssets(): Promise<void> {
  if (assetsLoaded) return;
  if (assetLoadingPromise) return assetLoadingPromise;

  assetLoadingPromise = new Promise((resolve) => {
    const allModels = new Set<string>();
    FURNITURE_MODELS.forEach(m => allModels.add(m.file));
    Object.values(OBJ_MODELS).forEach(m => allModels.add(m));

    let pending = Object.keys(TEX).length + allModels.size;
    const checkDone = () => {
      if (pending <= 0) { assetsLoaded = true; resolve(); }
    };

    Object.entries(TEX).forEach(([key, url]) => {
      globalTexLoader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        GLOBAL_TEXTURES[key] = tex;
        pending--; checkDone();
      }, undefined, () => {
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, 0, 64, 64);
        GLOBAL_TEXTURES[key] = new THREE.CanvasTexture(c);
        pending--; checkDone();
      });
    });

    allModels.forEach(file => {
      globalGltfLoader.load(`/models/${file}`, (gltf) => {
        GLOBAL_MODELS[file] = gltf.scene;
        pending--; checkDone();
      }, undefined, () => {
        pending--; checkDone();
      });
    });
    
    if (pending === 0) checkDone();
  });

  return assetLoadingPromise;
}

class GameEngine {
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private clock = new THREE.Clock();
  private keys: Record<string, boolean> = {};
  private yaw = 0;
  private pitch = 0;
  private disposed = false;
  private animId = 0;
  private cb: CB;
  private wc: WardConfig;
  private el: HTMLDivElement;
  private sanity = 100;
  private lastSanityInt = 100;
  private investigated = new Set<string>();
  private lastNearLabel = '';
  private clueCount = 0;
  private puzzleCount = 0;
  private exitMesh: THREE.Mesh | null = null;
  private exitTriggered = false;
  private objMeshes: { mesh: THREE.Group; obj: WardObject; glow: THREE.Mesh; label: string }[] = [];
  private flickerLights: { light: THREE.PointLight; bulbMat: THREE.MeshStandardMaterial; speed: number; base: number }[] = [];
  private dustGeo: THREE.BufferGeometry | null = null;
  private solvedPuzzleIds = new Set<string>();
  private ghostMeshes = new Map<string, THREE.Mesh>(); // remote player ghosts

  constructor(el: HTMLDivElement, wc: WardConfig, cb: CB) {
    this.el = el; this.wc = wc; this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ powerPreference: 'high-performance', antialias: false });
    this.renderer.setSize(800, 600);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ReinhardToneMapping;
    this.renderer.toneMappingExposure = 2.2;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    el.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#0c0c14');
    this.scene.fog = new THREE.Fog(0x0c0c14, 5, 18);

    this.camera = new THREE.PerspectiveCamera(75, 800 / 600, 0.1, 50);
    this.camera.position.set(0, 1.6, 3);

    // Load all textures and models then build
    loadAllAssets().then(() => {
      if (this.disposed) return;
      this.buildRoom();
      this.buildFurniture();
      this.buildObjects();
      this.buildDust();
      this.setupInput();
      this.animate();
    });
  }

  // ── Public API for React wrapper ────────────────────────────────────
  getCameraPosition() {
    return { x: this.camera.position.x, y: this.camera.position.y, z: this.camera.position.z };
  }

  getCameraRotation() {
    return { yaw: this.yaw, pitch: this.pitch };
  }

  updateRemotePlayers(players: Map<string, { position: { x: number; y: number }; sanity: number }>) {
    // Remove ghosts for disconnected players
    for (const [wallet, mesh] of this.ghostMeshes) {
      if (!players.has(wallet)) {
        this.scene.remove(mesh);
        mesh.geometry.dispose();
        this.ghostMeshes.delete(wallet);
      }
    }
    // Add/update ghosts for active players
    for (const [wallet, data] of players) {
      let ghost = this.ghostMeshes.get(wallet);
      if (!ghost) {
        const geo = new THREE.SphereGeometry(0.15, 8, 8);
        const mat = new THREE.MeshStandardMaterial({ color: 0x8b0000, emissive: 0x8b0000, emissiveIntensity: 1.5, transparent: true, opacity: 0.7 });
        ghost = new THREE.Mesh(geo, mat);
        this.scene.add(ghost);
        this.ghostMeshes.set(wallet, ghost);
      }
      // Lerp to new position; y=1.6 (eye height)
      ghost.position.lerp(new THREE.Vector3(data.position.x, 1.6, data.position.y), 0.3);
    }
  }

  private tex(name: string, repeatX = 1, repeatY = 1): THREE.Texture {
    const t = GLOBAL_TEXTURES[name] ? GLOBAL_TEXTURES[name].clone() : new THREE.Texture();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    t.needsUpdate = true;
    return t;
  }

  // ═══════════════════════════════════════════════════════════════════
  // ROOM — Textured with loaded assets
  // ═══════════════════════════════════════════════════════════════════

  private buildRoom(): void {
    const RW = 10, RD = 12, RH = 3.8;

    // ── Floor: checkered tile texture ──
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(RW, RD),
      new THREE.MeshStandardMaterial({ map: this.tex('floor', 3, 3), roughness: 0.8 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // ── Ceiling: peeling plaster texture ──
    const ceil = new THREE.Mesh(
      new THREE.PlaneGeometry(RW, RD),
      new THREE.MeshStandardMaterial({ map: this.tex('ceiling', 2, 2), roughness: 0.95 }),
    );
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = RH;
    this.scene.add(ceil);

    // ── Walls: concrete wall texture ──
    const wallData: { w: number; h: number; pos: [number, number, number]; rotY: number; repX: number }[] = [
      { w: RW, h: RH, pos: [0, RH / 2, -RD / 2], rotY: 0, repX: 2.5 },       // back
      { w: RD, h: RH, pos: [-RW / 2, RH / 2, 0], rotY: Math.PI / 2, repX: 3 }, // left
      { w: RD, h: RH, pos: [RW / 2, RH / 2, 0], rotY: -Math.PI / 2, repX: 3 }, // right
      { w: RW, h: RH, pos: [0, RH / 2, RD / 2], rotY: Math.PI, repX: 2.5 },    // front
    ];
    wallData.forEach(({ w, h, pos, rotY, repX }) => {
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: this.tex('wall', repX, 1), roughness: 0.85 }),
      );
      mesh.position.set(...pos);
      mesh.rotation.y = rotY;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });

    // ── Baseboard ──
    const bbMat = new THREE.MeshStandardMaterial({ map: this.tex('wood', 3, 0.3), roughness: 0.9 });
    [[0, 0.06, -RD / 2 + 0.05, RW, 0.12, 0.1],
     [0, 0.06, RD / 2 - 0.05, RW, 0.12, 0.1],
     [-RW / 2 + 0.05, 0.06, 0, 0.1, 0.12, RD],
     [RW / 2 - 0.05, 0.06, 0, 0.1, 0.12, RD],
    ].forEach(([x, y, z, w, h, d]) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), bbMat);
      m.position.set(x, y, z);
      this.scene.add(m);
    });

    // ── Graffiti text on walls (decals) ──
    this.addGraffiti('GET OUT', -4.8, 1.8, -5.95, 0);
    this.addGraffiti('HELP ME', 4.8, 1.4, -5.95, 0);
    this.addGraffiti('NO ESCAPE', -4.95, 1.6, 2, Math.PI / 2);
    this.addGraffiti('WARD 9', 4.95, 2.0, -3, -Math.PI / 2);
    this.addGraffiti('REST IN PEACE', 0, 1.2, 5.95, Math.PI);

    // ── Blood stains ──
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, transparent: true, opacity: 0.45, roughness: 1 });
    [[-3, -4, 0.8], [2, 1, 1.1], [4, -3, 0.6], [-1, 4, 0.9], [-4, 2, 0.5], [1, -2, 0.7]].forEach(([x, z, r]) => {
      const blood = new THREE.Mesh(new THREE.CircleGeometry(r, 12), bloodMat.clone());
      blood.rotation.x = -Math.PI / 2;
      blood.position.set(x, 0.01, z);
      this.scene.add(blood);
    });

    // ── Lighting ──
    this.scene.add(new THREE.AmbientLight(0xccc8bb, 0.35));
    this.scene.add(new THREE.HemisphereLight(0x8888aa, 0x221100, 0.4));

    // Main overhead
    const main = new THREE.PointLight(0xffcc88, 3, 14, 1.5);
    main.position.set(0, 3.5, -1);
    main.castShadow = true; main.shadow.mapSize.set(512, 512);
    this.scene.add(main);
    this.flickerLights.push({ light: main, bulbMat: this.makeBulb(0, 3.5, -1, 0xffcc88), speed: 2.5, base: 3 });

    // Wall sconces
    [[-4.5, 2.6, -5], [4.5, 2.6, -5], [-4.5, 2.6, 4], [4.5, 2.6, 4], [0, 2.8, 5.5]].forEach(([x, y, z], i) => {
      const sl = new THREE.PointLight(0xff9955, 1.5, 9, 2);
      sl.position.set(x, y, z);
      sl.castShadow = true; sl.shadow.mapSize.set(256, 256);
      this.scene.add(sl);
      this.flickerLights.push({ light: sl, bulbMat: this.makeBulb(x, y, z, 0xff9955), speed: 1.3 + i * 0.35, base: 1.5 });
      // Bracket
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.1, 0.12), new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.7, metalness: 0.4 }));
      b.position.set(x, y + 0.12, z);
      this.scene.add(b);
    });

    this.scene.add(new THREE.DirectionalLight(0x556677, 0.25));
  }

  private addGraffiti(text: string, x: number, y: number, z: number, ry: number): void {
    const c = document.createElement('canvas'); c.width = 512; c.height = 128;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 52px monospace';
    ctx.fillStyle = '#6a0000';
    ctx.fillText(text, 16, 80);
    // drips
    for (let i = 0; i < text.length; i++) {
      if (Math.random() > 0.4) {
        ctx.fillStyle = `rgba(80,0,0,${0.3 + Math.random() * 0.4})`;
        ctx.fillRect(16 + i * 30 + 8, 82, 2, 15 + Math.random() * 30);
      }
    }
    const tex = new THREE.CanvasTexture(c);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(3.2, 0.8),
      new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.75, emissive: new THREE.Color(0x2a0000), emissiveIntensity: 0.3, side: THREE.DoubleSide }),
    );
    mesh.position.set(x, y, z);
    mesh.rotation.y = ry;
    this.scene.add(mesh);
  }

  private makeBulb(x: number, y: number, z: number, color: number): THREE.MeshStandardMaterial {
    const mat = new THREE.MeshStandardMaterial({ color, emissive: new THREE.Color(color), emissiveIntensity: 3 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat);
    bulb.position.set(x, y + 0.08, z);
    this.scene.add(bulb);
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    wire.position.set(x, y + 0.28, z);
    this.scene.add(wire);
    return mat;
  }

  // ═══════════════════════════════════════════════════════════════════
  // MODEL LOADING — tries GLB first, falls back to box geometry
  // ═══════════════════════════════════════════════════════════════════

  private loadModel(file: string, pos: [number, number, number], scale: number, rot?: [number, number, number], fallback?: () => THREE.Object3D): void {
    if (GLOBAL_MODELS[file]) {
      const model = GLOBAL_MODELS[file].clone();
      model.position.set(...pos);
      model.scale.setScalar(scale);
      if (rot) model.rotation.set(...rot);
      model.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      this.scene.add(model);
    } else if (fallback) {
      // GLB not found — use fallback box geometry
      const fb = fallback();
      fb.position.set(...pos);
      if (rot) fb.rotation.set(...rot);
      this.scene.add(fb);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // FURNITURE — Mix of GLB models and box geometry
  // ═══════════════════════════════════════════════════════════════════

  private buildFurniture(): void {
    const metalMat = () => new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.6, metalness: 0.4 });

    // ═══ EXIT DOOR — on the back wall (remains as static box geometry fallback if no GLB) ═══
    const doorGroup = new THREE.Group();
    const darkWood = new THREE.MeshStandardMaterial({ map: this.tex('wood', 1, 2), roughness: 0.8, color: 0x2a1a0a });
    doorGroup.add(this.box(0.12, 2.5, 0.18, -0.54, 1.25, 0, metalMat()));
    doorGroup.add(this.box(0.12, 2.5, 0.18, 0.54, 1.25, 0, metalMat()));
    doorGroup.add(this.box(1.2, 0.1, 0.18, 0, 2.5, 0, metalMat()));
    doorGroup.add(this.box(0.96, 2.38, 0.06, 0, 1.2, -0.05, darkWood));
    const pMat = new THREE.MeshStandardMaterial({ map: this.tex('wood', 0.5, 1), roughness: 0.85, color: 0x321c0e });
    doorGroup.add(this.box(0.35, 0.75, 0.02, -0.22, 1.75, -0.1, pMat));
    doorGroup.add(this.box(0.35, 0.75, 0.02, 0.22, 1.75, -0.1, pMat));
    doorGroup.add(this.box(0.35, 0.75, 0.02, -0.22, 0.65, -0.1, pMat));
    doorGroup.add(this.box(0.35, 0.75, 0.02, 0.22, 0.65, -0.1, pMat));
    const hMat = new THREE.MeshStandardMaterial({ color: 0x886633, roughness: 0.4, metalness: 0.6 });
    doorGroup.add(this.box(0.03, 0.12, 0.06, 0.38, 1.1, -0.12, hMat));
    const hiMat = new THREE.MeshStandardMaterial({ map: this.tex('metal', 0.5, 0.5), roughness: 0.5, metalness: 0.5 });
    [0.5, 1.5, 2.2].forEach((hy) => doorGroup.add(this.box(0.06, 0.08, 0.04, -0.48, hy, -0.05, hiMat)));
    doorGroup.position.set(2.5, 0, -5.92);
    this.scene.add(doorGroup);

    // ═══ SCARY ATMOSPHERIC PROPS (non-interactive) ═══

    const scaryMetal = new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.7, metalness: 0.5, color: 0x5a4a3a });
    const bloodMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, transparent: true, opacity: 0.5, roughness: 1 });
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 0.5, metalness: 0.7 });

    // ── Hanging chains from ceiling ──
    [[-3.5, 4], [3.5, -4], [0, -5], [-4, 1]].forEach(([cx, cz]) => {
      const chainLen = 0.8 + Math.random() * 1.2;
      for (let i = 0; i < 6; i++) {
        const link = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.008, 6, 8), chainMat);
        link.position.set(cx, 3.8 - i * (chainLen / 6), cz);
        link.rotation.x = i % 2 === 0 ? 0 : Math.PI / 2;
        this.scene.add(link);
      }
    });

    // ── Overturned gurney (back-left area) ──
    const gurney = new THREE.Group();
    gurney.add(this.box(0.7, 0.04, 1.4, 0, 0, 0, scaryMetal));
    [[-0.28, -0.55], [0.28, -0.55], [-0.28, 0.55], [0.28, 0.55]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.4, 6), scaryMetal.clone());
      leg.position.set(lx, -0.2, lz); gurney.add(leg);
    });
    gurney.position.set(-3, 0.5, 4);
    gurney.rotation.z = 0.8; gurney.rotation.x = 0.2;
    this.scene.add(gurney);

    // ── Rusty bucket with dark liquid ──
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 0.22, 8), scaryMetal.clone());
    bucket.position.set(1.5, 0.11, 4.5);
    this.scene.add(bucket);
    const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.11, 12), bloodMat.clone());
    liquid.rotation.x = -Math.PI / 2; liquid.position.set(1.5, 0.22, 4.5);
    this.scene.add(liquid);

    // ── Scattered surgical tools on the floor ──
    const toolMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
    // Scalpel
    const scalpel = new THREE.Group();
    scalpel.add(this.box(0.015, 0.008, 0.12, 0, 0, 0, toolMat));
    scalpel.add(this.box(0.02, 0.01, 0.06, 0, 0, 0.09, new THREE.MeshStandardMaterial({ color: 0x4a3020, roughness: 0.9 })));
    scalpel.position.set(0.5, 0.005, -2); scalpel.rotation.y = 0.7;
    this.scene.add(scalpel);
    // Syringe
    const syringe = new THREE.Group();
    syringe.add(this.box(0.012, 0.012, 0.15, 0, 0, 0, toolMat.clone()));
    syringe.add(this.box(0.025, 0.025, 0.02, 0, 0, 0.085, toolMat.clone()));
    syringe.position.set(-0.8, 0.006, 1); syringe.rotation.y = -0.4;
    this.scene.add(syringe);
    // Bone saw
    const boneSaw = new THREE.Group();
    boneSaw.add(this.box(0.02, 0.008, 0.2, 0, 0, 0, toolMat.clone()));
    boneSaw.add(this.box(0.008, 0.04, 0.06, 0, 0.02, 0.13, new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 0.9 })));
    boneSaw.position.set(2, 0.004, 1.5); boneSaw.rotation.y = 1.2;
    this.scene.add(boneSaw);

    // ── Wall scratch marks (on the left wall) ──
    const scratchMat = new THREE.MeshStandardMaterial({ color: 0x2a1a0a, transparent: true, opacity: 0.5, roughness: 1, side: THREE.DoubleSide });
    for (let i = 0; i < 5; i++) {
      const scratch = new THREE.Mesh(new THREE.PlaneGeometry(0.015, 0.3 + Math.random() * 0.4), scratchMat);
      scratch.position.set(-4.94, 1.0 + Math.random() * 1.0, -4 + i * 0.15);
      scratch.rotation.y = Math.PI / 2;
      scratch.rotation.z = -0.15 + Math.random() * 0.3;
      this.scene.add(scratch);
    }

    // ── Straitjacket draped over an overturned stool ──
    const stool = new THREE.Group();
    const stoolWood = new THREE.MeshStandardMaterial({ map: this.tex('wood', 1, 1), roughness: 0.9, color: 0x4a3a2a });
    stool.add(this.box(0.32, 0.04, 0.32, 0, 0, 0, stoolWood));
    [[-0.11, -0.11], [0.11, -0.11], [-0.11, 0.11], [0.11, 0.11]].forEach(([lx, lz]) =>
      stool.add(this.box(0.03, 0.35, 0.03, lx, -0.18, lz, stoolWood.clone())));
    stool.position.set(1, 0.2, -1); stool.rotation.z = 1.1; stool.rotation.x = 0.2;
    this.scene.add(stool);
    // Draped fabric
    const jacket = new THREE.Mesh(
      new THREE.PlaneGeometry(0.5, 0.6),
      new THREE.MeshStandardMaterial({ map: this.tex('fabric', 1, 1), color: 0xbfb8a0, roughness: 1, side: THREE.DoubleSide }),
    );
    jacket.position.set(1.1, 0.35, -0.9); jacket.rotation.x = -0.6; jacket.rotation.z = 0.3;
    this.scene.add(jacket);

    // ── Flickering candles on the floor (occult vibes) ──
    const candleMat = new THREE.MeshStandardMaterial({ color: 0xddd0b0, roughness: 0.9 });
    const flameMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: new THREE.Color(0xff4400), emissiveIntensity: 3, transparent: true, opacity: 0.8 });
    [[-1, -4.5], [0.5, -4.8], [-0.5, -5.2]].forEach(([cx, cz]) => {
      // Candle body
      const candle = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 0.12, 8), candleMat);
      candle.position.set(cx, 0.06, cz); this.scene.add(candle);
      // Flame
      const flame = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), flameMat);
      flame.position.set(cx, 0.13, cz); this.scene.add(flame);
      // Faint point light
      const candleLight = new THREE.PointLight(0xff6633, 0.3, 3, 2);
      candleLight.position.set(cx, 0.15, cz); this.scene.add(candleLight);
    });

    // ── Extra blood pools ──
    [[-2.5, 3, 0.6], [3, -1, 0.4], [-3.5, -5, 0.5], [0, 3, 0.7]].forEach(([bx, bz, br]) => {
      const blood = new THREE.Mesh(new THREE.CircleGeometry(br, 12), bloodMat.clone());
      blood.rotation.x = -Math.PI / 2; blood.position.set(bx, 0.005, bz);
      this.scene.add(blood);
    });

    // ═══ CENTER-ROOM HORROR PROPS ═══

    // ── Large pentagram / ritual circle on the floor (dead center) ──
    const pentMat = new THREE.MeshStandardMaterial({ color: 0x5a0000, transparent: true, opacity: 0.4, roughness: 1, side: THREE.DoubleSide });
    const pentCircle = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 32), pentMat);
    pentCircle.rotation.x = -Math.PI / 2; pentCircle.position.set(0, 0.006, 0);
    this.scene.add(pentCircle);
    // Inner circle
    const innerCircle = new THREE.Mesh(new THREE.RingGeometry(0.8, 0.85, 32), pentMat.clone());
    innerCircle.rotation.x = -Math.PI / 2; innerCircle.position.set(0, 0.007, 0);
    this.scene.add(innerCircle);
    // Star lines (pentagram)
    const starMat = new THREE.MeshStandardMaterial({ color: 0x5a0000, transparent: true, opacity: 0.35, roughness: 1 });
    for (let i = 0; i < 5; i++) {
      const angle1 = (i * 2 * Math.PI) / 5 - Math.PI / 2;
      const angle2 = ((i * 2 + 2) * Math.PI) / 5 - Math.PI / 2;
      const x1 = Math.cos(angle1) * 1.1, z1 = Math.sin(angle1) * 1.1;
      const x2 = Math.cos(angle2) * 1.1, z2 = Math.sin(angle2) * 1.1;
      const dx = x2 - x1, dz = z2 - z1;
      const len = Math.sqrt(dx * dx + dz * dz);
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.03, len), starMat);
      line.position.set((x1 + x2) / 2, 0.008, (z1 + z2) / 2);
      line.rotation.x = -Math.PI / 2;
      line.rotation.z = -Math.atan2(dz, dx);
      this.scene.add(line);
    }

    // ── Broken wheelchair in the center-right ──
    const wcGroup = new THREE.Group();
    const wcMetal = new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.65, metalness: 0.5, color: 0x555555 });
    // Seat
    wcGroup.add(this.box(0.48, 0.03, 0.42, 0, 0.45, 0, wcMetal));
    // Back
    wcGroup.add(this.box(0.48, 0.5, 0.03, 0, 0.7, -0.2, wcMetal.clone()));
    // Armrests
    wcGroup.add(this.box(0.03, 0.18, 0.35, -0.23, 0.55, 0.05, wcMetal.clone()));
    wcGroup.add(this.box(0.03, 0.18, 0.35, 0.23, 0.55, 0.05, wcMetal.clone()));
    // Wheels
    [-0.28, 0.28].forEach((wx) => {
      const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.02, 8, 16), wcMetal.clone());
      wheel.rotation.y = Math.PI / 2; wheel.position.set(wx, 0.24, 0); wcGroup.add(wheel);
    });
    wcGroup.position.set(2, 0, 0.5);
    wcGroup.rotation.y = -0.3; wcGroup.rotation.z = 0.15; // slightly tilted
    this.scene.add(wcGroup);

    // ── IV drip stand with blood bag (center-left) ──
    const ivGroup = new THREE.Group();
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.4, metalness: 0.6 });
    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.8, 6), poleMat);
    pole.position.y = 0.9; ivGroup.add(pole);
    // Base cross
    ivGroup.add(this.box(0.4, 0.02, 0.04, 0, 0.01, 0, poleMat.clone()));
    ivGroup.add(this.box(0.04, 0.02, 0.4, 0, 0.01, 0, poleMat.clone()));
    // Hook at top
    const hook = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 8, Math.PI), poleMat.clone());
    hook.position.set(0, 1.82, 0); hook.rotation.x = Math.PI; ivGroup.add(hook);
    // Blood bag
    const bagMat = new THREE.MeshStandardMaterial({ color: 0x660000, transparent: true, opacity: 0.85, roughness: 0.8 });
    const bag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.15, 0.03), bagMat);
    bag.position.set(0, 1.65, 0); ivGroup.add(bag);
    // Tube dangling
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x440000, transparent: true, opacity: 0.7 }));
    tube.position.set(0.02, 1.32, 0); tube.rotation.z = 0.1; ivGroup.add(tube);
    ivGroup.position.set(-0.8, 0, -0.5);
    this.scene.add(ivGroup);

    // ── Scattered bones on the floor ──
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd4c8a0, roughness: 0.9 });
    [[0.3, 1.5, 0.3], [-0.5, -0.8, -0.5], [1.2, -1.5, 0.8], [-1.0, 0.5, 1.2], [0.8, 0.8, -0.3]].forEach(([bx, bz, rot]) => {
      const bone = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.12, 4, 6), boneMat);
      bone.position.set(bx, 0.012, bz); bone.rotation.y = rot; bone.rotation.z = Math.PI / 2;
      this.scene.add(bone);
    });
    // Skull (center of pentagram)
    const skullMat = new THREE.MeshStandardMaterial({ color: 0xccc0a0, roughness: 0.85 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skullMat);
    skull.position.set(0, 0.08, 0); skull.scale.set(1, 0.85, 1.1);
    this.scene.add(skull);
    // Jaw
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.05), skullMat.clone());
    jaw.position.set(0, 0.02, 0.06); jaw.rotation.x = 0.2;
    this.scene.add(jaw);

    // ── Blood drag marks across the floor ──
    const dragMat = new THREE.MeshStandardMaterial({ color: 0x3a0000, transparent: true, opacity: 0.3, roughness: 1, side: THREE.DoubleSide });
    // Long drag streak from center to back wall
    const drag1 = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4), dragMat);
    drag1.rotation.x = -Math.PI / 2; drag1.position.set(0.3, 0.004, -2.5); drag1.rotation.z = 0.1;
    this.scene.add(drag1);
    // Shorter drag from center toward left wall
    const drag2 = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 2.5), dragMat.clone());
    drag2.rotation.x = -Math.PI / 2; drag2.position.set(-1.5, 0.004, 0.5); drag2.rotation.z = 1.2;
    this.scene.add(drag2);

    // ── More blood splatters in center ──
    [[0.5, 0.5, 0.35], [-0.3, -0.5, 0.25], [1.5, 0, 0.3], [-1, 1, 0.4], [0, -1.5, 0.5]].forEach(([sx, sz, sr]) => {
      const splat = new THREE.Mesh(new THREE.CircleGeometry(sr, 10), bloodMat.clone());
      splat.rotation.x = -Math.PI / 2; splat.position.set(sx, 0.004, sz);
      this.scene.add(splat);
    });

    // ── Hanging noose from center ceiling ──
    const ropeMat = new THREE.MeshStandardMaterial({ color: 0x7a6a50, roughness: 0.95 });
    const rope = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 1.5, 4), ropeMat);
    rope.position.set(0, 3.05, -2); this.scene.add(rope);
    const noose = new THREE.Mesh(new THREE.TorusGeometry(0.08, 0.012, 6, 12, Math.PI * 1.5), ropeMat.clone());
    noose.position.set(0, 2.25, -2); noose.rotation.y = Math.PI / 4;
    this.scene.add(noose);
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTIVE OBJECTS — Built with procedural geometry
  // ═══════════════════════════════════════════════════════════════════

  private buildObjects(): void {
    if (!this.wc?.objects) return;
    const woodMat = () => new THREE.MeshStandardMaterial({ map: this.tex('wood', 1, 1), roughness: 0.85 });
    const metalMat = () => new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.6, metalness: 0.4 });
    const fabricMat = () => new THREE.MeshStandardMaterial({ map: this.tex('fabric', 1, 1), roughness: 0.95 });

    this.wc.objects.forEach((obj) => {
      const x = obj.x;
      const z = obj.z;

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      group.rotation.y = obj.rotY;
      this.scene.add(group);

      const label = this.buildFurniturePiece(group, obj.type, woodMat, metalMat, fabricMat);

      // Glow ring on floor
      const gc = obj.hasClue ? 0x2d6a4f : 0x663322;
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.35, 0.55, 20),
        new THREE.MeshStandardMaterial({ color: gc, emissive: new THREE.Color(gc), emissiveIntensity: 1.5, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, 0.02, z);
      this.scene.add(glow);

      this.objMeshes.push({ mesh: group, obj, glow, label });
    });
  }

  /** Build a detailed procedural furniture piece and return a label string */
  private buildFurniturePiece(
    group: THREE.Group,
    type: string,
    woodMat: () => THREE.MeshStandardMaterial,
    metalMat: () => THREE.MeshStandardMaterial,
    fabricMat: () => THREE.MeshStandardMaterial,
  ): string {
    switch (type) {
      case 'cabinet': {
        // Tall upright cabinet — 0.7w × 1.5h × 0.4d
        const body = woodMat(); body.color = new THREE.Color(0x4a3525);
        group.add(this.box(0.7, 1.5, 0.4, 0, 0.75, 0, body));
        // Left door
        const doorMat = woodMat(); doorMat.color = new THREE.Color(0x5a4030);
        group.add(this.box(0.33, 1.35, 0.025, -0.16, 0.75, 0.21, doorMat));
        // Right door
        group.add(this.box(0.33, 1.35, 0.025, 0.16, 0.75, 0.21, doorMat.clone()));
        // Door handles
        const hMat = metalMat();
        group.add(this.box(0.02, 0.08, 0.03, -0.03, 0.8, 0.23, hMat));
        group.add(this.box(0.02, 0.08, 0.03, 0.03, 0.8, 0.23, hMat.clone()));
        // Internal shelves (visible through gap)
        const shelfMat = woodMat(); shelfMat.color = new THREE.Color(0x3a2a1a);
        group.add(this.box(0.64, 0.02, 0.35, 0, 0.5, 0, shelfMat));
        group.add(this.box(0.64, 0.02, 0.35, 0, 1.0, 0, shelfMat.clone()));
        // Top trim
        group.add(this.box(0.74, 0.04, 0.44, 0, 1.52, 0, body.clone()));
        return 'Cabinet';
      }

      case 'chair': {
        // Wooden chair with backrest
        const w = woodMat(); w.color = new THREE.Color(0x5c3d2e);
        // Seat
        group.add(this.box(0.42, 0.04, 0.42, 0, 0.44, 0, w));
        // 4 legs
        [[-0.16, -0.16], [0.16, -0.16], [-0.16, 0.16], [0.16, 0.16]].forEach(([lx, lz]) =>
          group.add(this.box(0.04, 0.44, 0.04, lx, 0.22, lz, w.clone())));
        // Backrest
        const back = woodMat(); back.color = new THREE.Color(0x4a2e1e);
        group.add(this.box(0.38, 0.45, 0.03, 0, 0.7, -0.19, back));
        // Backrest horizontal slats
        group.add(this.box(0.34, 0.03, 0.025, 0, 0.58, -0.19, back.clone()));
        group.add(this.box(0.34, 0.03, 0.025, 0, 0.78, -0.19, back.clone()));
        return 'Chair';
      }

      case 'bed': {
        // Hospital-style metal bed frame with mattress
        const m = metalMat();
        // Frame rails (long sides)
        group.add(this.box(0.04, 0.05, 1.8, -0.45, 0.35, 0, m));
        group.add(this.box(0.04, 0.05, 1.8, 0.45, 0.35, 0, m.clone()));
        // 4 legs
        [[-0.45, -0.85], [0.45, -0.85], [-0.45, 0.85], [0.45, 0.85]].forEach(([lx, lz]) =>
          group.add(this.box(0.04, 0.35, 0.04, lx, 0.175, lz, m.clone())));
        // Headboard (metal bars)
        group.add(this.box(0.9, 0.6, 0.04, 0, 0.65, -0.88, m.clone()));
        // Footboard (shorter)
        group.add(this.box(0.9, 0.35, 0.04, 0, 0.5, 0.88, m.clone()));
        // Mattress
        const fm = fabricMat(); fm.color = new THREE.Color(0x8a8a7a);
        group.add(this.box(0.85, 0.12, 1.7, 0, 0.44, 0, fm));
        // Pillow
        const pil = fabricMat(); pil.color = new THREE.Color(0xaaa89a);
        group.add(this.box(0.35, 0.08, 0.25, 0, 0.54, -0.65, pil));
        return 'Bed';
      }

      case 'shelf': {
        // Tall bookshelf/storage shelf — 0.8w × 1.8h × 0.3d
        const w = woodMat(); w.color = new THREE.Color(0x3e2c1c);
        // Left & right panels
        group.add(this.box(0.03, 1.8, 0.3, -0.39, 0.9, 0, w));
        group.add(this.box(0.03, 1.8, 0.3, 0.39, 0.9, 0, w.clone()));
        // Back panel
        group.add(this.box(0.75, 1.76, 0.02, 0, 0.9, -0.14, w.clone()));
        // 4 horizontal shelf boards
        const sb = woodMat(); sb.color = new THREE.Color(0x4a3620);
        [0.02, 0.45, 0.9, 1.35, 1.78].forEach((hy) =>
          group.add(this.box(0.75, 0.03, 0.28, 0, hy, 0, sb.clone())));
        return 'Shelf';
      }

      case 'mirror': {
        // Wall-mounted mirror: wooden frame + reflective glass
        const frame = woodMat(); frame.color = new THREE.Color(0x3a2a1a);
        // Frame border
        group.add(this.box(0.6, 0.9, 0.04, 0, 1.4, 0, frame));
        // Mirror glass (reflective surface)
        const glass = new THREE.MeshStandardMaterial({
          color: 0x99aabb, metalness: 0.85, roughness: 0.1,
          envMapIntensity: 1.5,
        });
        group.add(this.box(0.5, 0.75, 0.015, 0, 1.4, 0.02, glass));
        // Top decorative molding
        group.add(this.box(0.64, 0.04, 0.06, 0, 1.87, 0, frame.clone()));
        // Bottom molding
        group.add(this.box(0.64, 0.04, 0.06, 0, 0.93, 0, frame.clone()));
        return 'Mirror';
      }

      default: {
        const fallback = woodMat();
        group.add(this.box(0.4, 0.4, 0.4, 0, 0.2, 0, fallback));
        return 'Object';
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // DUST PARTICLES
  // ═══════════════════════════════════════════════════════════════════

  private buildDust(): void {
    const N = 200;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 9;
      pos[i * 3 + 1] = Math.random() * 3.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 11;
    }
    this.dustGeo = new THREE.BufferGeometry();
    this.dustGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.scene.add(new THREE.Points(this.dustGeo, new THREE.PointsMaterial({ color: 0xccbbaa, size: 0.02, transparent: true, opacity: 0.45 })));
  }

  // ═══════════════════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════════════════

  private handleKeyDown = (e: KeyboardEvent) => { 
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys[e.key.toLowerCase()] = true; 
    if (e.key.toLowerCase() === 'e') this.interact(); 
  };
  private handleKeyUp = (e: KeyboardEvent) => { 
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    this.keys[e.key.toLowerCase()] = false; 
  };
  private handlePointerLock = () => { 
    this.cb.setLocked(document.pointerLockElement === this.el); 
  };
  private handleMouseMove = (e: MouseEvent) => {
    if (document.pointerLockElement !== this.el) return;
    this.yaw -= e.movementX * 0.002;
    this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.002));
  };

  private setupInput(): void {
    if (this.disposed) return;
    window.addEventListener('keydown', this.handleKeyDown);
    window.addEventListener('keyup', this.handleKeyUp);
    document.addEventListener('pointerlockchange', this.handlePointerLock);
    document.addEventListener('mousemove', this.handleMouseMove);
  }


  private interact(): void {
    let best: { idx: number; dist: number } | null = null;
    this.objMeshes.forEach(({ mesh }, i) => {
      const d = this.camera.position.distanceTo(mesh.position);
      if (d < 2.5 && (!best || d < best.dist)) best = { idx: i, dist: d };
    });
    if (!best) { this.cb.showMsg('Nothing within reach...', '#555'); return; }
    const { obj, glow } = this.objMeshes[(best as { idx: number; dist: number }).idx];
    if (this.investigated.has(obj.id)) {
      // Allow re-opening a puzzle if it's not yet solved
      if (obj.puzzleId && !this.solvedPuzzleIds.has(obj.puzzleId)) {
        const puzzleConfig = this.wc.puzzles.find(p => p.id === obj.puzzleId);
        if (puzzleConfig) {
          this.cb.openPuzzleModal(puzzleConfig);
        }
        return;
      }
      this.cb.showMsg('Already investigated.', '#444');
      return;
    }
    this.investigated.add(obj.id);
    glow.visible = false;

    // Scare objects — jump scare effect
    if (obj.isScary) {
      this.sanity = Math.max(0, this.sanity + DEFAULT_SANITY_CONFIG.drainRates.jump_scare);
      this.cb.setSanity(() => this.sanity);
      this.cb.showMsg('!!!', '#ff0000');
      const ox = this.camera.position.x, oy = this.camera.position.y;
      let t = 0;
      const sh = () => { t += 16; if (t > 300) { this.camera.position.x = ox; this.camera.position.y = oy; return; }
        this.camera.position.x = ox + (Math.random() - 0.5) * 0.08;
        this.camera.position.y = oy + (Math.random() - 0.5) * 0.04;
        requestAnimationFrame(sh);
      }; sh();
      // Still reveal hint if scare object has one
      if (obj.hintForPuzzle && obj.hintText) {
        setTimeout(() => {
          this.cb.onHintDiscovered(obj.hintText!);
          this.cb.showMsg('📝 You found a hint! Press Q to view journal.', '#bfa14a');
        }, 500);
      }
      return;
    }

    // Puzzle objects — open the puzzle modal
    if (obj.puzzleId) {
      if (this.solvedPuzzleIds.has(obj.puzzleId)) {
        this.cb.showMsg('This puzzle is already solved. ✓', '#2d6a4f');
        return;
      }
      const puzzleConfig = this.wc.puzzles.find(p => p.id === obj.puzzleId);
      if (puzzleConfig) {
        this.cb.openPuzzleModal(puzzleConfig);
        return;
      }
    }

    // Hint objects — reveal a hint for a puzzle
    if (obj.hintForPuzzle && obj.hintText) {
      this.cb.onHintDiscovered(obj.hintText);
      this.cb.showMsg('📝 Hint discovered! Press Q to view your journal.', '#bfa14a');
      return;
    }

    // Plain flavor text objects
    this.cb.showMsg(obj.flavorText || 'Dust and silence...', '#8b0000');
    this.sanity = Math.max(0, this.sanity + DEFAULT_SANITY_CONFIG.drainRates.red_herring);
    this.cb.setSanity(() => this.sanity);
  }

  // ═══════════════════════════════════════════════════════════════════
  // PUBLIC API — called from React component
  // ═══════════════════════════════════════════════════════════════════

  /** Mark a puzzle as solved (called by React after successful input) */
  markPuzzleSolved(puzzleId: PuzzleId): void {
    this.solvedPuzzleIds.add(puzzleId);
    this.puzzleCount++;
    // Change the glow ring of the solved puzzle object to green
    this.objMeshes.forEach(({ obj, glow }) => {
      if (obj.puzzleId === puzzleId) {
        const mat = glow.material as THREE.MeshStandardMaterial;
        mat.color.setHex(0x2d6a4f);
        mat.emissive.setHex(0x2d6a4f);
        glow.visible = true; // Show solved glow
      }
    });
  }

  /** Drain sanity from React (e.g. wrong puzzle answer) */
  drainSanity(amount: number): void {
    this.sanity = Math.max(0, this.sanity + amount);
  }

  /** Spawn the exit door (called when all 6 puzzles are solved) */
  spawnExit(): void {
    if (this.exitMesh) return; // Already spawned
    this.exitMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.8, 2.2, 0.2),
      new THREE.MeshStandardMaterial({ color: 0x2d6a4f, emissive: new THREE.Color(0x2d6a4f), emissiveIntensity: 2, transparent: true, opacity: 0.9 }),
    );
    this.exitMesh.position.set(0, 1.1, -5.85);
    this.scene.add(this.exitMesh);
  }

  // ═══════════════════════════════════════════════════════════════════
  // ANIMATE
  // ═══════════════════════════════════════════════════════════════════

  private animate = (): void => {
    if (this.disposed) return;
    this.animId = requestAnimationFrame(this.animate);
    const dt = this.clock.getDelta();
    const t = this.clock.getElapsedTime();

    if (document.pointerLockElement === this.el) {
      const spd = 3.5 * dt;
      const front = new THREE.Vector3(0, 0, -1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const right = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
      const dir = new THREE.Vector3();
      if (this.keys['w']) dir.add(front);
      if (this.keys['s']) dir.sub(front);
      if (this.keys['a']) dir.sub(right);
      if (this.keys['d']) dir.add(right);
      if (dir.lengthSq() > 0) {
        dir.normalize().multiplyScalar(spd);
        const nx = this.camera.position.x + dir.x;
        const nz = this.camera.position.z + dir.z;
        if (nx > -4.5 && nx < 4.5 && nz > -5.5 && nz < 5.5) {
          this.camera.position.x = nx;
          this.camera.position.z = nz;
        }
      }
      this.camera.quaternion.setFromEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ'));

      let nearLabel = '';
      this.objMeshes.forEach(({ mesh, obj, label }) => {
        if (this.investigated.has(obj.id)) return;
        if (this.camera.position.distanceTo(mesh.position) < 2.5) nearLabel = label;
      });
      if (nearLabel !== this.lastNearLabel) {
        this.lastNearLabel = nearLabel;
        this.cb.setNearObj(nearLabel);
      }

      // Sanity regen
      if (!this.keys['w'] && !this.keys['s'] && !this.keys['a'] && !this.keys['d']) {
        this.sanity = Math.min(100, this.sanity + 0.3 * dt);
      }
      
      const sanityInt = Math.floor(this.sanity);
      if (sanityInt !== this.lastSanityInt) {
        this.lastSanityInt = sanityInt;
        this.cb.setSanity(() => this.sanity);
      }
      if (this.exitMesh && this.camera.position.distanceTo(this.exitMesh.position) < 1.5) {
        if (!this.exitTriggered) {
          this.exitTriggered = true;
          this.cb.onExitReached();
        }
      }
    }

    // Flicker
    this.flickerLights.forEach(({ light, bulbMat, speed, base }) => {
      const f = Math.sin(t * speed * 3) * 0.3 + Math.sin(t * speed * 7.3) * 0.15 + Math.sin(t * speed * 13.7) * 0.08;
      const cut = Math.random() > 0.993 ? 0 : 1;
      light.intensity = Math.max(0.15, (base + f * base * 0.35) * cut);
      bulbMat.emissiveIntensity = light.intensity * 0.7;
    });

    // Glow
    this.objMeshes.forEach(({ glow }) => {
      if (!glow.visible) return;
      (glow.material as THREE.MeshStandardMaterial).opacity = 0.25 + Math.sin(t * 2.5) * 0.12;
      glow.scale.setScalar(1 + Math.sin(t * 2) * 0.08);
    });

    // Dust
    if (this.dustGeo) {
      const p = this.dustGeo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) + 0.002;
        if (y > 3.5) y = 0;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(t + i * 0.1) * 0.001);
      }
      p.needsUpdate = true;
    }

    if (this.exitMesh) {
      (this.exitMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.5;
    }

    this.renderer.render(this.scene, this.camera);
  };

  dispose(): void {
    this.disposed = true;
    window.removeEventListener('keydown', this.handleKeyDown);
    window.removeEventListener('keyup', this.handleKeyUp);
    document.removeEventListener('pointerlockchange', this.handlePointerLock);
    document.removeEventListener('mousemove', this.handleMouseMove);
    cancelAnimationFrame(this.animId);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
