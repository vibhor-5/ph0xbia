/* ──────────────────────────────────────────────────────────────────────
 *  AudioManager — Horror atmosphere audio layers and stingers
 *  Manages ambient loops, proximity-based whispers, heartbeat,
 *  jump-scare stingers, and co-op radio static.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

/** Distance at which whispers start playing near clue objects */
const WHISPER_PROXIMITY_PX = 150;
/** Sanity threshold below which heartbeat starts */
const HEARTBEAT_SANITY_THRESHOLD = 50;

export class AudioManager {
  private scene: Phaser.Scene;
  private ambientTracks: Map<string, Phaser.Sound.BaseSound> = new Map();
  private sfx: Map<string, Phaser.Sound.BaseSound> = new Map();
  private whisperSound: Phaser.Sound.BaseSound | null = null;
  private heartbeatSound: Phaser.Sound.BaseSound | null = null;
  private radioStaticSound: Phaser.Sound.BaseSound | null = null;
  private isMuted = false;
  private masterVolume = 0.6;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  /** Initialize and start ambient audio loops */
  init(): void {
    // ── Ambient layers (low volume, looping) ──
    const ambientKeys = [
      { key: 'ambient-drone', volume: 0.15 },
      { key: 'ambient-drip', volume: 0.08 },
      { key: 'ambient-creak', volume: 0.06 },
      { key: 'ambient-moan', volume: 0.04 },
    ];

    ambientKeys.forEach(({ key, volume }) => {
      if (this.scene.cache.audio.exists(key)) {
        const track = this.scene.sound.add(key, {
          loop: true,
          volume: volume * this.masterVolume,
        });
        track.play();
        this.ambientTracks.set(key, track);
      }
    });

    // ── Preload one-shot SFX ──
    const sfxKeys = [
      'sfx-stinger-violin', 'sfx-stinger-slam', 'sfx-stinger-glass',
      'sfx-lock-click', 'sfx-error', 'sfx-footstep',
    ];

    sfxKeys.forEach((key) => {
      if (this.scene.cache.audio.exists(key)) {
        this.sfx.set(key, this.scene.sound.add(key, { volume: 0.5 * this.masterVolume }));
      }
    });

    // ── Proximity-based sounds (initially silent) ──
    if (this.scene.cache.audio.exists('sfx-whisper')) {
      this.whisperSound = this.scene.sound.add('sfx-whisper', {
        loop: true,
        volume: 0,
      });
      this.whisperSound.play();
    }

    if (this.scene.cache.audio.exists('sfx-heartbeat')) {
      this.heartbeatSound = this.scene.sound.add('sfx-heartbeat', {
        loop: true,
        volume: 0,
      });
      this.heartbeatSound.play();
    }

    if (this.scene.cache.audio.exists('sfx-radio-static')) {
      this.radioStaticSound = this.scene.sound.add('sfx-radio-static', {
        loop: true,
        volume: 0,
      });
    }
  }

  /** Call every frame to update proximity-based audio */
  update(
    playerX: number,
    playerY: number,
    nearestClueDistance: number,
    sanity: number,
    nearestTeammateDistance?: number,
  ): void {
    if (this.isMuted) return;

    // ── Whisper volume scales with proximity to nearest clue ──
    if (this.whisperSound) {
      if (nearestClueDistance < WHISPER_PROXIMITY_PX) {
        const t = 1 - nearestClueDistance / WHISPER_PROXIMITY_PX;
        (this.whisperSound as Phaser.Sound.WebAudioSound).setVolume(
          t * 0.3 * this.masterVolume,
        );
      } else {
        (this.whisperSound as Phaser.Sound.WebAudioSound).setVolume(0);
      }
    }

    // ── Heartbeat at low sanity ──
    if (this.heartbeatSound) {
      if (sanity < HEARTBEAT_SANITY_THRESHOLD) {
        const intensity = 1 - sanity / HEARTBEAT_SANITY_THRESHOLD;
        (this.heartbeatSound as Phaser.Sound.WebAudioSound).setVolume(
          intensity * 0.4 * this.masterVolume,
        );
        // Increase rate as sanity drops
        (this.heartbeatSound as Phaser.Sound.WebAudioSound).setRate(
          1 + intensity * 0.5,
        );
      } else {
        (this.heartbeatSound as Phaser.Sound.WebAudioSound).setVolume(0);
      }
    }

    // ── Co-op radio static (clear when close, distorted when far) ──
    if (this.radioStaticSound && nearestTeammateDistance !== undefined) {
      if (nearestTeammateDistance > 200) {
        const staticVol = Math.min((nearestTeammateDistance - 200) / 400, 1);
        if (!this.radioStaticSound.isPlaying) this.radioStaticSound.play();
        (this.radioStaticSound as Phaser.Sound.WebAudioSound).setVolume(
          staticVol * 0.15 * this.masterVolume,
        );
      } else {
        (this.radioStaticSound as Phaser.Sound.WebAudioSound).setVolume(0);
      }
    }
  }

  // ── One-shot SFX methods ──

  /** Play a jump-scare stinger (random type) */
  playStinger(type?: 'violin' | 'slam' | 'glass'): void {
    const stingerMap: Record<string, string> = {
      violin: 'sfx-stinger-violin',
      slam: 'sfx-stinger-slam',
      glass: 'sfx-stinger-glass',
    };

    const key = type
      ? stingerMap[type]
      : Object.values(stingerMap)[Math.floor(Math.random() * 3)];

    const sound = this.sfx.get(key);
    if (sound) {
      (sound as Phaser.Sound.WebAudioSound).setVolume(0.7 * this.masterVolume);
      sound.play();
    }
  }

  /** Play puzzle solve success sound */
  playLockClick(): void {
    this.sfx.get('sfx-lock-click')?.play();
  }

  /** Play puzzle fail error sound */
  playError(): void {
    this.sfx.get('sfx-error')?.play();
  }

  /** Play footstep sound */
  playFootstep(): void {
    const step = this.sfx.get('sfx-footstep');
    if (step && !step.isPlaying) {
      (step as Phaser.Sound.WebAudioSound).setVolume(0.15 * this.masterVolume);
      step.play();
    }
  }

  // ── Controls ──

  toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    this.scene.sound.mute = this.isMuted;
    return this.isMuted;
  }

  setMasterVolume(volume: number): void {
    this.masterVolume = Math.max(0, Math.min(1, volume));
    // Re-apply to all ambient tracks
    this.ambientTracks.forEach((track, key) => {
      const baseVol = key.includes('drone') ? 0.15 : key.includes('drip') ? 0.08 : 0.05;
      (track as Phaser.Sound.WebAudioSound).setVolume(baseVol * this.masterVolume);
    });
  }

  destroy(): void {
    this.ambientTracks.forEach(t => t.destroy());
    this.sfx.forEach(s => s.destroy());
    this.whisperSound?.destroy();
    this.heartbeatSound?.destroy();
    this.radioStaticSound?.destroy();
  }
}
