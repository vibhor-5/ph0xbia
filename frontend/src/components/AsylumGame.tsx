'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  AsylumGame — First-Person 3D Horror Room (Vanilla Three.js)
 *  WASD + mouse look. Uses generated texture assets on all surfaces.
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { useAccount, usePublicClient } from 'wagmi';
import { useEscapeFlow } from '@/hooks/useEscapeRoom';
import { supabase } from '@/lib/supabase/client';
import type { WardConfig, WardObject } from '@/types/game';
import { DEFAULT_SANITY_CONFIG } from '@/types/game';

interface Props { 
  wardConfig: WardConfig;
  sessionId: bigint;
}

export default function AsylumGame({ wardConfig, sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [sanity, setSanity] = useState(100);
  const [clues, setClues] = useState(0);
  const [puzzles, setPuzzles] = useState(0);
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#8b0000');
  const [locked, setLocked] = useState(false);
  const [outcome, setOutcome] = useState<'playing' | 'escape_pending' | 'win' | 'error'>('playing');
  const [nearObj, setNearObj] = useState('');

  const { address } = useAccount();
  const publicClient = usePublicClient();
  const escapeFlow = useEscapeFlow();

  const showMsg = useCallback((t: string, c = '#8b0000') => {
    setMsg(t); setMsgColor(c);
    setTimeout(() => setMsg(''), 3500);
  }, []);

  const onPuzzleSolved = useCallback(async (puzzleIdx: number) => {
    if (!address) return;
    try {
      await supabase.from('task_state').insert({
        session_id: sessionId.toString(),
        player_addr: address.toLowerCase(),
        coven_id: 1, // Single player coven default
        action: 'puzzle_solved',
        object_id: `puzzle_${puzzleIdx}`
      });
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

  const callbacksRef = useRef({ setSanity, setClues, setPuzzles, showMsg, onPuzzleSolved, onExitReached, setLocked, setNearObj });
  useEffect(() => {
    callbacksRef.current = { setSanity, setClues, setPuzzles, showMsg, onPuzzleSolved, onExitReached, setLocked, setNearObj };
  });

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;
    engineRef.current = new GameEngine(
      containerRef.current, wardConfig,
      { 
        setSanity: (fn) => callbacksRef.current.setSanity(fn),
        setClues: (fn) => callbacksRef.current.setClues(fn),
        setPuzzles: (fn) => callbacksRef.current.setPuzzles(fn),
        showMsg: (t, c) => callbacksRef.current.showMsg(t, c),
        onPuzzleSolved: (i) => callbacksRef.current.onPuzzleSolved(i),
        onExitReached: () => callbacksRef.current.onExitReached(),
        setLocked: (l) => callbacksRef.current.setLocked(l),
        setNearObj: (n) => callbacksRef.current.setNearObj(n)
      },
    );
    return () => { engineRef.current?.dispose(); engineRef.current = null; };
  }, []);

  if (outcome === 'win') {
    return (
      <div style={{ width: 800, height: 600, background: '#0a1a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a1a2e', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: '3rem', color: '#2d6a4f', textShadow: '0 0 30px rgba(45,106,79,0.5)' }}>YOU ESCAPED</h1>
        <p style={{ color: '#6a8a6a', fontFamily: 'monospace', marginTop: 10 }}>Session resolved on Monad. Your reward is secure.</p>
        <button onClick={() => window.location.href = '/'} style={{ marginTop: 24, padding: '10px 24px', background: 'none', border: '1px solid #2d6a4f', color: '#2d6a4f', cursor: 'pointer', fontFamily: 'monospace' }}>Return to Lobby</button>
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

      {!locked && (
        <div onClick={() => containerRef.current?.requestPointerLock()}
          style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.75)', zIndex: 20, cursor: 'pointer', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: '#8b0000', fontFamily: 'monospace', fontSize: '1.2rem', animation: 'pulse 2s ease-in-out infinite' }}>CLICK TO ENTER THE ASYLUM</p>
          <p style={{ color: '#555', fontFamily: 'monospace', fontSize: '0.7rem' }}>WASD move · Mouse look · E interact · ESC release</p>
        </div>
      )}

      {/* HUD */}
      <div style={{ position: 'absolute', top: 0, left: 0, padding: 10, zIndex: 10, display: 'flex', gap: 12, fontFamily: 'monospace', fontSize: 12 }}>
        <span style={{ color: sanity > 50 ? '#cc3333' : '#ff4400', background: 'rgba(0,0,0,0.7)', padding: '3px 8px' }}>❤ {Math.floor(sanity)}%</span>
        <span style={{ color: '#bfa14a', background: 'rgba(0,0,0,0.7)', padding: '3px 8px' }}>🔍 {clues}/3</span>
        <span style={{ color: '#2d6a4f', background: 'rgba(0,0,0,0.7)', padding: '3px 8px' }}>🧩 {puzzles}/3</span>
      </div>
      <div style={{ position: 'absolute', top: 8, right: 8, fontFamily: 'monospace', fontSize: 10, color: '#ff6600', background: 'rgba(0,0,0,0.8)', padding: '2px 6px', border: '1px solid #ff6600', zIndex: 10 }}>DEV</div>

      {/* Crosshair */}
      {locked && <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ width: 2, height: 14, background: 'rgba(255,255,255,0.4)', position: 'absolute', top: -7, left: -1 }} />
        <div style={{ width: 14, height: 2, background: 'rgba(255,255,255,0.4)', position: 'absolute', top: -1, left: -7 }} />
      </div>}

      {nearObj && locked && <div style={{ position: 'absolute', top: '62%', left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 11, color: '#bfa14a', background: 'rgba(0,0,0,0.7)', padding: '3px 12px', zIndex: 10, pointerEvents: 'none' }}>[E] {nearObj}</div>}
      {msg && <div style={{ position: 'absolute', bottom: 50, left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 13, color: msgColor, background: 'rgba(0,0,0,0.9)', padding: '8px 20px', zIndex: 15, border: `1px solid ${msgColor}33` }}>{msg}</div>}
      {locked && <div style={{ position: 'absolute', bottom: 6, left: '50%', transform: 'translateX(-50%)', fontFamily: 'monospace', fontSize: 9, color: '#444', zIndex: 10 }}>WASD move · Mouse look · E interact</div>}
      {sanity < 60 && <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 8, boxShadow: `inset 0 0 ${70 - sanity}px rgba(${sanity < 30 ? '150,0,0' : '80,0,0'},${(60 - sanity) / 120})` }} />}

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

const FURNITURE_MODELS: ModelDef[] = [
  { file: 'hospital_bed.glb', pos: [-3.5, 0, -4], rot: [0, 0.1, 0], scale: 0.8 },
  { file: 'desk.glb', pos: [2.5, 0, -2.5], scale: 0.6 },
  { file: 'chair.glb', pos: [1.8, 0, -1.8], rot: [0, 0.4, 0], scale: 0.5 },
  { file: 'chair.glb', pos: [3.2, 0, -3.2], rot: [0, -0.6, 0], scale: 0.5 },
  { file: 'cabinet.glb', pos: [4.2, 0, 0], rot: [0, -0.12, 0], scale: 0.7 },
  { file: 'wheelchair.glb', pos: [-2, 0, 2], rot: [0, 0.7, 0], scale: 0.5 },
  { file: 'shelf.glb', pos: [-4.6, 0, 1], scale: 0.6 },
  { file: 'stool.glb', pos: [-1, 0.2, -1], rot: [0.3, 0, 1.2], scale: 0.4 },
  { file: 'bucket.glb', pos: [3, 0, 3], scale: 0.3 },
  { file: 'light_fixture.glb', pos: [0, 3.3, -1], scale: 0.3 },
  { file: 'door.glb', pos: [0, 0, -5.9], scale: 0.8 },
];

const OBJ_MODELS: Record<string, string> = {
  'bloodstained_cabinet': 'medicine_cabinet.glb',
  'patient_file': 'patient_file.glb',
  'shattered_mirror': 'mirror.glb',
  'rusted_surgical_tray': 'surgical_tray.glb',
  'old_radio': 'radio.glb',
  'medicine_bottle': 'medicine_bottle.glb',
  'rocking_chair': 'rocking_chair.glb',
  'wheelchair': 'wheelchair.glb',
  'broken_bed': 'hospital_bed.glb',
  'padded_wall': 'padded_panel.glb',
  'electroshock_machine': 'electroshock.glb',
  'straitjacket': 'straitjacket.glb',
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
    const woodMat = () => new THREE.MeshStandardMaterial({ map: this.tex('wood', 1, 1), roughness: 0.85 });
    const metalMat = () => new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.6, metalness: 0.4 });
    const fabricMat = () => new THREE.MeshStandardMaterial({ map: this.tex('fabric', 1, 1), roughness: 0.95 });

    // Helper to load a GLB model with shadow + transforms
    const loadGLB = (file: string, pos: [number, number, number], scale: number, rotY = 0) => {
      if (GLOBAL_MODELS[file]) {
        const model = GLOBAL_MODELS[file].clone();
        model.position.set(...pos);
        model.scale.setScalar(scale);
        model.rotation.y = rotY;
        model.traverse((c) => {
          if ((c as THREE.Mesh).isMesh) {
            c.castShadow = true;
            c.receiveShadow = true;
          }
        });
        this.scene.add(model);
      } else {
        console.warn(`Failed to pull /models/${file} from cache.`);
      }
    };

    // ═══ GLB MODELS ═══

    // Hospital Bed (back-left corner)
    loadGLB('hospital_bed.glb', [-3.5, 0, -4], 0.8, 0.1);

    // Chairs (near the desk)
    loadGLB('chair.glb', [1.8, 0, -1.8], 0.6, 0.4);
    loadGLB('chair.glb', [3.2, 0, -3.2], 0.6, -0.6);

    // Cabinet (right wall)
    loadGLB('cabinet.glb', [4.2, 0, 0], 0.7, -0.12);

    // Mirror (mounted on left wall)
    loadGLB('mirror.glb', [-4.8, 1.3, -2], 0.5, Math.PI / 2);

    // Shelf (left wall, further back)
    loadGLB('shelf.glb', [-4.6, 0, 1], 0.4, Math.PI / 2);

    // ═══ BOX GEOMETRY (items without GLB models) ═══

    // ── Desk (center-right) ──
    const desk = new THREE.Group();
    desk.add(this.box(1.3, 0.06, 0.75, 0, 0.72, 0, woodMat()));
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([lx, lz]) =>
      desk.add(this.box(0.06, 0.72, 0.06, lx, 0.36, lz, woodMat())));
    desk.add(this.box(0.5, 0.15, 0.03, -0.3, 0.55, 0.34, woodMat()));
    desk.add(this.box(0.5, 0.15, 0.03, 0.3, 0.55, 0.34, woodMat()));
    desk.position.set(2.5, 0, -2.5);
    this.scene.add(desk);

    // ── Wheelchair ──
    const wc = new THREE.Group();
    wc.add(this.box(0.48, 0.03, 0.42, 0, 0.45, 0, metalMat()));
    wc.add(this.box(0.48, 0.55, 0.03, 0, 0.72, -0.2, metalMat()));
    wc.add(this.box(0.03, 0.2, 0.35, -0.23, 0.55, 0.05, metalMat()));
    wc.add(this.box(0.03, 0.2, 0.35, 0.23, 0.55, 0.05, metalMat()));
    [-0.28, 0.28].forEach((x) => {
      const w = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 14), metalMat());
      w.rotation.z = Math.PI / 2; w.position.set(x, 0.28, 0); wc.add(w);
    });
    wc.position.set(-2, 0, 2); wc.rotation.y = 0.7;
    this.scene.add(wc);

    // ── Overturned Stool ──
    const stool = new THREE.Group();
    stool.add(this.box(0.35, 0.04, 0.35, 0, 0, 0, woodMat()));
    [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([lx, lz]) =>
      stool.add(this.box(0.03, 0.35, 0.03, lx, -0.18, lz, woodMat())));
    stool.position.set(-1, 0.2, -1); stool.rotation.z = 1.2; stool.rotation.x = 0.3;
    this.scene.add(stool);

    // ── Bucket ──
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.2, 8), metalMat());
    bucket.position.set(3, 0.1, 3); this.scene.add(bucket);

    // ═══ DOOR — on the back wall ═══
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

    // ═══ Floor props ═══
    const debrisMat = new THREE.MeshStandardMaterial({ map: this.tex('wood', 0.5, 0.5), roughness: 1 });
    for (let i = 0; i < 15; i++) {
      const d = new THREE.Mesh(new THREE.BoxGeometry(0.04 + Math.random() * 0.18, 0.015, 0.04 + Math.random() * 0.12), debrisMat);
      d.position.set((Math.random() - 0.5) * 8, 0.008, (Math.random() - 0.5) * 10);
      d.rotation.y = Math.random() * Math.PI; this.scene.add(d);
    }
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xccc8b0, roughness: 0.95 });
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15 + Math.random() * 0.1, 0.2 + Math.random() * 0.08), paperMat);
      p.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.15; p.rotation.z = Math.random() * Math.PI;
      p.position.set((Math.random() - 0.5) * 6, 0.01, (Math.random() - 0.5) * 8); this.scene.add(p);
    }
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTIVE OBJECTS — Tries GLB models, falls back to boxes
  // ═══════════════════════════════════════════════════════════════════

  private buildObjects(): void {
    if (!this.wc?.objects) return;
    const RW = 10, RD = 12;
    this.wc.objects.forEach((obj) => {
      const x = (obj.x / 800) * (RW - 3) - (RW / 2 - 1.5);
      const z = (obj.y / 600) * (RD - 3) - (RD / 2 - 1.5);
      const { size, texKey, label } = this.objVis(obj.type);

      const group = new THREE.Group();
      group.position.set(x, 0, z);
      this.scene.add(group);

      // Try loading GLB model from cache for this object type
      const modelFile = OBJ_MODELS[obj.type];
      if (modelFile && GLOBAL_MODELS[modelFile]) {
        const model = GLOBAL_MODELS[modelFile].clone();
        model.scale.setScalar(0.4);
        model.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true; }
        });
        group.add(model);
      } else {
        const mesh = new THREE.Mesh(
          new THREE.BoxGeometry(size[0], size[1], size[2]),
          new THREE.MeshStandardMaterial({ map: this.tex(texKey, 1, 1), roughness: 0.7, metalness: texKey === 'metal' ? 0.3 : 0.05 }),
        );
        mesh.position.y = size[1] / 2;
        mesh.castShadow = true;
        group.add(mesh);
      }

      // Glow ring
      const gc = obj.hasClue ? 0x2d6a4f : 0x663322;
      const glow = new THREE.Mesh(
        new THREE.RingGeometry(0.3, 0.5, 20),
        new THREE.MeshStandardMaterial({ color: gc, emissive: new THREE.Color(gc), emissiveIntensity: 1.5, transparent: true, opacity: 0.35, side: THREE.DoubleSide }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.set(x, 0.02, z);
      this.scene.add(glow);

      this.objMeshes.push({ mesh: group, obj, glow, label });
    });
  }

  private objVis(t: string): { size: [number, number, number]; texKey: string; label: string } {
    const m: Record<string, { size: [number, number, number]; texKey: string; label: string }> = {
      'bloodstained_cabinet': { size: [0.6, 1.1, 0.35], texKey: 'wood', label: 'Bloodstained Cabinet' },
      'patient_file': { size: [0.35, 0.06, 0.25], texKey: 'fabric', label: 'Patient File' },
      'shattered_mirror': { size: [0.4, 0.8, 0.06], texKey: 'metal', label: 'Shattered Mirror' },
      'rusted_surgical_tray': { size: [0.5, 0.1, 0.3], texKey: 'metal', label: 'Surgical Tray' },
      'old_radio': { size: [0.25, 0.2, 0.15], texKey: 'wood', label: 'Old Radio' },
      'medicine_bottle': { size: [0.08, 0.2, 0.08], texKey: 'metal', label: 'Medicine Bottle' },
      'rocking_chair': { size: [0.45, 0.6, 0.45], texKey: 'wood', label: 'Rocking Chair' },
      'wheelchair': { size: [0.55, 0.7, 0.5], texKey: 'metal', label: 'Wheelchair' },
      'broken_bed': { size: [0.8, 0.45, 1.2], texKey: 'metal', label: 'Broken Bed' },
      'padded_wall': { size: [0.7, 1.2, 0.25], texKey: 'fabric', label: 'Padded Panel' },
      'electroshock_machine': { size: [0.45, 0.6, 0.35], texKey: 'metal', label: 'Electroshock Device' },
      'straitjacket': { size: [0.35, 0.06, 0.45], texKey: 'fabric', label: 'Straitjacket' },
    };
    return m[t] || { size: [0.35, 0.35, 0.35], texKey: 'wood', label: 'Object' };
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
    this.keys[e.key.toLowerCase()] = true; 
    if (e.key.toLowerCase() === 'e') this.interact(); 
  };
  private handleKeyUp = (e: KeyboardEvent) => { 
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
    if (this.investigated.has(obj.id)) { this.cb.showMsg('Already investigated.', '#444'); return; }
    this.investigated.add(obj.id);
    glow.visible = false;

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
      return;
    }

    if (obj.hasClue) {
      this.clueCount++;
      this.cb.setClues(() => this.clueCount);
      this.cb.showMsg(`📄 CLUE ${this.clueCount}/3 FOUND`, '#2d6a4f');
      if (this.clueCount >= 3) {
        this.cb.showMsg('All clues! Solving puzzles...', '#bfa14a');
        for (let i = 0; i < 3; i++) {
          setTimeout(() => {
            this.puzzleCount++;
            this.cb.setPuzzles(() => this.puzzleCount);
            this.cb.onPuzzleSolved(this.puzzleCount);
            this.cb.showMsg(`🧩 Puzzle ${this.puzzleCount}/3!`, '#2d6a4f');
            if (this.puzzleCount >= 3) setTimeout(() => this.spawnExit(), 1500);
          }, 2000 + i * 2500);
        }
      }
    } else {
      this.cb.showMsg(obj.flavorText || 'Dust and silence...', '#8b0000');
      this.sanity = Math.max(0, this.sanity + DEFAULT_SANITY_CONFIG.drainRates.red_herring);
      this.cb.setSanity(() => this.sanity);
    }
  }

  private spawnExit(): void {
    this.cb.showMsg('🚪 EXIT APPEARED on the far wall!', '#2d6a4f');
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
