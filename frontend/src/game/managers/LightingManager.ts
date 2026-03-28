/* ──────────────────────────────────────────────────────────────────────
 *  LightingManager — Flashlight, flickering, and blackout events
 *  Uses Phaser's WebGL light pipeline for dynamic per-pixel lighting.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import type { FlashlightConfig, BlackoutEvent, FlickerPattern } from '@/types/game';

const DEFAULT_FLASHLIGHT: FlashlightConfig = {
  brightRadius: 128,
  dimRadius: 192,
  color: 0xfff5e0,
  brightIntensity: 1.2,
  dimIntensity: 0.4,
};

export class LightingManager {
  private scene: Phaser.Scene;
  private flashlight!: Phaser.GameObjects.Light;
  private dimLight!: Phaser.GameObjects.Light;
  private config: FlashlightConfig;
  private blackoutEvents: BlackoutEvent[];
  private flickerPattern: FlickerPattern;
  private isBlackedOut = false;
  private blackoutOverlay!: Phaser.GameObjects.Rectangle;
  private flickerTimer = 0;
  private flickerIndex = 0;
  private elapsedSec = 0;
  private activeBlackoutEnd = 0;

  constructor(
    scene: Phaser.Scene,
    blackoutEvents: BlackoutEvent[],
    flickerPattern: FlickerPattern,
    config?: Partial<FlashlightConfig>,
  ) {
    this.scene = scene;
    this.blackoutEvents = blackoutEvents;
    this.flickerPattern = flickerPattern;
    this.config = { ...DEFAULT_FLASHLIGHT, ...config };
  }

  /** Call once in create() after tilemap and player are set up */
  init(playerX: number, playerY: number): void {
    // Enable light pipeline on the scene
    this.scene.lights.enable();
    this.scene.lights.setAmbientColor(0x050508); // near-total darkness

    // Bright inner flashlight
    this.flashlight = this.scene.lights.addLight(
      playerX,
      playerY,
      this.config.brightRadius,
      this.config.color,
      this.config.brightIntensity,
    );

    // Dim outer glow
    this.dimLight = this.scene.lights.addLight(
      playerX,
      playerY,
      this.config.dimRadius,
      this.config.color,
      this.config.dimIntensity,
    );

    // Blackout overlay (full-screen black rectangle, hidden by default)
    const cam = this.scene.cameras.main;
    this.blackoutOverlay = this.scene.add.rectangle(
      cam.width / 2,
      cam.height / 2,
      cam.width * 2,
      cam.height * 2,
      0x000000,
    );
    this.blackoutOverlay.setAlpha(0);
    this.blackoutOverlay.setScrollFactor(0);
    this.blackoutOverlay.setDepth(900);
  }

  /** Call every frame with player position and delta time */
  update(playerX: number, playerY: number, deltaMs: number): void {
    // Follow player
    this.flashlight.setPosition(playerX, playerY);
    this.dimLight.setPosition(playerX, playerY);

    this.elapsedSec += deltaMs / 1000;

    // ── Blackout events ──
    this.updateBlackouts();

    // ── Flickering ──
    if (!this.isBlackedOut) {
      this.updateFlicker(deltaMs);
    }
  }

  private updateBlackouts(): void {
    // Check if we're in a blackout window
    const activeBlackout = this.blackoutEvents.find(
      (ev) => this.elapsedSec >= ev.startTimeSec && this.elapsedSec < ev.startTimeSec + ev.durationSec,
    );

    if (activeBlackout && !this.isBlackedOut) {
      // Enter blackout
      this.isBlackedOut = true;
      this.activeBlackoutEnd = activeBlackout.startTimeSec + activeBlackout.durationSec;
      this.flashlight.setIntensity(0);
      this.dimLight.setIntensity(0.05); // faintest player glow

      this.scene.tweens.add({
        targets: this.blackoutOverlay,
        alpha: 0.95,
        duration: 300,
        ease: 'Power2',
      });
    } else if (!activeBlackout && this.isBlackedOut) {
      // Exit blackout
      this.isBlackedOut = false;
      this.flashlight.setIntensity(this.config.brightIntensity);
      this.dimLight.setIntensity(this.config.dimIntensity);

      this.scene.tweens.add({
        targets: this.blackoutOverlay,
        alpha: 0,
        duration: 500,
        ease: 'Power1',
      });
    }
  }

  private updateFlicker(deltaMs: number): void {
    if (this.flickerPattern.intervals.length === 0) return;

    this.flickerTimer += deltaMs;
    const currentInterval = this.flickerPattern.intervals[this.flickerIndex % this.flickerPattern.intervals.length];

    if (this.flickerTimer >= currentInterval) {
      this.flickerTimer = 0;
      this.flickerIndex++;

      const intensityMult =
        this.flickerPattern.intensities[this.flickerIndex % this.flickerPattern.intensities.length];

      this.flashlight.setIntensity(this.config.brightIntensity * intensityMult);
      this.dimLight.setIntensity(this.config.dimIntensity * intensityMult);
    }
  }

  /** Check if currently blacked out */
  getIsBlackedOut(): boolean {
    return this.isBlackedOut;
  }

  /** Force a temporary flash (e.g., for jump scares) */
  flashBright(durationMs: number = 200): void {
    this.flashlight.setIntensity(3);
    this.dimLight.setIntensity(2);
    this.scene.time.delayedCall(durationMs, () => {
      this.flashlight.setIntensity(this.config.brightIntensity);
      this.dimLight.setIntensity(this.config.dimIntensity);
    });
  }

  destroy(): void {
    this.scene.lights.removeLight(this.flashlight);
    this.scene.lights.removeLight(this.dimLight);
    this.blackoutOverlay.destroy();
  }
}
