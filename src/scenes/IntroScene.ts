/* ──────────────────────────────────────────────────────────────────────
 *  IntroScene — Atmospheric asylum hallway camera pan (5 seconds)
 *  "Ashworth Asylum — Condemned 1987. No survivors."
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

export class IntroScene extends Phaser.Scene {
  private overlayAlpha = 1;

  constructor() {
    super({ key: 'IntroScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#000000');

    // ── Dark hallway backdrop ──
    const hallway = this.add.rectangle(width / 2, height / 2, width, height, 0x0a0a0f);
    hallway.setAlpha(1);

    // ── Flickering ambient light effect ──
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

    // ── Title text — glitchy reveal ──
    const titleText = this.add.text(width / 2, height / 2 - 40, 'ASHWORTH ASYLUM', {
      fontFamily: '"Courier New", monospace',
      fontSize: '36px',
      color: '#8b0000',
      fontStyle: 'bold',
      shadow: {
        offsetX: 2,
        offsetY: 2,
        color: '#000',
        blur: 8,
        fill: true,
      },
    }).setOrigin(0.5).setAlpha(0);

    const subtitleText = this.add.text(width / 2, height / 2 + 10, 'Est. 1952 — Condemned 1987', {
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

    // ── Glitch effect on title ──
    const glitchText = this.add.text(width / 2 + 3, height / 2 - 38, 'ASHWORTH ASYLUM', {
      fontFamily: '"Courier New", monospace',
      fontSize: '36px',
      color: '#4a90d9',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0).setBlendMode(Phaser.BlendModes.ADD);

    // ── Animation timeline ──

    // 0s–1s: Fade in title with glitch
    this.time.delayedCall(500, () => {
      this.tweens.add({
        targets: titleText,
        alpha: 1,
        duration: 800,
        ease: 'Power2',
      });

      // Glitch flicker
      this.tweens.add({
        targets: glitchText,
        alpha: { from: 0, to: 0.3 },
        x: { from: width / 2 + 5, to: width / 2 - 3 },
        duration: 100,
        yoyo: true,
        repeat: 4,
        ease: 'Stepped',
      });
    });

    // 1.5s: Fade in subtitle
    this.time.delayedCall(1500, () => {
      this.tweens.add({
        targets: subtitleText,
        alpha: 0.7,
        duration: 600,
        ease: 'Power1',
      });
    });

    // 2.5s: Fade in tagline
    this.time.delayedCall(2500, () => {
      this.tweens.add({
        targets: tagline,
        alpha: 1,
        duration: 800,
        ease: 'Power2',
      });
    });

    // ── "Press any key to enter" prompt (appears at 3.5s) ──
    const prompt = this.add.text(width / 2, height - 60, '[ press any key to enter ]', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#555',
    }).setOrigin(0.5).setAlpha(0);

    this.time.delayedCall(3500, () => {
      this.tweens.add({
        targets: prompt,
        alpha: { from: 0, to: 0.8 },
        duration: 500,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      // Enable skip/proceed on any key or click
      this.input.keyboard?.once('keydown', () => this.proceedToGame());
      this.input.once('pointerdown', () => this.proceedToGame());
    });

    // Auto-proceed after 8 seconds regardless
    this.time.delayedCall(8000, () => {
      this.proceedToGame();
    });

    // ── Start ambient audio ──
    try {
      if (this.cache.audio.exists('ambient-drone')) {
        this.sound.play('ambient-drone', { loop: true, volume: 0.15 });
      }
    } catch {
      // Audio may not be loaded in test environments
    }
  }

  private proceedToGame(): void {
    // Fade to black then start GameScene
    this.cameras.main.fadeOut(800, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.scene.start('GameScene', this.scene.settings.data);
    });
  }
}
