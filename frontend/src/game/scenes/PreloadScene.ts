/* ──────────────────────────────────────────────────────────────────────
 *  PreloadScene — Generate placeholder assets programmatically
 *  No external image files needed — everything is drawn with Graphics.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#0a0a0f');

    // ── Loading text ──
    const loadingText = this.add.text(width / 2, height / 2 - 30, 'ENTERING THE ASYLUM...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#8b0000',
    }).setOrigin(0.5);

    // ── Generate all placeholder textures ──
    this.generatePlaceholderTextures();

    // Brief pause for effect
    this.time.delayedCall(800, () => {
      loadingText.destroy();
      this.scene.start('IntroScene');
    });
  }

  private generatePlaceholderTextures(): void {
    // ── Player sprite (24x36 white figure) ──
    this.generateRect('player', 24, 36, 0xf5f0e1);

    // ── Ghost sprite (24x36 translucent blue) ──
    this.generateRect('ghost-patient', 24, 36, 0x4a90d9);

    // ── Objects — each gets a unique color rectangle ──
    const objectColors: Record<string, number> = {
      'obj-bloodstained_cabinet': 0x663333,
      'obj-patient_file': 0xbfa14a,
      'obj-shattered_mirror': 0x888899,
      'obj-rusted_surgical_tray': 0x8b6914,
      'obj-old_radio': 0x444444,
      'obj-medicine_bottle': 0x2d6a4f,
      'obj-rocking_chair': 0x5c3a1e,
      'obj-wheelchair': 0x555566,
      'obj-broken_bed': 0x443322,
      'obj-padded_wall': 0xaaaaaa,
      'obj-electroshock_machine': 0x336666,
      'obj-straitjacket': 0xccccbb,
    };

    for (const [key, color] of Object.entries(objectColors)) {
      this.generateRect(key, 28, 28, color);
    }

    // ── Exit gate ──
    this.generateRect('exit-gate', 32, 48, 0x2d6a4f);

    // ── UI elements ──
    this.generateRect('hotspot-indicator', 8, 8, 0xffffff);
    this.generateRect('checked-overlay', 28, 28, 0x333333);

    // ── Particle textures (tiny) ──
    this.generateRect('particle-dust', 3, 3, 0xffffff);
    this.generateRect('particle-ember', 3, 3, 0xff6600);
    this.generateRect('particle-fly', 2, 2, 0x111111);
    this.generateRect('particle-drip', 2, 4, 0x3388aa);

    // ── Jump scare placeholders ──
    this.generateRect('scare-face', 200, 200, 0xff0000);
    this.generateRect('scare-hand', 100, 150, 0xddcccc);
    this.generateRect('scare-mirror', 200, 200, 0x4a90d9);
  }

  private generateRect(key: string, w: number, h: number, color: number): void {
    if (this.textures.exists(key)) return;
    const g = this.add.graphics();
    g.fillStyle(color, 1);
    g.fillRect(0, 0, w, h);
    // Add a subtle border
    g.lineStyle(1, 0x222222, 0.5);
    g.strokeRect(0, 0, w, h);
    g.generateTexture(key, w, h);
    g.destroy();
  }
}
