/* ──────────────────────────────────────────────────────────────────────
 *  PH0xBIA — Phaser Game Configuration
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import { BootScene } from './BootScene';
import { PreloadScene } from './PreloadScene';
import { IntroScene } from './IntroScene';
import { GameScene } from './GameScene';
import { ResultScene } from './ResultScene';

export function createGameConfig(
  parent: string | HTMLElement,
  width = 800,
  height = 600,
): Phaser.Types.Core.GameConfig {
  return {
    type: Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: '#0a0a0f',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false,
      },
    },
    scene: [BootScene, PreloadScene, IntroScene, GameScene, ResultScene],
    render: {
      pixelArt: true,
      antialias: false,
    },
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    audio: {
      disableWebAudio: false,
    },
  };
}

export { BootScene, PreloadScene, IntroScene, GameScene, ResultScene };
