/* ──────────────────────────────────────────────────────────────────────
 *  PreloadScene — Load all game assets with horror-themed progress bar
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;
  private percentText!: Phaser.GameObjects.Text;
  private assetText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // ── Dark background ──
    this.cameras.main.setBackgroundColor('#0a0a0f');

    // ── Loading bar (blood-red fill) ──
    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x1a1a2e, 0.8);
    this.progressBox.fillRect(width / 2 - 160, height / 2 - 15, 320, 30);

    this.progressBar = this.add.graphics();

    // ── Text ──
    this.loadingText = this.add.text(width / 2, height / 2 - 50, 'ENTERING THE ASYLUM...', {
      fontFamily: 'Courier New, monospace',
      fontSize: '18px',
      color: '#8b0000',
    }).setOrigin(0.5);

    this.percentText = this.add.text(width / 2, height / 2, '0%', {
      fontFamily: 'Courier New, monospace',
      fontSize: '14px',
      color: '#f5f0e1',
    }).setOrigin(0.5);

    this.assetText = this.add.text(width / 2, height / 2 + 40, '', {
      fontFamily: 'Courier New, monospace',
      fontSize: '11px',
      color: '#555',
    }).setOrigin(0.5);

    // ── Progress callbacks ──
    this.load.on('progress', (value: number) => {
      this.percentText.setText(`${Math.floor(value * 100)}%`);
      this.progressBar.clear();
      this.progressBar.fillStyle(0x8b0000, 1);
      this.progressBar.fillRect(width / 2 - 155, height / 2 - 10, 310 * value, 20);
    });

    this.load.on('fileprogress', (file: Phaser.Loader.File) => {
      this.assetText.setText(`Loading: ${file.key}`);
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
      this.percentText.destroy();
      this.assetText.destroy();

      // Brief pause for atmosphere, then go to IntroScene
      this.time.delayedCall(500, () => {
        this.scene.start('IntroScene');
      });
    });

    // ── Load all game assets ──
    this.loadAssets();
    this.load.start();
  }

  private loadAssets(): void {
    // ── Tilesets & Maps ──
    this.load.image('asylum-tiles', 'assets/tiles/asylum-tileset.png');
    this.load.tilemapTiledJSON('ward-template', 'assets/tiles/ward-template.json');

    // ── Player sprites ──
    this.load.spritesheet('player', 'assets/sprites/player.png', {
      frameWidth: 32,
      frameHeight: 48,
    });
    this.load.spritesheet('player-flashlight', 'assets/sprites/player-flashlight.png', {
      frameWidth: 32,
      frameHeight: 48,
    });

    // ── Ghost NPC sprites ──
    this.load.spritesheet('ghost-patient', 'assets/sprites/ghost-patient.png', {
      frameWidth: 32,
      frameHeight: 48,
    });

    // ── Interactive objects ──
    const objectTypes = [
      'bloodstained_cabinet', 'patient_file', 'shattered_mirror',
      'rusted_surgical_tray', 'old_radio', 'medicine_bottle',
      'rocking_chair', 'wheelchair', 'broken_bed', 'padded_wall',
      'electroshock_machine', 'straitjacket',
    ];
    objectTypes.forEach((type) => {
      this.load.image(`obj-${type}`, `assets/objects/${type}.png`);
    });

    // ── UI elements ──
    this.load.image('hotspot-indicator', 'assets/ui/hotspot-indicator.png');
    this.load.image('exit-gate', 'assets/objects/exit-gate.png');
    this.load.image('checked-overlay', 'assets/ui/checked-overlay.png');

    // ── Jump scare overlays ──
    this.load.image('scare-face', 'assets/scares/face-flash.png');
    this.load.image('scare-hand', 'assets/scares/hand-reach.png');
    this.load.image('scare-mirror', 'assets/scares/mirror-distortion.png');

    // ── Particles ──
    this.load.image('particle-dust', 'assets/particles/dust.png');
    this.load.image('particle-ember', 'assets/particles/ember.png');
    this.load.image('particle-fly', 'assets/particles/fly.png');
    this.load.image('particle-drip', 'assets/particles/drip.png');

    // ── Audio ──
    this.load.audio('ambient-drone', 'assets/audio/ambient-drone.ogg');
    this.load.audio('ambient-drip', 'assets/audio/ambient-drip.ogg');
    this.load.audio('ambient-creak', 'assets/audio/ambient-creak.ogg');
    this.load.audio('ambient-moan', 'assets/audio/ambient-moan.ogg');
    this.load.audio('sfx-whisper', 'assets/audio/sfx-whisper.ogg');
    this.load.audio('sfx-heartbeat', 'assets/audio/sfx-heartbeat.ogg');
    this.load.audio('sfx-stinger-violin', 'assets/audio/sfx-stinger-violin.ogg');
    this.load.audio('sfx-stinger-slam', 'assets/audio/sfx-stinger-slam.ogg');
    this.load.audio('sfx-stinger-glass', 'assets/audio/sfx-stinger-glass.ogg');
    this.load.audio('sfx-lock-click', 'assets/audio/sfx-lock-click.ogg');
    this.load.audio('sfx-error', 'assets/audio/sfx-error.ogg');
    this.load.audio('sfx-radio-static', 'assets/audio/sfx-radio-static.ogg');
    this.load.audio('sfx-footstep', 'assets/audio/sfx-footstep.ogg');
  }
}
