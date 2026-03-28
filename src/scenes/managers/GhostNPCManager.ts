/* ──────────────────────────────────────────────────────────────────────
 *  GhostNPCManager — Wandering ghost patients that drain sanity
 *  Ghosts follow seed-determined patrol paths, phase through walls,
 *  and flicker in/out of visibility.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';
import type { GhostPath, GhostNPC, Position } from '@/types/game';

/** Contact radius in pixels — touching a ghost triggers sanity drain */
const CONTACT_RADIUS = 24;
/** Cooldown between repeated contacts with the same ghost (ms) */
const CONTACT_COOLDOWN_MS = 5000;
/** Movement slow duration on ghost contact (ms) */
const SLOW_DURATION_MS = 2000;
/** Speed multiplier when slowed by ghost */
const SLOW_MULTIPLIER = 0.4;

export class GhostNPCManager {
  private scene: Phaser.Scene;
  private ghosts: GhostNPCState[] = [];
  private onGhostContact: (ghostId: string) => void;
  private lastContactTime: Map<string, number> = new Map();
  private playerSlowedUntil = 0;

  constructor(
    scene: Phaser.Scene,
    ghostPaths: GhostPath[],
    onGhostContact: (ghostId: string) => void,
  ) {
    this.scene = scene;
    this.onGhostContact = onGhostContact;

    // Initialize ghost state from paths
    ghostPaths.forEach((path, i) => {
      const ghost: GhostNPCState = {
        id: path.id || `ghost-${i}`,
        path,
        currentWaypoint: 0,
        position: { ...path.waypoints[0] },
        visible: true,
        opacity: 0.6,
        sprite: this.createGhostSprite(path.waypoints[0]),
        state: 'moving',
        pauseUntil: 0,
        flickerTimer: 0,
      };
      this.ghosts.push(ghost);
    });
  }

  private createGhostSprite(pos: Position): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(pos.x, pos.y, 'ghost-patient');
    sprite.setAlpha(0.6);
    sprite.setTint(0x4a90d9); // ghostly blue tint
    sprite.setDepth(300);

    // Create idle animation if frames exist
    if (sprite.texture.frameTotal > 1) {
      if (!this.scene.anims.exists('ghost-walk')) {
        this.scene.anims.create({
          key: 'ghost-walk',
          frames: this.scene.anims.generateFrameNumbers('ghost-patient', { start: 0, end: 3 }),
          frameRate: 6,
          repeat: -1,
        });
      }
      sprite.play('ghost-walk');
    }

    return sprite;
  }

  /** Call every frame */
  update(deltaMs: number, playerX: number, playerY: number, now: number): GhostUpdateResult {
    const result: GhostUpdateResult = {
      playerSlowed: now < this.playerSlowedUntil,
      speedMultiplier: now < this.playerSlowedUntil ? SLOW_MULTIPLIER : 1,
      contactTriggered: false,
    };

    for (const ghost of this.ghosts) {
      // ── Movement along patrol path ──
      this.updateGhostMovement(ghost, deltaMs);

      // ── Flickering visibility ──
      this.updateGhostFlicker(ghost, deltaMs);

      // ── Update sprite ──
      ghost.sprite.setPosition(ghost.position.x, ghost.position.y);
      ghost.sprite.setAlpha(ghost.visible ? ghost.opacity : 0);

      // ── Check contact with player ──
      const dx = ghost.position.x - playerX;
      const dy = ghost.position.y - playerY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < CONTACT_RADIUS && ghost.visible) {
        const lastContact = this.lastContactTime.get(ghost.id) || 0;
        if (now - lastContact > CONTACT_COOLDOWN_MS) {
          this.lastContactTime.set(ghost.id, now);
          this.playerSlowedUntil = now + SLOW_DURATION_MS;
          result.contactTriggered = true;
          result.playerSlowed = true;
          result.speedMultiplier = SLOW_MULTIPLIER;
          this.onGhostContact(ghost.id);

          // Visual feedback: ghost flashes bright on contact
          this.scene.tweens.add({
            targets: ghost.sprite,
            alpha: 1,
            duration: 150,
            yoyo: true,
            tint: 0xff0000,
          });
        }
      }
    }

    return result;
  }

  private updateGhostMovement(ghost: GhostNPCState, deltaMs: number): void {
    const now = this.scene.time.now;

    // If paused at a waypoint, wait
    if (ghost.state === 'paused' && now < ghost.pauseUntil) return;
    if (ghost.state === 'paused') ghost.state = 'moving';

    const target = ghost.path.waypoints[ghost.currentWaypoint];
    const dx = target.x - ghost.position.x;
    const dy = target.y - ghost.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 2) {
      // Reached waypoint — pause, then move to next
      ghost.position.x = target.x;
      ghost.position.y = target.y;
      ghost.state = 'paused';
      ghost.pauseUntil = now + ghost.path.pauseDurationMs;
      ghost.currentWaypoint = (ghost.currentWaypoint + 1) % ghost.path.waypoints.length;
      return;
    }

    // Move toward waypoint
    const speed = ghost.path.speed * (deltaMs / 1000);
    const nx = dx / dist;
    const ny = dy / dist;
    ghost.position.x += nx * speed;
    ghost.position.y += ny * speed;
  }

  private updateGhostFlicker(ghost: GhostNPCState, deltaMs: number): void {
    ghost.flickerTimer += deltaMs;
    const pattern = ghost.path.flickerPattern;

    if (pattern.length === 0) {
      ghost.visible = true;
      ghost.opacity = 0.6;
      return;
    }

    // Cycle through flicker opacity values
    const cycleLength = pattern.length * 200; // 200ms per step
    const phase = (ghost.flickerTimer % cycleLength) / 200;
    const idx = Math.floor(phase) % pattern.length;
    ghost.opacity = pattern[idx];
    ghost.visible = ghost.opacity > 0.05;
  }

  /** Get all ghost positions (for minimap red dots) */
  getGhostPositions(): Position[] {
    return this.ghosts
      .filter(g => g.visible)
      .map(g => ({ x: g.position.x, y: g.position.y }));
  }

  destroy(): void {
    this.ghosts.forEach(g => g.sprite.destroy());
    this.ghosts = [];
  }
}

// ─── Internal types ────────────────────────────────────────────────

interface GhostNPCState {
  id: string;
  path: GhostPath;
  currentWaypoint: number;
  position: Position;
  visible: boolean;
  opacity: number;
  sprite: Phaser.GameObjects.Sprite;
  state: 'moving' | 'paused';
  pauseUntil: number;
  flickerTimer: number;
}

export interface GhostUpdateResult {
  playerSlowed: boolean;
  speedMultiplier: number;
  contactTriggered: boolean;
}
