'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  AsylumGame — First-Person 3D Horror Room (Vanilla Three.js)
 *  WASD + mouse look. Uses generated texture assets on all surfaces.
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import type { WardConfig, WardObject } from '@/types/game';
import { DEFAULT_SANITY_CONFIG } from '@/types/game';

interface Props { wardConfig: WardConfig }

export default function AsylumGame({ wardConfig }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [sanity, setSanity] = useState(100);
  const [clues, setClues] = useState(0);
  const [puzzles, setPuzzles] = useState(0);
  const [msg, setMsg] = useState('');
  const [msgColor, setMsgColor] = useState('#8b0000');
  const [locked, setLocked] = useState(false);
  const [outcome, setOutcome] = useState<'playing' | 'win'>('playing');
  const [nearObj, setNearObj] = useState('');

  const showMsg = useCallback((t: string, c = '#8b0000') => {
    setMsg(t); setMsgColor(c);
    setTimeout(() => setMsg(''), 3500);
  }, []);

  useEffect(() => {
    if (!containerRef.current || engineRef.current) return;
    engineRef.current = new GameEngine(
      containerRef.current, wardConfig,
      { setSanity, setClues, setPuzzles, showMsg, setOutcome, setLocked, setNearObj },
    );
    return () => { engineRef.current?.dispose(); engineRef.current = null; };
  }, [wardConfig, showMsg]);

  if (outcome === 'win') {
    return (
      <div style={{ width: 800, height: 600, background: '#0a1a0a', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', border: '2px solid #1a1a2e', margin: '0 auto' }}>
        <h1 style={{ fontFamily: 'serif', fontSize: '3rem', color: '#2d6a4f', textShadow: '0 0 30px rgba(45,106,79,0.5)' }}>YOU SURVIVED</h1>
        <p style={{ color: '#6a8a6a', fontFamily: 'monospace', marginTop: 10 }}>The asylum releases its grip...</p>
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
  setOutcome: (o: 'playing' | 'win') => void;
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
  private investigated = new Set<string>();
  private clueCount = 0;
  private puzzleCount = 0;
  private exitMesh: THREE.Mesh | null = null;
  private objMeshes: { mesh: THREE.Group; obj: WardObject; glow: THREE.Mesh; label: string }[] = [];
  private flickerLights: { light: THREE.PointLight; bulbMat: THREE.MeshStandardMaterial; speed: number; base: number }[] = [];
  private dustGeo: THREE.BufferGeometry | null = null;
  private loader = new THREE.TextureLoader();

  // Cached loaded textures
  private textures: Record<string, THREE.Texture> = {};

  constructor(el: HTMLDivElement, wc: WardConfig, cb: CB) {
    this.el = el; this.wc = wc; this.cb = cb;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(800, 600);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
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

    // Load all textures then build
    this.loadTextures(() => {
      this.buildRoom();
      this.buildFurniture();
      this.buildObjects();
      this.buildDust();
      this.setupInput();
      this.animate();
    });
  }

  private loadTextures(cb: () => void): void {
    let loaded = 0;
    const total = Object.keys(TEX).length;
    Object.entries(TEX).forEach(([key, url]) => {
      this.loader.load(url, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        this.textures[key] = tex;
        loaded++;
        if (loaded >= total) cb();
      }, undefined, () => {
        // Fallback: create a simple colored texture if load fails
        const c = document.createElement('canvas'); c.width = 64; c.height = 64;
        const ctx = c.getContext('2d')!;
        ctx.fillStyle = '#3a3a3a'; ctx.fillRect(0, 0, 64, 64);
        this.textures[key] = new THREE.CanvasTexture(c);
        loaded++;
        if (loaded >= total) cb();
      });
    });
  }

  private tex(name: string, repeatX = 1, repeatY = 1): THREE.Texture {
    const t = this.textures[name].clone();
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
    this.scene.add(Object.assign(new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), mat), { position: new THREE.Vector3(x, y + 0.08, z) }));
    const wire = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.35, 4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    wire.position.set(x, y + 0.28, z);
    this.scene.add(wire);
    return mat;
  }

  // ═══════════════════════════════════════════════════════════════════
  // FURNITURE — Textured 3D objects
  // ═══════════════════════════════════════════════════════════════════

  private buildFurniture(): void {
    const woodMat = () => new THREE.MeshStandardMaterial({ map: this.tex('wood', 1, 1), roughness: 0.85 });
    const metalMat = () => new THREE.MeshStandardMaterial({ map: this.tex('metal', 1, 1), roughness: 0.6, metalness: 0.4 });
    const fabricMat = () => new THREE.MeshStandardMaterial({ map: this.tex('fabric', 1, 1), roughness: 0.95 });

    // ── Hospital Bed ──
    const bed = new THREE.Group();
    bed.add(this.box(1.0, 0.05, 2.0, 0, 0.35, 0, metalMat()));     // frame
    [[-0.45, -0.9], [0.45, -0.9], [-0.45, 0.9], [0.45, 0.9]].forEach(([lx, lz]) =>
      bed.add(this.box(0.04, 0.35, 0.04, lx, 0.175, lz, metalMat())), // legs
    );
    bed.add(this.box(1.0, 0.7, 0.04, 0, 0.7, -0.98, metalMat()));   // headboard
    bed.add(this.box(0.9, 0.12, 1.8, 0, 0.44, 0, fabricMat()));      // mattress
    bed.position.set(-3.5, 0, -4); bed.rotation.y = 0.1;
    this.scene.add(bed);

    // ── Desk ──
    const desk = new THREE.Group();
    desk.add(this.box(1.3, 0.06, 0.75, 0, 0.72, 0, woodMat()));
    [[-0.55, -0.3], [0.55, -0.3], [-0.55, 0.3], [0.55, 0.3]].forEach(([lx, lz]) =>
      desk.add(this.box(0.06, 0.72, 0.06, lx, 0.36, lz, woodMat())),
    );
    // Drawer fronts
    desk.add(this.box(0.5, 0.15, 0.03, -0.3, 0.55, 0.34, woodMat()));
    desk.add(this.box(0.5, 0.15, 0.03, 0.3, 0.55, 0.34, woodMat()));
    desk.position.set(2.5, 0, -2.5);
    this.scene.add(desk);

    // ── Chairs ──
    [{ x: 1.8, z: -1.8, ry: 0.4 }, { x: 3.2, z: -3.2, ry: -0.6 }].forEach(({ x, z, ry }) => {
      const ch = new THREE.Group();
      ch.add(this.box(0.42, 0.04, 0.42, 0, 0.42, 0, woodMat()));
      [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]].forEach(([lx, lz]) =>
        ch.add(this.box(0.035, 0.42, 0.035, lx, 0.21, lz, woodMat())),
      );
      ch.add(this.box(0.42, 0.5, 0.04, 0, 0.7, -0.19, woodMat()));
      ch.position.set(x, 0, z); ch.rotation.y = ry;
      this.scene.add(ch);
    });

    // ── Tall Cabinet ──
    const cab = new THREE.Group();
    cab.add(this.box(0.85, 1.9, 0.42, 0, 0.95, 0, woodMat()));
    cab.add(this.box(0.4, 1.6, 0.03, -0.22, 0.9, 0.23, woodMat())); // left door
    cab.add(this.box(0.4, 1.6, 0.03, 0.26, 0.9, 0.26, woodMat())); // right door (ajar)
    // Shelves inside
    [0.5, 1.0, 1.5].forEach((sy) =>
      cab.add(this.box(0.78, 0.02, 0.38, 0, sy, 0, woodMat())),
    );
    cab.position.set(4.2, 0, 0); cab.rotation.y = -0.12;
    this.scene.add(cab);

    // ── Wheelchair ──
    const wc = new THREE.Group();
    wc.add(this.box(0.48, 0.03, 0.42, 0, 0.45, 0, metalMat()));  // seat
    wc.add(this.box(0.48, 0.55, 0.03, 0, 0.72, -0.2, metalMat())); // back
    wc.add(this.box(0.03, 0.2, 0.35, -0.23, 0.55, 0.05, metalMat())); // armrest L
    wc.add(this.box(0.03, 0.2, 0.35, 0.23, 0.55, 0.05, metalMat()));  // armrest R
    [-0.28, 0.28].forEach((x) => {
      const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.03, 14), metalMat());
      wheel.rotation.z = Math.PI / 2;
      wheel.position.set(x, 0.28, 0);
      wc.add(wheel);
    });
    // Front casters
    [-0.15, 0.15].forEach((x) => {
      const caster = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), metalMat());
      caster.position.set(x, 0.05, 0.25);
      wc.add(caster);
    });
    wc.position.set(-2, 0, 2); wc.rotation.y = 0.7;
    this.scene.add(wc);

    // ── Shelf (left wall) ──
    const shelf = new THREE.Group();
    [0.8, 1.3, 1.8].forEach((y) => shelf.add(this.box(1.3, 0.04, 0.28, 0, y, 0, woodMat())));
    [-0.62, 0.62].forEach((x) => shelf.add(this.box(0.04, 1.2, 0.28, x, 1.3, 0, woodMat())));
    shelf.position.set(-4.6, 0, 1);
    this.scene.add(shelf);

    // ── Metal bucket ──
    const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.2, 8), metalMat());
    bucket.position.set(3, 0.1, 3);
    this.scene.add(bucket);

    // ── Overturned stool ──
    const stool = new THREE.Group();
    stool.add(this.box(0.35, 0.04, 0.35, 0, 0, 0, woodMat()));
    [[-0.12, -0.12], [0.12, -0.12], [-0.12, 0.12], [0.12, 0.12]].forEach(([lx, lz]) =>
      stool.add(this.box(0.03, 0.35, 0.03, lx, -0.18, lz, woodMat())),
    );
    stool.position.set(-1, 0.2, -1);
    stool.rotation.z = 1.2; stool.rotation.x = 0.3;
    this.scene.add(stool);

    // ── Floor debris ──
    const debrisMat = new THREE.MeshStandardMaterial({ map: this.tex('wood', 0.5, 0.5), roughness: 1 });
    for (let i = 0; i < 15; i++) {
      const d = new THREE.Mesh(
        new THREE.BoxGeometry(0.04 + Math.random() * 0.18, 0.015, 0.04 + Math.random() * 0.12),
        debrisMat,
      );
      d.position.set((Math.random() - 0.5) * 8, 0.008, (Math.random() - 0.5) * 10);
      d.rotation.y = Math.random() * Math.PI;
      this.scene.add(d);
    }

    // ── Scattered papers ──
    const paperMat = new THREE.MeshStandardMaterial({ color: 0xccc8b0, roughness: 0.95 });
    for (let i = 0; i < 8; i++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.15 + Math.random() * 0.1, 0.2 + Math.random() * 0.08), paperMat);
      p.rotation.x = -Math.PI / 2 + (Math.random() - 0.5) * 0.15;
      p.rotation.z = Math.random() * Math.PI;
      p.position.set((Math.random() - 0.5) * 6, 0.01, (Math.random() - 0.5) * 8);
      this.scene.add(p);
    }
  }

  private box(w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTIVE OBJECTS
  // ═══════════════════════════════════════════════════════════════════

  private buildObjects(): void {
    if (!this.wc?.objects) return;
    const RW = 10, RD = 12;
    this.wc.objects.forEach((obj) => {
      const x = (obj.x / 800) * (RW - 3) - (RW / 2 - 1.5);
      const z = (obj.y / 600) * (RD - 3) - (RD / 2 - 1.5);
      const { size, texKey, label } = this.objVis(obj.type);

      const group = new THREE.Group();
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(size[0], size[1], size[2]),
        new THREE.MeshStandardMaterial({ map: this.tex(texKey, 1, 1), roughness: 0.7, metalness: texKey === 'metal' ? 0.3 : 0.05 }),
      );
      mesh.position.y = size[1] / 2;
      mesh.castShadow = true;
      group.add(mesh);
      group.position.set(x, 0, z);
      this.scene.add(group);

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

  private setupInput(): void {
    window.addEventListener('keydown', (e) => { this.keys[e.key.toLowerCase()] = true; if (e.key.toLowerCase() === 'e') this.interact(); });
    window.addEventListener('keyup', (e) => { this.keys[e.key.toLowerCase()] = false; });
    document.addEventListener('pointerlockchange', () => { this.cb.setLocked(document.pointerLockElement === this.el); });
    document.addEventListener('mousemove', (e) => {
      if (document.pointerLockElement !== this.el) return;
      this.yaw -= e.movementX * 0.002;
      this.pitch = Math.max(-1.2, Math.min(1.2, this.pitch - e.movementY * 0.002));
    });
  }

  private interact(): void {
    let best: { idx: number; dist: number } | null = null;
    this.objMeshes.forEach(({ mesh }, i) => {
      const d = this.camera.position.distanceTo(mesh.position);
      if (d < 2.5 && (!best || d < best.dist)) best = { idx: i, dist: d };
    });
    if (!best) { this.cb.showMsg('Nothing within reach...', '#555'); return; }
    const { obj, glow } = this.objMeshes[best.idx];
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

      // Nearby hint
      let nearLabel = '';
      this.objMeshes.forEach(({ mesh, obj, label }) => {
        if (this.investigated.has(obj.id)) return;
        if (this.camera.position.distanceTo(mesh.position) < 2.5) nearLabel = label;
      });
      this.cb.setNearObj(nearLabel);

      // Sanity regen
      if (!this.keys['w'] && !this.keys['s'] && !this.keys['a'] && !this.keys['d']) {
        this.sanity = Math.min(100, this.sanity + 0.3 * dt);
        this.cb.setSanity(() => this.sanity);
      }
      if (this.exitMesh && this.camera.position.distanceTo(this.exitMesh.position) < 1.5) {
        this.cb.setOutcome('win');
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
    cancelAnimationFrame(this.animId);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
