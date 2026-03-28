/* ──────────────────────────────────────────────────────────────────────
 *  ResultScene — End-of-game outcomes
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

interface ResultData {
  outcome: 'win' | 'loss' | 'timeout';
  isCoOp?: boolean;
}

export class ResultScene extends Phaser.Scene {
  private resultData!: ResultData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultData): void {
    this.resultData = data;
  }

  create(): void {
    const { width: w, height: h } = this.cameras.main;

    if (this.resultData.outcome === 'win') {
      this.cameras.main.setBackgroundColor('#0a1a0a');
      this.cameras.main.fadeIn(1500, 0, 0, 0);

      this.add.rectangle(w / 2, h / 2, w, h, 0x1a2e1a).setAlpha(0.2);

      const title = this.add.text(w / 2, h / 2 - 50, 'YOU SURVIVED', {
        fontFamily: '"Courier New", monospace', fontSize: '42px',
        color: '#2d6a4f', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: title, alpha: 1, duration: 1200, ease: 'Back.easeOut' });

      const sub = this.add.text(w / 2, h / 2 + 10,
        'The asylum releases its grip... for now.', {
          fontFamily: '"Courier New", monospace', fontSize: '14px',
          color: '#8aaa8a', fontStyle: 'italic',
        }).setOrigin(0.5).setAlpha(0);
      this.time.delayedCall(1500, () => {
        this.tweens.add({ targets: sub, alpha: 0.8, duration: 800 });
      });
    } else if (this.resultData.outcome === 'loss') {
      this.cameras.main.setBackgroundColor('#0a0000');
      this.cameras.main.fadeIn(2000, 0, 0, 0);
      this.add.rectangle(w / 2, h / 2, w, h, 0x200000).setAlpha(0.4);

      const title = this.add.text(w / 2, h / 2 - 30, 'THE ASYLUM CLAIMS YOU', {
        fontFamily: '"Courier New", monospace', fontSize: '32px',
        color: '#8b0000', fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);
      this.tweens.add({ targets: title, alpha: 1, duration: 2500 });

      const sub = this.add.text(w / 2, h / 2 + 20, 'Another soul for Ashworth.', {
        fontFamily: '"Courier New", monospace', fontSize: '14px',
        color: '#553333', fontStyle: 'italic',
      }).setOrigin(0.5).setAlpha(0);
      this.time.delayedCall(2000, () => {
        this.tweens.add({ targets: sub, alpha: 0.7, duration: 1000 });
      });
    } else {
      this.cameras.main.setBackgroundColor('#050510');
      this.cameras.main.fadeIn(1500, 0, 0, 0);

      const staticOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x111122);
      this.tweens.add({ targets: staticOverlay, alpha: { from: 0.1, to: 0.3 }, duration: 150, yoyo: true, repeat: -1 });

      this.add.text(w / 2, h / 2 - 30, "TIME'S UP", {
        fontFamily: '"Courier New", monospace', fontSize: '36px',
        color: '#666', fontStyle: 'bold',
      }).setOrigin(0.5);

      this.add.text(w / 2, h / 2 + 15, 'The asylum grows stronger.', {
        fontFamily: '"Courier New", monospace', fontSize: '14px',
        color: '#444', fontStyle: 'italic',
      }).setOrigin(0.5);
    }

    // Return button
    this.time.delayedCall(2500, () => {
      const btn = this.add.text(w / 2, h - 50, '[ play again ]', {
        fontFamily: '"Courier New", monospace', fontSize: '14px',
        color: '#555', backgroundColor: '#111',
        padding: { x: 16, y: 8 },
      }).setOrigin(0.5).setInteractive().setAlpha(0);

      this.tweens.add({ targets: btn, alpha: 1, duration: 600 });
      btn.on('pointerover', () => btn.setColor('#f5f0e1'));
      btn.on('pointerout', () => btn.setColor('#555'));
      btn.on('pointerdown', () => {
        this.cameras.main.fadeOut(500, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
          this.scene.start('BootScene');
        });
      });
    });
  }
}
