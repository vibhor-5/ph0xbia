/* ──────────────────────────────────────────────────────────────────────
 *  IntroScene — Atmospheric asylum intro (no external assets needed)
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

export class IntroScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IntroScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#000000');

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0f);

    // Flickering ambient
    const ambientLight = this.add.rectangle(width / 2, height / 2, width, height, 0x1a1a2e);
    ambientLight.setAlpha(0.3);
    this.tweens.add({
      targets: ambientLight,
      alpha: { from: 0.1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: 6,
      ease: 'Sine.easeInOut',
    });

    // Title
    const title = this.add.text(width / 2, height / 2 - 40, 'ASHWORTH ASYLUM', {
      fontFamily: '"Courier New", monospace',
      fontSize: '36px',
      color: '#8b0000',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    // Glitch double
    const glitch = this.add.text(width / 2 + 3, height / 2 - 38, 'ASHWORTH ASYLUM', {
      fontFamily: '"Courier New", monospace',
      fontSize: '36px',
      color: '#4a90d9',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(width / 2, height / 2 + 10, 'Est. 1952 — Condemned 1987', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#555',
    }).setOrigin(0.5).setAlpha(0);

    const tagline = this.add.text(width / 2, height / 2 + 50, 'No survivors.', {
      fontFamily: '"Courier New", monospace',
      fontSize: '18px',
      color: '#f5f0e1',
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0);

    // Animations
    this.time.delayedCall(500, () => {
      this.tweens.add({ targets: title, alpha: 1, duration: 800, ease: 'Power2' });
      this.tweens.add({
        targets: glitch, alpha: { from: 0, to: 0.3 },
        x: { from: width / 2 + 5, to: width / 2 - 3 },
        duration: 100, yoyo: true, repeat: 4,
      });
    });

    this.time.delayedCall(1500, () => {
      this.tweens.add({ targets: subtitle, alpha: 0.7, duration: 600 });
    });

    this.time.delayedCall(2500, () => {
      this.tweens.add({ targets: tagline, alpha: 1, duration: 800 });
    });

    // Prompt
    const prompt = this.add.text(width / 2, height - 60, '[ press any key to enter ]', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#555',
    }).setOrigin(0.5).setAlpha(0);

    this.time.delayedCall(3000, () => {
      this.tweens.add({
        targets: prompt, alpha: { from: 0, to: 0.8 },
        duration: 500, yoyo: true, repeat: -1,
      });
      this.input.keyboard?.once('keydown', () => this.proceed());
      this.input.once('pointerdown', () => this.proceed());
    });

    // Auto-proceed
    this.time.delayedCall(7000, () => this.proceed());
  }

  private proceed(): void {
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', this.scene.settings.data);
    });
  }
}
