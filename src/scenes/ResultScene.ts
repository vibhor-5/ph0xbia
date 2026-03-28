/* ──────────────────────────────────────────────────────────────────────
 *  ResultScene — End-of-game screen with horror-appropriate outcome
 *  Win:     "YOU SURVIVED" — lights brighten, relief atmosphere
 *  Loss:    "THE ASYLUM CLAIMS YOU" — eerie fade, whispers
 *  Timeout: "TIME'S UP" — distortion, static
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import type { ResultSceneData } from '@/types/game';

export class ResultScene extends Phaser.Scene {
  private data!: ResultSceneData;

  constructor() {
    super({ key: 'ResultScene' });
  }

  init(data: ResultSceneData): void {
    this.data = data;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    switch (this.data.outcome) {
      case 'win':
        this.createWinScreen(width, height);
        break;
      case 'loss':
        this.createLossScreen(width, height);
        break;
      case 'timeout':
        this.createTimeoutScreen(width, height);
        break;
    }

    // ── Return to lobby prompt (appears after 3 seconds) ──
    this.time.delayedCall(3000, () => {
      const returnBtn = this.add.text(width / 2, height - 50,
        this.data.outcome === 'win' ? '[ claim reward ]' : '[ return to lobby ]',
        {
          fontFamily: '"Courier New", monospace',
          fontSize: '16px',
          color: this.data.outcome === 'win' ? '#2d6a4f' : '#555',
          backgroundColor: '#111',
          padding: { x: 20, y: 10 },
        },
      ).setOrigin(0.5).setInteractive().setAlpha(0);

      this.tweens.add({
        targets: returnBtn,
        alpha: 1,
        duration: 800,
      });

      returnBtn.on('pointerover', () => returnBtn.setColor('#f5f0e1'));
      returnBtn.on('pointerout', () =>
        returnBtn.setColor(this.data.outcome === 'win' ? '#2d6a4f' : '#555'));
      returnBtn.on('pointerdown', () => {
        // Emit event for React to handle (navigate to lobby, call claimReward, etc.)
        this.events.emit('returnToLobby', this.data);
      });
    });
  }

  // ───────────────────────────────────────────────────────────────────

  private createWinScreen(w: number, h: number): void {
    this.cameras.main.setBackgroundColor('#0a1a0a');
    this.cameras.main.fadeIn(1500, 0, 0, 0);

    // Brightening overlay
    const light = this.add.rectangle(w / 2, h / 2, w, h, 0x1a2e1a);
    light.setAlpha(0);
    this.tweens.add({
      targets: light,
      alpha: 0.3,
      duration: 2000,
      ease: 'Power1',
    });

    // Title
    const title = this.add.text(w / 2, h / 2 - 60, 'YOU SURVIVED', {
      fontFamily: '"Courier New", monospace',
      fontSize: '42px',
      color: '#2d6a4f',
      fontStyle: 'bold',
      shadow: { offsetX: 0, offsetY: 0, color: '#2d6a4f', blur: 20, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      y: h / 2 - 70,
      duration: 1200,
      ease: 'Back.easeOut',
    });

    // Subtitle based on mode
    const subtitle = this.data.isCoOp
      ? 'THE COVEN BREAKS FREE'
      : 'The asylum releases its grip... for now.';

    this.add.text(w / 2, h / 2, subtitle, {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#8aaa8a',
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0).setName('sub');

    this.time.delayedCall(1500, () => {
      const sub = this.children.getByName('sub') as Phaser.GameObjects.Text;
      if (sub) this.tweens.add({ targets: sub, alpha: 0.8, duration: 800 });
    });

    // Payout info
    if (this.data.netPayout) {
      const payoutText = this.add.text(w / 2, h / 2 + 50,
        `Reward: ${Number(this.data.netPayout) / 1e18} MON`, {
          fontFamily: '"Courier New", monospace',
          fontSize: '18px',
          color: '#bfa14a',
        }).setOrigin(0.5).setAlpha(0);

      this.time.delayedCall(2000, () => {
        this.tweens.add({ targets: payoutText, alpha: 1, duration: 600 });
      });
    }
  }

  private createLossScreen(w: number, h: number): void {
    this.cameras.main.setBackgroundColor('#0a0000');
    this.cameras.main.fadeIn(2000, 0, 0, 0);

    // Blood-red vignette
    const vignette = this.add.rectangle(w / 2, h / 2, w, h, 0x200000);
    vignette.setAlpha(0.4);

    // Title — fades in ominously
    const title = this.add.text(w / 2, h / 2 - 40, 'THE ASYLUM CLAIMS YOU', {
      fontFamily: '"Courier New", monospace',
      fontSize: '32px',
      color: '#8b0000',
      fontStyle: 'bold',
      shadow: { offsetX: 0, offsetY: 0, color: '#8b0000', blur: 15, fill: true },
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({
      targets: title,
      alpha: 1,
      duration: 2500,
      ease: 'Sine.easeIn',
    });

    // Subtitle
    const sub = this.data.isCoOp
      ? 'Your coven was too slow.'
      : 'Another soul for Ashworth.';

    const subText = this.add.text(w / 2, h / 2 + 20, sub, {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#553333',
      fontStyle: 'italic',
    }).setOrigin(0.5).setAlpha(0);

    this.time.delayedCall(2000, () => {
      this.tweens.add({ targets: subText, alpha: 0.7, duration: 1000 });
    });

    // Stake lost message
    const lostText = this.add.text(w / 2, h / 2 + 60, 'Stake forfeited.', {
      fontFamily: '"Courier New", monospace',
      fontSize: '13px',
      color: '#444',
    }).setOrigin(0.5).setAlpha(0);

    this.time.delayedCall(3000, () => {
      this.tweens.add({ targets: lostText, alpha: 0.5, duration: 600 });
    });
  }

  private createTimeoutScreen(w: number, h: number): void {
    this.cameras.main.setBackgroundColor('#050510');
    this.cameras.main.fadeIn(1500, 0, 0, 0);

    // Static flicker effect
    const staticOverlay = this.add.rectangle(w / 2, h / 2, w, h, 0x111122);
    this.tweens.add({
      targets: staticOverlay,
      alpha: { from: 0.1, to: 0.3 },
      duration: 150,
      yoyo: true,
      repeat: -1,
    });

    // Title
    const title = this.add.text(w / 2, h / 2 - 40, "TIME'S UP", {
      fontFamily: '"Courier New", monospace',
      fontSize: '36px',
      color: '#666',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Subtitle
    this.add.text(w / 2, h / 2 + 10, 'The asylum grows stronger.', {
      fontFamily: '"Courier New", monospace',
      fontSize: '14px',
      color: '#444',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Partial refund message
    this.add.text(w / 2, h / 2 + 50, 'Partial refund available (minus 2.5% tithe).', {
      fontFamily: '"Courier New", monospace',
      fontSize: '12px',
      color: '#555',
    }).setOrigin(0.5);

    // Glitch on title
    this.tweens.add({
      targets: title,
      x: { from: w / 2 - 3, to: w / 2 + 3 },
      duration: 80,
      yoyo: true,
      repeat: -1,
      repeatDelay: 2000,
    });
  }
}
