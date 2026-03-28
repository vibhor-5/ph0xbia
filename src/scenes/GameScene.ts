/* ──────────────────────────────────────────────────────────────────────
 *  GameScene — Main horror escape room scene
 *  Orchestrates all subsystem managers: tilemap, player, lighting,
 *  fog-of-war, ghosts, hotspots, audio, and particles.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import type {
  GameSceneData,
  WardConfig,
  WardObject,
  Position,
  RemotePlayer,
  ScareEvent,
  SanityEventType,
} from '@/types/game';
import { DEFAULT_SANITY_CONFIG } from '@/types/game';
import { LightingManager } from './managers/LightingManager';
import { FogOfWarManager } from './managers/FogOfWarManager';
import { GhostNPCManager } from './managers/GhostNPCManager';
import { AudioManager } from './managers/AudioManager';
import { ParticleManager } from './managers/ParticleManager';

// ─── Constants ──────────────────────────────────────────────────────
const PLAYER_SPEED = 160;
const INTERACT_RADIUS = 32;
const SPAWN_X = 400;
const SPAWN_Y = 300;
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const POSITION_BROADCAST_THRESHOLD = 4; // px — delta compression

export class GameScene extends Phaser.Scene {
  // ── Scene data ──
  private sceneData!: GameSceneData;
  private wardConfig!: WardConfig;

  // ── Player ──
  private player!: Phaser.Physics.Arcade.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasd!: { W: Phaser.Input.Keyboard.Key; A: Phaser.Input.Keyboard.Key; S: Phaser.Input.Keyboard.Key; D: Phaser.Input.Keyboard.Key };
  private interactKey!: Phaser.Input.Keyboard.Key;
  private lastBroadcastPos: Position = { x: 0, y: 0 };
  private walkTarget: Position | null = null;

  // ── Managers ──
  private lightingManager!: LightingManager;
  private fogManager!: FogOfWarManager;
  private ghostManager!: GhostNPCManager;
  private audioManager!: AudioManager;
  private particleManager!: ParticleManager;

  // ── Game objects ──
  private objectSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private remoteSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();

  // ── State ──
  private sanity = 100;
  private cluesCollected: string[] = [];
  private puzzlesSolved = 0;
  private investigatedObjects: Set<string> = new Set();
  private triggeredScares: Set<string> = new Set();
  private speedMultiplier = 1;
  private footstepTimer = 0;

  // ── Callbacks (wired from React via scene data or events) ──
  private onSanityChange?: (sanity: number, event: SanityEventType) => void;
  private onClueCollected?: (clueId: string, total: number) => void;
  private onPuzzleUnlock?: (puzzleIndex: number) => void;
  private onInvestigate?: (object: WardObject) => void;
  private onJumpScare?: (scareEvent: ScareEvent) => void;
  private onEscapeReady?: () => void;
  private onPositionBroadcast?: (x: number, y: number) => void;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data: GameSceneData): void {
    this.sceneData = data;
    this.wardConfig = data.wardConfig;
  }

  create(): void {
    const { width, height } = { width: MAP_WIDTH, height: MAP_HEIGHT };

    // ── Background ──
    this.cameras.main.setBackgroundColor('#0a0a0f');
    this.physics.world.setBounds(0, 0, width, height);
    this.cameras.main.setBounds(0, 0, width, height);

    // ── Tilemap ──
    this.createTilemap();

    // ── Player ──
    this.createPlayer();

    // ── Interactive objects ──
    this.createObjects();

    // ── Managers ──
    this.initManagers();

    // ── Input ──
    this.setupInput();

    // ── Camera fade in ──
    this.cameras.main.fadeIn(1000, 0, 0, 0);

    // ── Wire external callbacks from scene data ──
    this.wireCallbacks();
  }

  update(_time: number, delta: number): void {
    // ── Player movement ──
    this.updatePlayerMovement(delta);

    // ── Manager updates ──
    const playerPos = { x: this.player.x, y: this.player.y };
    this.lightingManager.update(playerPos.x, playerPos.y, delta);
    this.fogManager.update(playerPos.x, playerPos.y);

    const ghostResult = this.ghostManager.update(
      delta, playerPos.x, playerPos.y, this.time.now,
    );

    // Apply ghost slow
    this.speedMultiplier = ghostResult.speedMultiplier;
    if (ghostResult.contactTriggered) {
      this.drainSanity('ghost_contact');
    }

    // Audio update
    const nearestClueDist = this.getNearestClueDistance(playerPos);
    this.audioManager.update(
      playerPos.x, playerPos.y,
      nearestClueDist,
      this.sanity,
    );

    // ── Sanity regen (when standing still) ──
    if (this.player.body?.velocity.x === 0 && this.player.body?.velocity.y === 0) {
      this.regenSanity(delta);
    }

    // ── Position broadcast (delta compressed) ──
    this.broadcastPosition();

    // ── Footstep audio ──
    this.updateFootsteps(delta);
  }

  // ═══════════════════════════════════════════════════════════════════
  // CREATE HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private createTilemap(): void {
    // If tilemap exists, create it; otherwise use a colored rectangle as fallback
    if (this.cache.tilemap.exists('ward-template')) {
      const map = this.make.tilemap({ key: 'ward-template' });
      const tileset = map.addTilesetImage('asylum-tiles');
      if (tileset) {
        const groundLayer = map.createLayer('Ground', tileset, 0, 0);
        const wallLayer = map.createLayer('Walls', tileset, 0, 0);
        groundLayer?.setPipeline('Light2D');
        wallLayer?.setPipeline('Light2D');
        wallLayer?.setCollisionByExclusion([-1]);
        if (wallLayer && this.player) {
          this.physics.add.collider(this.player, wallLayer);
        }
      }
    } else {
      // Fallback: dark floor rectangle
      const floor = this.add.rectangle(MAP_WIDTH / 2, MAP_HEIGHT / 2, MAP_WIDTH, MAP_HEIGHT, 0x1a1a2e);
      floor.setPipeline('Light2D');
    }
  }

  private createPlayer(): void {
    const spawnX = this.sceneData?.wardConfig ? SPAWN_X : 400;
    const spawnY = this.sceneData?.wardConfig ? SPAWN_Y : 300;

    this.player = this.physics.add.sprite(spawnX, spawnY, 'player');
    if (!this.player.texture || this.player.texture.key === '__MISSING') {
      // Fallback: white rectangle if sprite not loaded
      this.player.setVisible(false);
      const placeholder = this.add.rectangle(spawnX, spawnY, 24, 36, 0xf5f0e1);
      placeholder.setDepth(500);
    }
    this.player.setCollideWorldBounds(true);
    this.player.setDepth(500);
    this.player.setPipeline('Light2D');
    this.cameras.main.startFollow(this.player, true, 0.08, 0.08);

    // Player animation
    if (this.player.texture && this.player.texture.frameTotal > 1) {
      this.createPlayerAnimations();
    }
  }

  private createPlayerAnimations(): void {
    const anims = this.anims;
    if (anims.exists('player-walk-down')) return;

    anims.create({
      key: 'player-walk-down',
      frames: anims.generateFrameNumbers('player', { start: 0, end: 3 }),
      frameRate: 8,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-left',
      frames: anims.generateFrameNumbers('player', { start: 4, end: 7 }),
      frameRate: 8,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-right',
      frames: anims.generateFrameNumbers('player', { start: 8, end: 11 }),
      frameRate: 8,
      repeat: -1,
    });
    anims.create({
      key: 'player-walk-up',
      frames: anims.generateFrameNumbers('player', { start: 12, end: 15 }),
      frameRate: 8,
      repeat: -1,
    });
    anims.create({
      key: 'player-idle',
      frames: [{ key: 'player', frame: 0 }],
      frameRate: 1,
    });
  }

  private createObjects(): void {
    if (!this.wardConfig?.objects) return;

    this.wardConfig.objects.forEach((obj) => {
      const textureKey = `obj-${obj.type}`;
      let sprite: Phaser.GameObjects.Sprite;

      if (this.textures.exists(textureKey)) {
        sprite = this.add.sprite(obj.x, obj.y, textureKey);
        sprite.setPipeline('Light2D');
      } else {
        // Fallback: dark gray rectangle
        sprite = this.add.sprite(obj.x, obj.y, '__DEFAULT');
        const rect = this.add.rectangle(obj.x, obj.y, 28, 28, 0x333344);
        rect.setDepth(200);
        rect.setPipeline('Light2D');
      }

      sprite.setDepth(200);
      sprite.setInteractive();
      sprite.setData('objectData', obj);

      // Click to investigate
      sprite.on('pointerdown', () => this.tryInvestigate(obj));

      this.objectSprites.set(obj.id, sprite);
    });
  }

  private initManagers(): void {
    const config = this.wardConfig || {
      blackoutEvents: [],
      flickerSeed: 0,
      ghostPaths: [],
      objects: [],
    };

    // Lighting
    const flickerPattern = {
      type: 'subtle' as const,
      intervals: [800, 200, 1200, 100, 600],
      intensities: [1, 0.7, 1, 0.5, 0.9, 1],
    };
    this.lightingManager = new LightingManager(
      this, config.blackoutEvents || [], flickerPattern,
    );
    this.lightingManager.init(this.player.x, this.player.y);

    // Fog of war
    this.fogManager = new FogOfWarManager(this, MAP_WIDTH, MAP_HEIGHT);
    this.fogManager.init();

    // Ghost NPCs
    this.ghostManager = new GhostNPCManager(
      this,
      config.ghostPaths || [],
      (ghostId) => {
        // Screen shake on ghost contact
        this.cameras.main.shake(300, 0.005);
      },
    );

    // Audio
    this.audioManager = new AudioManager(this);
    this.audioManager.init();

    // Particles
    this.particleManager = new ParticleManager(this);
    this.particleManager.init(config.objects || []);
  }

  private setupInput(): void {
    const kb = this.input.keyboard!;
    this.cursors = kb.createCursorKeys();
    this.wasd = {
      W: kb.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      A: kb.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      S: kb.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      D: kb.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    };
    this.interactKey = kb.addKey(Phaser.Input.Keyboard.KeyCodes.E);

    // E key interaction
    this.interactKey.on('down', () => this.tryInteractNearest());

    // Click-to-walk
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Only if not clicking on a UI element or interactive object
      if (!pointer.downElement || pointer.downElement.tagName === 'CANVAS') {
        const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
        this.walkTarget = { x: worldPoint.x, y: worldPoint.y };
      }
    });
  }

  private wireCallbacks(): void {
    // Events that React components can listen to
    this.events.on('setSanityCallback', (cb: typeof this.onSanityChange) => {
      this.onSanityChange = cb;
    });
    this.events.on('setClueCallback', (cb: typeof this.onClueCollected) => {
      this.onClueCollected = cb;
    });
    this.events.on('setPuzzleUnlockCallback', (cb: typeof this.onPuzzleUnlock) => {
      this.onPuzzleUnlock = cb;
    });
    this.events.on('setInvestigateCallback', (cb: typeof this.onInvestigate) => {
      this.onInvestigate = cb;
    });
    this.events.on('setJumpScareCallback', (cb: typeof this.onJumpScare) => {
      this.onJumpScare = cb;
    });
    this.events.on('setEscapeReadyCallback', (cb: typeof this.onEscapeReady) => {
      this.onEscapeReady = cb;
    });
    this.events.on('setPositionBroadcastCallback', (cb: typeof this.onPositionBroadcast) => {
      this.onPositionBroadcast = cb;
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // UPDATE HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private updatePlayerMovement(delta: number): void {
    const speed = PLAYER_SPEED * this.speedMultiplier;

    // WASD / Arrow key movement
    let vx = 0;
    let vy = 0;

    if (this.wasd.A.isDown || this.cursors.left.isDown) vx = -speed;
    else if (this.wasd.D.isDown || this.cursors.right.isDown) vx = speed;

    if (this.wasd.W.isDown || this.cursors.up.isDown) vy = -speed;
    else if (this.wasd.S.isDown || this.cursors.down.isDown) vy = speed;

    // Keyboard overrides click-to-walk
    if (vx !== 0 || vy !== 0) {
      this.walkTarget = null;
      this.player.setVelocity(vx, vy);

      // Diagonal normalization
      if (vx !== 0 && vy !== 0) {
        this.player.setVelocity(vx * 0.707, vy * 0.707);
      }

      // Animation
      this.playWalkAnimation(vx, vy);
    } else if (this.walkTarget) {
      // Click-to-walk
      const dx = this.walkTarget.x - this.player.x;
      const dy = this.walkTarget.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        this.walkTarget = null;
        this.player.setVelocity(0, 0);
        this.player.play('player-idle', true);
      } else {
        const nx = (dx / dist) * speed;
        const ny = (dy / dist) * speed;
        this.player.setVelocity(nx, ny);
        this.playWalkAnimation(nx, ny);
      }
    } else {
      this.player.setVelocity(0, 0);
      if (this.player.anims?.isPlaying) {
        this.player.play('player-idle', true);
      }
    }
  }

  private playWalkAnimation(vx: number, vy: number): void {
    if (!this.player.anims) return;
    if (Math.abs(vx) > Math.abs(vy)) {
      this.player.play(vx < 0 ? 'player-walk-left' : 'player-walk-right', true);
    } else {
      this.player.play(vy < 0 ? 'player-walk-up' : 'player-walk-down', true);
    }
  }

  private updateFootsteps(delta: number): void {
    if (this.player.body!.velocity.length() > 20) {
      this.footstepTimer += delta;
      if (this.footstepTimer > 350) {
        this.footstepTimer = 0;
        this.audioManager.playFootstep();
      }
    } else {
      this.footstepTimer = 300; // almost ready for next step
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // INTERACTION
  // ═══════════════════════════════════════════════════════════════════

  private tryInteractNearest(): void {
    let nearest: WardObject | null = null;
    let nearestDist = INTERACT_RADIUS;

    this.wardConfig?.objects?.forEach((obj) => {
      const dx = obj.x - this.player.x;
      const dy = obj.y - this.player.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = obj;
      }
    });

    if (nearest) this.tryInvestigate(nearest);
  }

  private tryInvestigate(obj: WardObject): void {
    // Check proximity
    const dx = obj.x - this.player.x;
    const dy = obj.y - this.player.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > INTERACT_RADIUS * 2) return;

    // Already investigated?
    if (this.investigatedObjects.has(obj.id)) return;
    this.investigatedObjects.add(obj.id);

    // Mark sprite as checked
    const sprite = this.objectSprites.get(obj.id);
    if (sprite) {
      sprite.setTint(0x555555);
    }

    // ── Jump scare check ──
    if (obj.isScary && !this.triggeredScares.has(obj.id)) {
      const scareEvent = this.wardConfig.scareEvents?.find(s => s.objectId === obj.id);
      if (scareEvent && !scareEvent.triggered) {
        scareEvent.triggered = true;
        this.triggeredScares.add(obj.id);
        this.triggerJumpScare(scareEvent);
        return; // scare takes priority — object content shown after
      }
    }

    // ── Determine object outcome ──
    if (obj.hasClue) {
      // Real clue!
      this.cluesCollected.push(obj.id);
      this.particleManager.burstAt(obj.x, obj.y, 0x2d6a4f, 10);
      this.onClueCollected?.(obj.id, this.cluesCollected.length);

      // Check if all 3 clues collected → unlock first puzzle
      if (this.cluesCollected.length === 3) {
        this.onPuzzleUnlock?.(0);
      }
    } else if (obj.flavorText) {
      // Red herring → sanity drain
      this.drainSanity('red_herring');
      this.particleManager.burstAt(obj.x, obj.y, 0x8b0000, 6);
    }
    // else: empty — "Dust and silence."

    this.onInvestigate?.(obj);
  }

  private triggerJumpScare(scareEvent: ScareEvent): void {
    this.drainSanity('jump_scare');
    this.cameras.main.shake(400, 0.01);
    this.lightingManager.flashBright(200);
    this.audioManager.playStinger();
    this.onJumpScare?.(scareEvent);
  }

  // ═══════════════════════════════════════════════════════════════════
  // SANITY
  // ═══════════════════════════════════════════════════════════════════

  private drainSanity(event: SanityEventType): void {
    const delta = DEFAULT_SANITY_CONFIG.drainRates[event];
    this.sanity = Math.max(0, Math.min(100, this.sanity + delta));
    this.onSanityChange?.(this.sanity, event);

    if (this.sanity <= 0) {
      this.triggerSanityBlackout();
    }
  }

  private regenSanity(deltaMs: number): void {
    if (this.sanity >= 100) return;
    this.sanity = Math.min(100, this.sanity + DEFAULT_SANITY_CONFIG.regenPerSec * (deltaMs / 1000));
    // Don't fire callback for continuous regen to avoid spam
  }

  private triggerSanityBlackout(): void {
    // 5-second blackout + random teleport
    this.cameras.main.fadeOut(300, 0, 0, 0);
    this.player.setVelocity(0, 0);

    this.time.delayedCall(DEFAULT_SANITY_CONFIG.blackoutDurationMs, () => {
      // Teleport to random explored position
      const newX = Phaser.Math.Between(50, MAP_WIDTH - 50);
      const newY = Phaser.Math.Between(50, MAP_HEIGHT - 50);
      this.player.setPosition(newX, newY);
      this.sanity = DEFAULT_SANITY_CONFIG.blackoutResetTo;
      this.onSanityChange?.(this.sanity, 'blackout_reset');
      this.cameras.main.fadeIn(500, 0, 0, 0);
    });
  }

  /** Called externally when a puzzle is solved (from React modal) */
  public onPuzzleSolved(): void {
    this.puzzlesSolved++;
    this.drainSanity('puzzle_solve'); // positive drain = healing
    this.audioManager.playLockClick();

    // All 3 solved → show exit gate
    if (this.puzzlesSolved >= 3) {
      this.showExitGate();
    }
  }

  private showExitGate(): void {
    const gate = this.add.sprite(MAP_WIDTH - 50, MAP_HEIGHT / 2, 'exit-gate');
    gate.setDepth(400);
    gate.setInteractive();
    gate.setData('testid', 'exit-door');
    gate.setPipeline('Light2D');

    // Pulsing glow
    this.tweens.add({
      targets: gate,
      alpha: { from: 0.7, to: 1 },
      duration: 1000,
      yoyo: true,
      repeat: -1,
    });

    gate.on('pointerdown', () => {
      const dx = gate.x - this.player.x;
      const dy = gate.y - this.player.y;
      if (Math.sqrt(dx * dx + dy * dy) < 48) {
        this.onEscapeReady?.();
      }
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  // MULTIPLAYER
  // ═══════════════════════════════════════════════════════════════════

  private broadcastPosition(): void {
    const dx = this.player.x - this.lastBroadcastPos.x;
    const dy = this.player.y - this.lastBroadcastPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > POSITION_BROADCAST_THRESHOLD) {
      this.lastBroadcastPos = { x: this.player.x, y: this.player.y };
      this.onPositionBroadcast?.(this.player.x, this.player.y);
    }
  }

  /** Called externally to update remote player positions */
  public updateRemotePlayer(wallet: string, x: number, y: number, isRival: boolean): void {
    let sprite = this.remoteSprites.get(wallet);

    if (!sprite) {
      sprite = this.add.sprite(x, y, 'player');
      sprite.setAlpha(0.4);
      sprite.setTint(isRival ? 0xff4444 : 0x4a90d9); // red = rival, blue = coven
      sprite.setDepth(450);
      sprite.setPipeline('Light2D');
      this.remoteSprites.set(wallet, sprite);
    }

    // Smooth interpolation
    this.tweens.add({
      targets: sprite,
      x,
      y,
      duration: 100,
      ease: 'Linear',
    });
  }

  /** Remove a disconnected remote player */
  public removeRemotePlayer(wallet: string): void {
    const sprite = this.remoteSprites.get(wallet);
    if (sprite) {
      sprite.destroy();
      this.remoteSprites.delete(wallet);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════

  private getNearestClueDistance(pos: Position): number {
    if (!this.wardConfig?.objects) return 9999;
    let min = 9999;
    this.wardConfig.objects
      .filter(o => o.hasClue && !this.investigatedObjects.has(o.id))
      .forEach(o => {
        const d = Math.sqrt((o.x - pos.x) ** 2 + (o.y - pos.y) ** 2);
        if (d < min) min = d;
      });
    return min;
  }

  /** Get current sanity for HUD */
  public getSanity(): number {
    return this.sanity;
  }

  /** Get clue count for HUD */
  public getClueCount(): number {
    return this.cluesCollected.length;
  }

  /** Get explored percent for minimap */
  public getExploredPercent(): number {
    return this.fogManager.getExploredPercent();
  }

  /** Transition to result screen */
  public endGame(outcome: 'win' | 'loss' | 'timeout'): void {
    this.cameras.main.fadeOut(1000, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('ResultScene', {
        outcome,
        sessionId: this.sceneData.sessionId,
        isCoOp: this.sceneData.isCoOp,
      });
    });
  }

  shutdown(): void {
    this.lightingManager?.destroy();
    this.fogManager?.destroy();
    this.ghostManager?.destroy();
    this.audioManager?.destroy();
    this.particleManager?.destroy();
    this.remoteSprites.forEach(s => s.destroy());
  }
}
