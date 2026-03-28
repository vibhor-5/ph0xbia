/* ──────────────────────────────────────────────────────────────────────
 *  BootScene — Minimal boot to kick off asset preloading
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Load only the bare minimum needed for the loading screen itself
    this.load.image('loading-bg', 'assets/ui/loading-bg.png');
    this.load.image('loading-bar-fill', 'assets/ui/loading-bar-fill.png');
  }

  create(): void {
    // Transition straight to the full preload
    this.scene.start('PreloadScene');
  }
}
