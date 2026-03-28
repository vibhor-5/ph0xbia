/* ──────────────────────────────────────────────────────────────────────
 *  ParticleManager — Atmospheric particle effects
 *  Dust motes, floating embers, flies near objects, dripping water.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import type { WardObject, Position } from '@/types/game';

export class ParticleManager {
  private scene: Phaser.Scene;
  private dustEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private emberEmitter: Phaser.GameObjects.Particles.ParticleEmitter | null = null;
  private flyEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];
  private dripEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = [];

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Initialize particle systems */
  init(objects: WardObject[]): void {
    // ── Ambient dust motes (always visible, subtle) ──
    if (this.scene.textures.exists('particle-dust')) {
      this.dustEmitter = this.scene.add.particles(0, 0, 'particle-dust', {
        x: { min: 0, max: this.scene.cameras.main.width },
        y: { min: 0, max: this.scene.cameras.main.height },
        lifespan: 6000,
        speed: { min: 5, max: 15 },
        angle: { min: 240, max: 300 },
        scale: { start: 0.3, end: 0 },
        alpha: { start: 0.3, end: 0 },
        frequency: 300,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      });
      this.dustEmitter.setScrollFactor(0);
      this.dustEmitter.setDepth(700);
    }

    // ── Floating embers (rare, orange) ──
    if (this.scene.textures.exists('particle-ember')) {
      this.emberEmitter = this.scene.add.particles(0, 0, 'particle-ember', {
        x: { min: 0, max: this.scene.cameras.main.width },
        y: this.scene.cameras.main.height + 10,
        lifespan: 4000,
        speed: { min: 20, max: 40 },
        angle: { min: 250, max: 290 },
        scale: { start: 0.4, end: 0 },
        alpha: { start: 0.6, end: 0 },
        tint: 0xff6600,
        frequency: 2000,
        quantity: 1,
        blendMode: Phaser.BlendModes.ADD,
      });
      this.emberEmitter.setScrollFactor(0);
      this.emberEmitter.setDepth(700);
    }

    // ── Flies near specific horror objects ──
    if (this.scene.textures.exists('particle-fly')) {
      const flyTargets = objects.filter(o =>
        ['broken_bed', 'straitjacket', 'rusted_surgical_tray'].includes(o.type)
      );

      flyTargets.forEach(obj => {
        const emitter = this.scene.add.particles(obj.x, obj.y, 'particle-fly', {
          lifespan: 2000,
          speed: { min: 10, max: 30 },
          angle: { min: 0, max: 360 },
          scale: { start: 0.2, end: 0.2 },
          alpha: { start: 0.5, end: 0.3 },
          frequency: 500,
          quantity: 1,
          emitZone: {
            type: 'random',
            source: new Phaser.Geom.Circle(0, 0, 24),
          },
        });
        emitter.setDepth(350);
        this.flyEmitters.push(emitter);
      });
    }

    // ── Dripping water at random positions ──
    if (this.scene.textures.exists('particle-drip')) {
      const dripCount = 3;
      for (let i = 0; i < dripCount; i++) {
        const x = 100 + (i * 250); // spread across room
        const emitter = this.scene.add.particles(x, 0, 'particle-drip', {
          lifespan: 1500,
          speedY: { min: 60, max: 100 },
          speedX: 0,
          scale: { start: 0.15, end: 0.05 },
          alpha: { start: 0.6, end: 0 },
          tint: 0x3388aa,
          frequency: 3000,
          quantity: 1,
          gravityY: 100,
        });
        emitter.setDepth(350);
        this.dripEmitters.push(emitter);
      }
    }
  }

  /** Trigger a burst of particles at a position (e.g., for interaction feedback) */
  burstAt(x: number, y: number, color: number = 0x8b0000, count: number = 8): void {
    if (!this.scene.textures.exists('particle-dust')) return;

    const emitter = this.scene.add.particles(x, y, 'particle-dust', {
      lifespan: 800,
      speed: { min: 30, max: 80 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 0.8, end: 0 },
      tint: color,
      quantity: count,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    emitter.setDepth(750);
    emitter.explode(count);

    // Self-cleanup after particles die
    this.scene.time.delayedCall(1000, () => emitter.destroy());
  }

  /** Blood splatter effect (for scares or interactions) */
  bloodSplatter(x: number, y: number): void {
    this.burstAt(x, y, 0x8b0000, 15);
  }

  destroy(): void {
    this.dustEmitter?.destroy();
    this.emberEmitter?.destroy();
    this.flyEmitters.forEach(e => e.destroy());
    this.dripEmitters.forEach(e => e.destroy());
  }
}
