'use client';
/* ──────────────────────────────────────────────────────────────────────
 *  PhaserGame — React wrapper that mounts the Phaser canvas
 *  Uses a single dynamic import to avoid chunk-loading issues.
 * ────────────────────────────────────────────────────────────────────── */
import { useEffect, useRef, useState } from 'react';
import type { WardConfig } from '@/types/game';

interface Props {
  wardConfig: WardConfig;
}

export default function PhaserGame({ wardConfig }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<unknown>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!containerRef.current || gameRef.current) return;

    let destroyed = false;

    async function initGame() {
      try {
        // Import Phaser first, then scenes — sequential to avoid chunk race
        const Phaser = await import('phaser');
        if (destroyed) return;

        const { BootScene } = await import('@/game/scenes/BootScene');
        const { PreloadScene } = await import('@/game/scenes/PreloadScene');
        const { IntroScene } = await import('@/game/scenes/IntroScene');
        const { GameScene } = await import('@/game/scenes/GameScene');
        const { ResultScene } = await import('@/game/scenes/ResultScene');
        if (destroyed || !containerRef.current) return;

        const config: Phaser.Types.Core.GameConfig = {
          type: Phaser.AUTO,
          parent: containerRef.current,
          width: 800,
          height: 600,
          backgroundColor: '#0a0a0f',
          physics: {
            default: 'arcade',
            arcade: { gravity: { x: 0, y: 0 }, debug: false },
          },
          scene: [BootScene, PreloadScene, IntroScene, GameScene, ResultScene],
          render: { pixelArt: true, antialias: false },
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
          audio: { disableWebAudio: false },
        };

        const game = new Phaser.Game(config);
        gameRef.current = game;

        // Inject wardConfig into GameScene before it runs
        game.events.on('step', () => {
          const gs = game.scene.getScene('GameScene');
          if (gs) {
            const d = gs.scene.settings.data as Record<string, unknown> | undefined;
            if (!d?.wardConfig) {
              (gs.scene.settings as { data: Record<string, unknown> }).data = { wardConfig };
            }
          }
        });
      } catch (err) {
        console.error('Failed to init Phaser:', err);
        setError(String(err));
      }
    }

    initGame();

    return () => {
      destroyed = true;
      if (gameRef.current) {
        (gameRef.current as { destroy: (removeCanvas: boolean) => void }).destroy(true);
        gameRef.current = null;
      }
    };
  }, [wardConfig]);

  if (error) {
    return (
      <div style={{
        width: 800, height: 600, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#0a0a0f', color: '#8b0000', fontFamily: '"Courier New", monospace',
        border: '2px solid #1a1a2e', margin: '0 auto', flexDirection: 'column', gap: 8,
      }}>
        <p>ERROR INITIALIZING GAME</p>
        <p style={{ fontSize: '0.7rem', color: '#555' }}>{error}</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      id="phaser-game"
      style={{
        width: '800px',
        height: '600px',
        margin: '0 auto',
        border: '2px solid #1a1a2e',
        borderRadius: '4px',
        overflow: 'hidden',
      }}
    />
  );
}
