/* ──────────────────────────────────────────────────────────────────────
 *  FogOfWarManager — Hide unexplored areas, reveal as player moves
 *  Renders a dark overlay with a "revealed" mask around explored tiles.
 * ────────────────────────────────────────────────────────────────────── */
import Phaser from 'phaser';

/** Size of each fog tile (should match tilemap tile size) */
const FOG_TILE_SIZE = 32;
/** Reveal radius around the player in tiles */
const REVEAL_RADIUS_TILES = 5;

export class FogOfWarManager {
  private scene: Phaser.Scene;
  private fogLayer!: Phaser.GameObjects.RenderTexture;
  private revealed: Set<string> = new Set();
  private mapWidth: number;
  private mapHeight: number;
  private fogColor: number;

  constructor(scene: Phaser.Scene, mapWidthPx: number, mapHeightPx: number) {
    this.scene = scene;
    this.mapWidth = Math.ceil(mapWidthPx / FOG_TILE_SIZE);
    this.mapHeight = Math.ceil(mapHeightPx / FOG_TILE_SIZE);
    this.fogColor = 0x000000;
  }

  /** Call once in create() */
  init(): void {
    const totalW = this.mapWidth * FOG_TILE_SIZE;
    const totalH = this.mapHeight * FOG_TILE_SIZE;

    // Create a RenderTexture that acts as the fog overlay
    this.fogLayer = this.scene.add.renderTexture(0, 0, totalW, totalH);
    this.fogLayer.setDepth(800); // above tilemap, below HUD
    this.fogLayer.setAlpha(0.92);

    // Fill entirely with black fog
    this.fogLayer.fill(this.fogColor);
  }

  /** Call every frame with the player's current position */
  update(playerX: number, playerY: number): void {
    const tileX = Math.floor(playerX / FOG_TILE_SIZE);
    const tileY = Math.floor(playerY / FOG_TILE_SIZE);

    // Reveal tiles in radius around player
    for (let dx = -REVEAL_RADIUS_TILES; dx <= REVEAL_RADIUS_TILES; dx++) {
      for (let dy = -REVEAL_RADIUS_TILES; dy <= REVEAL_RADIUS_TILES; dy++) {
        // Circular reveal (check distance)
        if (dx * dx + dy * dy > REVEAL_RADIUS_TILES * REVEAL_RADIUS_TILES) continue;

        const rx = tileX + dx;
        const ry = tileY + dy;

        if (rx < 0 || rx >= this.mapWidth || ry < 0 || ry >= this.mapHeight) continue;

        const key = `${rx},${ry}`;
        if (!this.revealed.has(key)) {
          this.revealed.add(key);
          this.revealTile(rx, ry);
        }
      }
    }
  }

  private revealTile(tileX: number, tileY: number): void {
    // Erase the fog at this tile position (punch a hole)
    this.fogLayer.erase(
      this.scene.make.graphics({ x: 0, y: 0 })
        .fillStyle(0xffffff, 1)
        .fillRect(0, 0, FOG_TILE_SIZE, FOG_TILE_SIZE),
      tileX * FOG_TILE_SIZE,
      tileY * FOG_TILE_SIZE,
    );
  }

  /** Get the percentage of map explored (for minimap) */
  getExploredPercent(): number {
    const total = this.mapWidth * this.mapHeight;
    return total === 0 ? 0 : (this.revealed.size / total) * 100;
  }

  /** Check if a specific world position has been revealed */
  isRevealed(worldX: number, worldY: number): boolean {
    const tx = Math.floor(worldX / FOG_TILE_SIZE);
    const ty = Math.floor(worldY / FOG_TILE_SIZE);
    return this.revealed.has(`${tx},${ty}`);
  }

  /** Get all revealed tile coordinates (for minimap rendering) */
  getRevealedTiles(): Set<string> {
    return this.revealed;
  }

  destroy(): void {
    this.fogLayer.destroy();
    this.revealed.clear();
  }
}
