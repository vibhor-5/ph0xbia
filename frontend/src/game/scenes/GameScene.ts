/* ──────────────────────────────────────────────────────────────────────
 *  GameScene — Main horror escape room
 *  Rich asylum atmosphere: cracked walls, blood stains, flickering
 *  lights, visible objects, fog-of-war, ghost patrols, sanity system.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import type { WardConfig, WardObject, Position, SanityEventType, GhostPath } from '@/types/game';
import { DEFAULT_SANITY_CONFIG } from '@/types/game';

const PLAYER_SPEED = 160;
const INTERACT_RADIUS = 40;
const MAP_W = 1200;
const MAP_H = 900;

interface SceneInput { wardConfig: WardConfig }

interface GhostState {
  sprite: Phaser.GameObjects.Rectangle;
  trail: Phaser.GameObjects.Rectangle[];
  path: GhostPath;
  waypointIdx: number;
  state: 'moving' | 'paused';
  pauseUntil: number;
}

export class GameScene extends Phaser.Scene {
  private wardConfig!: WardConfig;
  private player!: Phaser.GameObjects.Rectangle;
  private playerGlow!: Phaser.GameObjects.Arc;
  private playerBody!: Phaser.Physics.Arcade.Body;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private objectSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private ghostSprites: GhostState[] = [];
  private sanity = 100;
  private cluesCollected: string[] = [];
  private puzzlesSolved = 0;
  private investigatedObjects: Set<string> = new Set();
  private triggeredScares: Set<string> = new Set();
  private walkTarget: Position | null = null;
  private fogRT!: Phaser.GameObjects.RenderTexture;
  private fogBrush!: Phaser.GameObjects.Graphics;
  private vignetteOverlay!: Phaser.GameObjects.Graphics;
  private sanityText!: Phaser.GameObjects.Text;
  private clueText!: Phaser.GameObjects.Text;
  private flickerLights: { x: number; y: number; circle: Phaser.GameObjects.Arc; timer: number; speed: number }[] = [];
  private ambientParticles: Phaser.GameObjects.Rectangle[] = [];
  private elapsedMs = 0;

  constructor() { super({ key: 'GameScene' }); }

  init(data: SceneInput): void { this.wardConfig = data.wardConfig; }

  create(): void {
    this.cameras.main.setBackgroundColor('#050508');
    this.physics.world.setBounds(0, 0, MAP_W, MAP_H);
    this.cameras.main.setBounds(0, 0, MAP_W, MAP_H);

    this.buildAsylumEnvironment();
    this.createObjects();
    this.createPlayer();
    this.createGhosts();
    this.createAmbientEffects();
    this.createFog();
    this.createHUD();
    this.setupInput();
    this.cameras.main.fadeIn(1500, 0, 0, 0);
  }

  update(_time: number, delta: number): void {
    this.elapsedMs += delta;
    this.updatePlayerMovement();
    this.updateGhosts(delta);
    this.updateFlickerLights(delta);
    this.updateAmbientParticles(delta);
    this.updateFog();
    this.updateSanityEffects();
    this.regenSanity(delta);
    this.updateHUD();
  }

  // ═══════════════════════════════════════════════════════════════════
  // ASYLUM ENVIRONMENT
  // ═══════════════════════════════════════════════════════════════════

  private buildAsylumEnvironment(): void {
    const g = this.add.graphics().setDepth(0);

    // ── Dark concrete floor with varied tiles ──
    for (let tx = 0; tx < MAP_W; tx += 32) {
      for (let ty = 0; ty < MAP_H; ty += 32) {
        const shade = 0x1a + Math.floor(Math.random() * 10);
        const color = (shade << 16) | ((shade - 2) << 8) | (shade + 4);
        g.fillStyle(color, 1);
        g.fillRect(tx, ty, 32, 32);
        // Tile gap
        g.lineStyle(1, 0x080808, 0.4);
        g.strokeRect(tx, ty, 32, 32);
      }
    }

    // ── Asylum walls (thick border + internal walls) ──
    const wallG = this.add.graphics().setDepth(5);
    wallG.fillStyle(0x2a2a3a, 1);
    // Outer walls
    wallG.fillRect(0, 0, MAP_W, 16);        // top
    wallG.fillRect(0, MAP_H - 16, MAP_W, 16); // bottom
    wallG.fillRect(0, 0, 16, MAP_H);        // left
    wallG.fillRect(MAP_W - 16, 0, 16, MAP_H); // right

    // Internal corridor walls
    wallG.fillStyle(0x252535, 1);
    wallG.fillRect(300, 0, 12, 300);    // vertical wall 1
    wallG.fillRect(600, 200, 12, 700);  // vertical wall 2
    wallG.fillRect(900, 0, 12, 500);    // vertical wall 3
    wallG.fillRect(300, 300, 300, 12);  // horizontal wall 1
    wallG.fillRect(0, 550, 600, 12);    // horizontal wall 2

    // Wall trim / molding stripes
    wallG.lineStyle(2, 0x222233, 0.6);
    wallG.lineBetween(300, 0, 300, 300);
    wallG.lineBetween(312, 0, 312, 300);
    wallG.lineBetween(600, 200, 600, MAP_H);
    wallG.lineBetween(612, 200, 612, MAP_H);
    wallG.lineBetween(900, 0, 900, 500);
    wallG.lineBetween(912, 0, 912, 500);

    // Door openings (gaps in walls)
    wallG.fillStyle(0x0e0e14, 1);
    wallG.fillRect(300, 130, 12, 50);   // door in wall 1
    wallG.fillRect(600, 400, 12, 50);   // door in wall 2
    wallG.fillRect(900, 220, 12, 50);   // door in wall 3
    wallG.fillRect(400, 550, 60, 12);   // door in horizontal wall

    // ── Blood stains (large smears) ──
    const bloodG = this.add.graphics().setDepth(3);
    const bloodSpots = [
      { x: 180, y: 200, r: 25, a: 0.5 }, { x: 450, y: 500, r: 35, a: 0.45 },
      { x: 750, y: 300, r: 20, a: 0.55 }, { x: 100, y: 700, r: 30, a: 0.4 },
      { x: 1000, y: 150, r: 22, a: 0.5 }, { x: 850, y: 600, r: 28, a: 0.45 },
      { x: 550, y: 120, r: 18, a: 0.6 },
    ];
    bloodSpots.forEach(({ x, y, r, a }) => {
      bloodG.fillStyle(0x5a0000, a);
      bloodG.fillCircle(x, y, r);
      // Drip trail
      bloodG.fillStyle(0x4a0000, a * 0.6);
      bloodG.fillRect(x - 2, y, 4, r * 1.5);
    });

    // ── Scratch marks on walls ──
    const scratchG = this.add.graphics().setDepth(4);
    scratchG.lineStyle(1, 0x555566, 0.6);
    const scratches = [
      [20, 80, 20, 160], [25, 90, 25, 150], [30, 85, 30, 155],
      [MAP_W - 30, 300, MAP_W - 30, 380],
      [620, 250, 620, 330], [625, 260, 625, 320],
    ];
    scratches.forEach(([x1, y1, x2, y2]) => scratchG.lineBetween(x1, y1, x2, y2));

    // ── Cracks in floor ──
    const crackG = this.add.graphics().setDepth(2);
    crackG.lineStyle(1, 0x282830, 0.8);
    crackG.beginPath();
    crackG.moveTo(100, 400); crackG.lineTo(150, 420); crackG.lineTo(200, 415);
    crackG.lineTo(260, 440); crackG.lineTo(280, 430);
    crackG.strokePath();
    crackG.beginPath();
    crackG.moveTo(700, 100); crackG.lineTo(730, 130); crackG.lineTo(710, 170);
    crackG.lineTo(740, 200); crackG.lineTo(760, 195);
    crackG.strokePath();
    crackG.beginPath();
    crackG.moveTo(950, 600); crackG.lineTo(980, 640); crackG.lineTo(1000, 630);
    crackG.lineTo(1050, 660);
    crackG.strokePath();

    // ── Cobweb corners ──
    const webG = this.add.graphics().setDepth(4);
    webG.lineStyle(1, 0x555566, 0.5);
    // Top-left corner
    for (let i = 0; i < 5; i++) {
      webG.lineBetween(16, 16 + i * 12, 16 + i * 12, 16);
    }
    // Top-right
    for (let i = 0; i < 5; i++) {
      webG.lineBetween(MAP_W - 16, 16 + i * 12, MAP_W - 16 - i * 12, 16);
    }
    // At wall intersections
    for (let i = 0; i < 4; i++) {
      webG.lineBetween(300, 300 + i * 8, 300 + i * 8, 300);
    }

    // ── Water puddles ──
    const puddleG = this.add.graphics().setDepth(2);
    puddleG.fillStyle(0x1a2530, 0.5);
    puddleG.fillEllipse(350, 450, 40, 15);
    puddleG.fillEllipse(800, 700, 50, 18);
    puddleG.fillEllipse(150, 600, 35, 12);

    // ── Flickering wall lights ──
    const lightPositions = [
      { x: 150, y: 50 }, { x: 450, y: 50 }, { x: 750, y: 50 },
      { x: 1050, y: 50 }, { x: 150, y: MAP_H - 50 }, { x: 750, y: MAP_H - 50 },
      { x: 50, y: 300 }, { x: 50, y: 600 }, { x: MAP_W - 50, y: 400 },
    ];
    lightPositions.forEach((pos) => {
      // Wall sconce (small rectangle)
      this.add.rectangle(pos.x, pos.y - 6, 8, 4, 0x555566).setDepth(6);
      // Light glow
      const circle = this.add.circle(pos.x, pos.y, 50, 0x4a3520, 0.12);
      circle.setDepth(6);
      this.flickerLights.push({
        x: pos.x, y: pos.y, circle,
        timer: Math.random() * 3000,
        speed: 1500 + Math.random() * 2000,
      });
    });

    // ── Eerie text on walls ──
    const wallTexts = [
      { x: 50, y: 200, text: 'HELP ME', color: '#2a0000', size: '14px', angle: -5 },
      { x: 700, y: 80, text: 'NO EXIT', color: '#1a0000', size: '18px', angle: 2 },
      { x: 1050, y: 380, text: 'IT SEES', color: '#250000', size: '12px', angle: -3 },
      { x: 200, y: 820, text: 'ROOM 237', color: '#222', size: '11px', angle: 0 },
      { x: 630, y: 700, text: 'DONT LOOK BACK', color: '#1a0000', size: '10px', angle: 1 },
    ];
    wallTexts.forEach(({ x, y, text, color, size, angle }) => {
      const t = this.add.text(x, y, text, {
        fontFamily: '"Courier New", monospace',
        fontSize: size, color, fontStyle: 'bold',
      }).setDepth(4).setAlpha(0.5).setAngle(angle);
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // OBJECTS
  // ═══════════════════════════════════════════════════════════════════

  private createObjects(): void {
    if (!this.wardConfig?.objects) return;

    // Scale object positions to the larger map
    this.wardConfig.objects.forEach((obj) => {
      // Scale from 800x600 to 1200x900
      const sx = (obj.x / 800) * (MAP_W - 100) + 50;
      const sy = (obj.y / 600) * (MAP_H - 100) + 50;

      const container = this.add.container(sx, sy).setDepth(100);

      // Object body — larger, distinct shapes per type
      const objVisual = this.createObjectVisual(obj.type);
      container.add(objVisual);

      // Glow ring for interactive hint
      const glowColor = obj.hasClue ? 0x2d6a4f : 0x442222;
      const glow = this.add.circle(0, 0, 22, glowColor, 0.15);
      container.add(glow);
      this.tweens.add({
        targets: glow, alpha: { from: 0.05, to: 0.25 },
        scaleX: { from: 1, to: 1.3 }, scaleY: { from: 1, to: 1.3 },
        duration: 1500, yoyo: true, repeat: -1,
      });

      // Label
      const label = this.add.text(0, 22, this.objectLabel(obj.type), {
        fontFamily: '"Courier New", monospace', fontSize: '8px',
        color: '#444',
      }).setOrigin(0.5);
      container.add(label);

      container.setSize(40, 40);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => this.tryInvestigate(obj, sx, sy));
      container.on('pointerover', () => { label.setColor('#888'); glow.setAlpha(0.35); });
      container.on('pointerout', () => { label.setColor('#444'); });

      this.objectSprites.set(obj.id, container);
    });
  }

  private createObjectVisual(type: string): Phaser.GameObjects.GameObject {
    const shapes: Record<string, () => Phaser.GameObjects.GameObject> = {
      'bloodstained_cabinet': () => {
        const r = this.add.rectangle(0, 0, 24, 28, 0x3a2222);
        this.add.rectangle(0, -4, 20, 2, 0x552222).setDepth(101); // shelf line
        return r;
      },
      'patient_file': () => this.add.rectangle(0, 0, 16, 20, 0x8a7030),
      'shattered_mirror': () => {
        const r = this.add.rectangle(0, 0, 18, 24, 0x556677);
        // Crack lines
        const g = this.add.graphics().setDepth(101);
        g.lineStyle(1, 0x334455, 0.6);
        g.lineBetween(-5, -8, 3, 4); g.lineBetween(3, 4, -2, 10);
        return r;
      },
      'rusted_surgical_tray': () => this.add.rectangle(0, 0, 22, 14, 0x6b5020),
      'old_radio': () => this.add.rectangle(0, 0, 18, 14, 0x333333),
      'medicine_bottle': () => this.add.rectangle(0, 0, 10, 18, 0x2d5a3f),
      'rocking_chair': () => this.add.rectangle(0, 0, 20, 22, 0x4a3520),
      'wheelchair': () => this.add.rectangle(0, 0, 22, 20, 0x444455),
      'broken_bed': () => this.add.rectangle(0, 0, 30, 18, 0x3a3025),
      'padded_wall': () => this.add.rectangle(0, 0, 26, 26, 0x888877),
      'electroshock_machine': () => this.add.rectangle(0, 0, 22, 20, 0x2a4444),
      'straitjacket': () => this.add.rectangle(0, 0, 18, 22, 0x999988),
    };
    const factory = shapes[type] || (() => this.add.rectangle(0, 0, 20, 20, 0x333344));
    return factory();
  }

  private objectLabel(type: string): string {
    const labels: Record<string, string> = {
      'bloodstained_cabinet': 'Cabinet', 'patient_file': 'File', 'shattered_mirror': 'Mirror',
      'rusted_surgical_tray': 'Tray', 'old_radio': 'Radio', 'medicine_bottle': 'Medicine',
      'rocking_chair': 'Chair', 'wheelchair': 'Wheelchair', 'broken_bed': 'Bed',
      'padded_wall': 'Padded Wall', 'electroshock_machine': 'Machine', 'straitjacket': 'Jacket',
    };
    return labels[type] || '???';
  }

  // ═══════════════════════════════════════════════════════════════════
  // PLAYER
  // ═══════════════════════════════════════════════════════════════════

  private createPlayer(): void {
    this.player = this.add.rectangle(200, 200, 16, 24, 0xf5f0e1);
    this.player.setDepth(500);
    this.physics.add.existing(this.player);
    this.playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.playerBody.setCollideWorldBounds(true);

    // Flashlight glow
    this.playerGlow = this.add.circle(200, 200, 140, 0xfff5e0, 0.10);
    this.playerGlow.setDepth(499);
    this.tweens.add({
      targets: this.playerGlow, alpha: { from: 0.06, to: 0.14 },
      duration: 800, yoyo: true, repeat: -1,
    });

    this.cameras.main.startFollow(this.player, true, 0.05, 0.05);
  }

  // ═══════════════════════════════════════════════════════════════════
  // GHOSTS
  // ═══════════════════════════════════════════════════════════════════

  private createGhosts(): void {
    if (!this.wardConfig?.ghostPaths) return;
    this.wardConfig.ghostPaths.forEach((path) => {
      const sx = (path.waypoints[0].x / 800) * MAP_W;
      const sy = (path.waypoints[0].y / 600) * MAP_H;
      const sprite = this.add.rectangle(sx, sy, 14, 22, 0x4a90d9).setAlpha(0.25).setDepth(300);

      // Ghost trail (3 fading rectangles behind)
      const trail: Phaser.GameObjects.Rectangle[] = [];
      for (let i = 0; i < 3; i++) {
        const t = this.add.rectangle(sx, sy, 10, 18, 0x4a90d9).setAlpha(0.08 - i * 0.02).setDepth(299);
        trail.push(t);
      }

      this.ghostSprites.push({
        sprite, trail, path, waypointIdx: 0, state: 'moving', pauseUntil: 0,
      });
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // AMBIENT EFFECTS
  // ═══════════════════════════════════════════════════════════════════

  private createAmbientEffects(): void {
    // Floating dust particles
    for (let i = 0; i < 40; i++) {
      const p = this.add.rectangle(
        Math.random() * MAP_W, Math.random() * MAP_H,
        2, 2, 0xffffff,
      ).setAlpha(Math.random() * 0.08).setDepth(650);
      this.ambientParticles.push(p);
    }
  }

  private updateFlickerLights(delta: number): void {
    this.flickerLights.forEach((light) => {
      light.timer += delta;
      const flicker = Math.sin(light.timer / light.speed * Math.PI * 2);
      const noise = Math.random() > 0.97 ? 0 : 1; // occasional cut-out
      light.circle.setAlpha(0.06 + flicker * 0.04 * noise);
      light.circle.setScale(0.9 + flicker * 0.15);
    });
  }

  private updateAmbientParticles(delta: number): void {
    this.ambientParticles.forEach((p) => {
      p.y -= 0.15;
      p.x += Math.sin(this.elapsedMs / 2000 + p.x) * 0.3;
      if (p.y < -10) { p.y = MAP_H + 10; p.x = Math.random() * MAP_W; }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // FOG / DARKNESS
  // ═══════════════════════════════════════════════════════════════════

  private createFog(): void {
    // RenderTexture approach: fill black, erase a circle around the player
    this.fogRT = this.add.renderTexture(0, 0, MAP_W, MAP_H).setDepth(700);

    // Brush: a soft radial gradient circle for erasing
    this.fogBrush = this.add.graphics();
    this.fogBrush.setVisible(false); // Not rendered directly, used only for erasing
    // Draw concentric circles from outside-in to create gradient
    const brushR = 200;
    for (let r = brushR; r > 0; r -= 4) {
      const alpha = (r / brushR); // outer=1 (fully opaque white=erase), inner=1
      this.fogBrush.fillStyle(0xffffff, alpha);
      this.fogBrush.fillCircle(brushR, brushR, r);
    }

    this.vignetteOverlay = this.add.graphics().setDepth(800).setScrollFactor(0);
  }

  private updateFog(): void {
    // Fill the RT with dark fog
    this.fogRT.fill(0x000000, 0.7);

    // Erase (punch a hole) around the player for the flashlight
    this.fogRT.erase(this.fogBrush, this.player.x - 200, this.player.y - 200);

    // Update player glow position
    this.playerGlow.setPosition(this.player.x, this.player.y);
  }

  private updateSanityEffects(): void {
    this.vignetteOverlay.clear();
    const cam = this.cameras.main;
    const w = cam.width, h = cam.height;

    // Always show a subtle dark vignette
    this.vignetteOverlay.fillStyle(0x000000, 0.15);
    this.vignetteOverlay.fillRect(0, 0, w, 30);
    this.vignetteOverlay.fillRect(0, h - 30, w, 30);
    this.vignetteOverlay.fillRect(0, 0, 30, h);
    this.vignetteOverlay.fillRect(w - 30, 0, 30, h);

    if (this.sanity < 75) {
      const intensity = 1 - this.sanity / 75;
      // Blood-red vignette edges
      this.vignetteOverlay.fillStyle(0x200000, intensity * 0.5);
      this.vignetteOverlay.fillRect(0, 0, w, 40);
      this.vignetteOverlay.fillRect(0, h - 40, w, 40);
      this.vignetteOverlay.fillRect(0, 0, 40, h);
      this.vignetteOverlay.fillRect(w - 40, 0, 40, h);
    }
    if (this.sanity < 50) {
      // Film grain
      this.vignetteOverlay.fillStyle(0xffffff, 0.015);
      for (let i = 0; i < 50; i++) {
        this.vignetteOverlay.fillRect(Math.random() * w, Math.random() * h, 2, 2);
      }
    }
    if (this.sanity < 25) {
      // Chromatic aberration effect (red/cyan bars)
      this.vignetteOverlay.fillStyle(0xff0000, 0.03);
      this.vignetteOverlay.fillRect(0, Math.random() * h, w, 1);
      this.vignetteOverlay.fillStyle(0x00ffff, 0.03);
      this.vignetteOverlay.fillRect(0, Math.random() * h, w, 1);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HUD
  // ═══════════════════════════════════════════════════════════════════

  private createHUD(): void {
    const bg = { backgroundColor: 'rgba(0,0,0,0.6)', padding: { x: 8, y: 4 } };
    const ff = '"Courier New", monospace';

    this.sanityText = this.add.text(12, 12, '❤ SANITY: 100%', {
      fontFamily: ff, fontSize: '13px', color: '#cc3333', ...bg,
    }).setScrollFactor(0).setDepth(900);

    this.clueText = this.add.text(12, 38, '🔍 CLUES: 0/3', {
      fontFamily: ff, fontSize: '13px', color: '#bfa14a', ...bg,
    }).setScrollFactor(0).setDepth(900);

    this.add.text(12, 64, '🧩 PUZZLES: 0/3', {
      fontFamily: ff, fontSize: '13px', color: '#2d6a4f', ...bg,
    }).setScrollFactor(0).setDepth(900).setName('puzzleHud');

    // DEV MODE badge
    this.add.text(this.cameras.main.width - 10, 12, '⚠ DEV', {
      fontFamily: ff, fontSize: '10px', color: '#ff6600',
      backgroundColor: 'rgba(0,0,0,0.8)', padding: { x: 6, y: 3 },
    }).setOrigin(1, 0).setScrollFactor(0).setDepth(999);

    // Controls hint (fades out after 5s)
    const hint = this.add.text(this.cameras.main.width / 2, this.cameras.main.height - 20,
      'WASD move · E or click to investigate · Collect 3 clues → solve puzzles → escape', {
        fontFamily: ff, fontSize: '10px', color: '#444',
      }).setOrigin(0.5).setScrollFactor(0).setDepth(900);
    this.time.delayedCall(6000, () => {
      this.tweens.add({ targets: hint, alpha: 0, duration: 2000 });
    });
  }

  private updateHUD(): void {
    const col = this.sanity > 50 ? '#cc3333' : this.sanity > 25 ? '#ff6600' : '#ff0000';
    this.sanityText.setText(`❤ SANITY: ${Math.floor(this.sanity)}%`).setColor(col);
    this.clueText.setText(`🔍 CLUES: ${this.cluesCollected.length}/3`);
    const ph = this.children.getByName('puzzleHud') as Phaser.GameObjects.Text;
    if (ph) ph.setText(`🧩 PUZZLES: ${this.puzzlesSolved}/3`);
  }

  // ═══════════════════════════════════════════════════════════════════
  // INPUT
  // ═══════════════════════════════════════════════════════════════════

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    kb.addKey(Phaser.Input.Keyboard.KeyCodes.E).on('down', () => this.tryInteractNearest());
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const wp = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      this.walkTarget = { x: wp.x, y: wp.y };
    });
  }

  private updatePlayerMovement(): void {
    const speed = PLAYER_SPEED;
    let vx = 0, vy = 0;
    if (this.wasd.A.isDown) vx = -speed;
    else if (this.wasd.D.isDown) vx = speed;
    if (this.wasd.W.isDown) vy = -speed;
    else if (this.wasd.S.isDown) vy = speed;

    if (vx !== 0 || vy !== 0) {
      this.walkTarget = null;
      if (vx !== 0 && vy !== 0) { vx *= 0.707; vy *= 0.707; }
      this.playerBody.setVelocity(vx, vy);
    } else if (this.walkTarget) {
      const dx = this.walkTarget.x - this.player.x;
      const dy = this.walkTarget.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 4) { this.walkTarget = null; this.playerBody.setVelocity(0, 0); }
      else this.playerBody.setVelocity((dx / dist) * speed, (dy / dist) * speed);
    } else {
      this.playerBody.setVelocity(0, 0);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // GHOSTS UPDATE
  // ═══════════════════════════════════════════════════════════════════

  private updateGhosts(delta: number): void {
    const now = this.time.now;
    for (const ghost of this.ghostSprites) {
      if (ghost.state === 'paused' && now < ghost.pauseUntil) continue;
      if (ghost.state === 'paused') ghost.state = 'moving';

      // Scale waypoints to larger map
      const rawTarget = ghost.path.waypoints[ghost.waypointIdx];
      const tx = (rawTarget.x / 800) * MAP_W;
      const ty = (rawTarget.y / 600) * MAP_H;
      const dx = tx - ghost.sprite.x;
      const dy = ty - ghost.sprite.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 5) {
        ghost.sprite.setPosition(tx, ty);
        ghost.state = 'paused';
        ghost.pauseUntil = now + ghost.path.pauseDurationMs;
        ghost.waypointIdx = (ghost.waypointIdx + 1) % ghost.path.waypoints.length;
      } else {
        const spd = ghost.path.speed * (delta / 1000);
        ghost.sprite.x += (dx / dist) * spd;
        ghost.sprite.y += (dy / dist) * spd;
      }

      // Flicker
      const fi = Math.floor((now / 200) % ghost.path.flickerPattern.length);
      ghost.sprite.setAlpha(ghost.path.flickerPattern[fi] * 0.4);

      // Update trail
      ghost.trail.forEach((t, i) => {
        t.setPosition(
          ghost.sprite.x - (ghost.sprite.x - t.x) * 0.3,
          ghost.sprite.y - (ghost.sprite.y - t.y) * 0.3,
        );
        t.x += (ghost.sprite.x - t.x) * (0.1 - i * 0.02);
        t.y += (ghost.sprite.y - t.y) * (0.1 - i * 0.02);
      });

      // Player contact
      const pdx = ghost.sprite.x - this.player.x;
      const pdy = ghost.sprite.y - this.player.y;
      if (Math.sqrt(pdx * pdx + pdy * pdy) < 28) {
        this.drainSanity('ghost_contact');
        this.cameras.main.shake(200, 0.004);
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTION
  // ═══════════════════════════════════════════════════════════════════

  private tryInteractNearest(): void {
    let nearest: WardObject | null = null;
    let nearestDist = INTERACT_RADIUS * 2;
    this.wardConfig?.objects?.forEach((obj) => {
      const sx = (obj.x / 800) * (MAP_W - 100) + 50;
      const sy = (obj.y / 600) * (MAP_H - 100) + 50;
      const dx = sx - this.player.x;
      const dy = sy - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) { nearestDist = dist; nearest = obj; }
    });
    if (nearest) {
      const n = nearest as WardObject;
      const nsx = (n.x / 800) * (MAP_W - 100) + 50;
      const nsy = (n.y / 600) * (MAP_H - 100) + 50;
      this.tryInvestigate(n, nsx, nsy);
    }
  }

  private tryInvestigate(obj: WardObject, sx: number, sy: number): void {
    const dx = sx - this.player.x;
    const dy = sy - this.player.y;
    if (Math.sqrt(dx * dx + dy * dy) > INTERACT_RADIUS * 2) {
      this.showMessage('Too far away...', '#555');
      return;
    }
    if (this.investigatedObjects.has(obj.id)) {
      this.showMessage('Already investigated.', '#333');
      return;
    }
    this.investigatedObjects.add(obj.id);

    const container = this.objectSprites.get(obj.id);
    if (container) container.setAlpha(0.3);

    if (obj.isScary && !this.triggeredScares.has(obj.id)) {
      this.triggeredScares.add(obj.id);
      this.triggerJumpScare(sx, sy);
    }

    if (obj.hasClue) {
      this.cluesCollected.push(obj.id);
      this.showMessage('📄 CLUE FOUND', '#2d6a4f');
      this.burstParticles(sx, sy, 0x2d6a4f);
      if (this.cluesCollected.length >= 3) {
        this.time.delayedCall(1500, () => {
          this.showMessage('All clues collected! Solving puzzles...', '#bfa14a');
          this.autoPuzzleSolve();
        });
      }
    } else {
      this.showMessage(obj.flavorText || 'Dust and silence.', '#8b0000');
      this.drainSanity('red_herring');
      this.burstParticles(sx, sy, 0x8b0000);
    }
  }

  private autoPuzzleSolve(): void {
    for (let i = 0; i < 3; i++) {
      this.time.delayedCall(2000 + i * 2000, () => {
        this.puzzlesSolved++;
        this.drainSanity('puzzle_solve');
        this.showMessage(`🧩 Puzzle ${this.puzzlesSolved}/3 solved!`, '#2d6a4f');
        if (this.puzzlesSolved >= 3) {
          this.time.delayedCall(1500, () => this.showExitGate());
        }
      });
    }
  }

  private triggerJumpScare(x: number, y: number): void {
    this.drainSanity('jump_scare');
    this.cameras.main.shake(400, 0.012);
    const flash = this.add.rectangle(
      this.cameras.main.scrollX + this.cameras.main.width / 2,
      this.cameras.main.scrollY + this.cameras.main.height / 2,
      this.cameras.main.width, this.cameras.main.height, 0xff0000,
    ).setAlpha(0.5).setDepth(950).setScrollFactor(0);
    this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    this.showMessage('!!!', '#ff0000');
  }

  private showExitGate(): void {
    this.showMessage('🚪 THE EXIT GATE HAS APPEARED!', '#2d6a4f');
    const gx = MAP_W - 80, gy = MAP_H / 2;
    const gate = this.add.rectangle(gx, gy, 28, 44, 0x2d6a4f).setDepth(400).setInteractive({ useHandCursor: true });
    const gateLabel = this.add.text(gx, gy - 30, 'EXIT', {
      fontFamily: '"Courier New", monospace', fontSize: '12px', color: '#2d6a4f',
    }).setOrigin(0.5).setDepth(401);

    this.tweens.add({
      targets: gate, alpha: { from: 0.5, to: 1 },
      scaleX: { from: 1, to: 1.15 }, scaleY: { from: 1, to: 1.15 },
      duration: 900, yoyo: true, repeat: -1,
    });

    gate.on('pointerdown', () => {
      const dist = Math.sqrt((gx - this.player.x) ** 2 + (gy - this.player.y) ** 2);
      if (dist < 60) this.endGame('win');
      else this.showMessage('Get closer to the gate!', '#bfa14a');
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // SANITY
  // ═══════════════════════════════════════════════════════════════════

  private drainSanity(event: SanityEventType): void {
    const d = DEFAULT_SANITY_CONFIG.drainRates[event];
    this.sanity = Math.max(0, Math.min(100, this.sanity + d));
    if (this.sanity <= 0) {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(5000, () => {
        this.player.setPosition(Phaser.Math.Between(60, MAP_W - 60), Phaser.Math.Between(60, MAP_H - 60));
        this.sanity = DEFAULT_SANITY_CONFIG.blackoutResetTo;
        this.cameras.main.fadeIn(500, 0, 0, 0);
        this.showMessage('You blacked out... Where are you?', '#8b0000');
      });
    }
  }

  private regenSanity(deltaMs: number): void {
    if (this.sanity >= 100) return;
    const vel = this.playerBody.velocity;
    if (Math.abs(vel.x) < 5 && Math.abs(vel.y) < 5) {
      this.sanity = Math.min(100, this.sanity + DEFAULT_SANITY_CONFIG.regenPerSec * (deltaMs / 1000));
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private showMessage(text: string, color: string): void {
    const cam = this.cameras.main;
    const msg = this.add.text(cam.width / 2, cam.height - 60, text, {
      fontFamily: '"Courier New", monospace', fontSize: '13px', color,
      backgroundColor: 'rgba(0,0,0,0.75)', padding: { x: 12, y: 6 },
    }).setOrigin(0.5).setDepth(950).setScrollFactor(0);
    this.tweens.add({
      targets: msg, alpha: 0, y: cam.height - 80,
      duration: 3000, onComplete: () => msg.destroy(),
    });
  }

  private burstParticles(x: number, y: number, color: number): void {
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const p = this.add.rectangle(x, y, 3, 3, color).setDepth(600);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * 40, y: y + Math.sin(angle) * 40,
        alpha: 0, duration: 600, onComplete: () => p.destroy(),
      });
    }
  }

  private endGame(outcome: 'win' | 'loss' | 'timeout'): void {
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ResultScene', { outcome, isCoOp: false });
    });
  }
}
