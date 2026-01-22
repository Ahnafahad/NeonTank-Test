// Map Generator for Neon Tank Duel
import { Wall } from '../entities/Wall';
import { Hazard, HazardType } from '../entities/Hazard';
import { Vector } from '../utils/Vector';
import { Constants } from '../utils/Constants';
import {
  MapVariant,
  MapPresets,
  MapPresetConfig,
  WallConfig,
  HazardConfig,
  RANDOM_MAP_PARAMS,
} from './MapPresets';

export interface MapData {
  walls: Wall[];
  crates: Wall[];
  hazards: Hazard[];
  spawnPoints: { p1: Vector; p2: Vector };
}

export class MapGenerator {
  private seed: number;

  constructor(seed?: number) {
    this.seed = seed ?? Date.now();
  }

  /**
   * Simple seeded random number generator (LCG)
   */
  private seededRandom(): number {
    this.seed = (this.seed * 1664525 + 1013904223) % 4294967296;
    return this.seed / 4294967296;
  }

  /**
   * Generate a random integer between min and max (inclusive)
   */
  private randomInt(min: number, max: number): number {
    return Math.floor(this.seededRandom() * (max - min + 1)) + min;
  }

  /**
   * Generate map data for a given variant
   */
  public generateMap(variant: MapVariant): MapData {
    if (variant === 'random') {
      return this.generateRandomMap();
    }

    const preset = MapPresets[variant];
    return this.createMapFromPreset(preset);
  }

  /**
   * Create MapData from a preset configuration
   */
  private createMapFromPreset(preset: MapPresetConfig): MapData {
    const walls: Wall[] = preset.walls.map(
      (w) => new Wall(w.x, w.y, w.w, w.h, w.destructible ?? false)
    );

    const crates: Wall[] = preset.crates.map(
      (c) => new Wall(c.x, c.y, c.w, c.h, c.destructible ?? true)
    );

    const hazards: Hazard[] = preset.hazards.map(
      (h) => new Hazard(h.x, h.y, h.w, h.h, h.type)
    );

    const spawnPoints = {
      p1: new Vector(preset.spawnPoints.p1.x, preset.spawnPoints.p1.y),
      p2: new Vector(preset.spawnPoints.p2.x, preset.spawnPoints.p2.y),
    };

    return { walls, crates, hazards, spawnPoints };
  }

  /**
   * Generate a procedurally random map
   */
  private generateRandomMap(): MapData {
    const params = RANDOM_MAP_PARAMS;
    const walls: Wall[] = [];
    const crates: Wall[] = [];
    const hazards: Hazard[] = [];

    // Define spawn points first (traditional left/right positions)
    const spawnPoints = {
      p1: new Vector(100, 350),
      p2: new Vector(900, 350),
    };

    // Define spawn safe zones (areas where we won't place obstacles)
    const spawnSafeRadius = 120;
    const spawnZones = [
      { x: spawnPoints.p1.x, y: spawnPoints.p1.y, radius: spawnSafeRadius },
      { x: spawnPoints.p2.x, y: spawnPoints.p2.y, radius: spawnSafeRadius },
    ];

    // Generate walls
    const numWalls = this.randomInt(params.minWalls, params.maxWalls);
    let attempts = 0;
    const maxAttempts = 100;

    while (walls.length < numWalls && attempts < maxAttempts) {
      attempts++;

      const w = this.randomInt(params.wallMinSize, params.wallMaxSize);
      const h = this.randomInt(params.wallMinSize, params.wallMaxSize);
      const x = this.randomInt(50, Constants.GAME_WIDTH - w - 50);
      const y = this.randomInt(50, Constants.GAME_HEIGHT - h - 50);

      // Check if wall is in spawn safe zone
      if (this.isInSpawnZone(x, y, w, h, spawnZones)) {
        continue;
      }

      // Check overlap with existing walls
      if (this.overlapsExisting(x, y, w, h, walls)) {
        continue;
      }

      walls.push(new Wall(x, y, w, h, false));
    }

    // Generate crates
    const numCrates = this.randomInt(params.minCrates, params.maxCrates);
    attempts = 0;

    while (crates.length < numCrates && attempts < maxAttempts) {
      attempts++;

      const size = params.crateSize;
      const x = this.randomInt(100, Constants.GAME_WIDTH - size - 100);
      const y = this.randomInt(100, Constants.GAME_HEIGHT - size - 100);

      // Check if crate is in spawn safe zone
      if (this.isInSpawnZone(x, y, size, size, spawnZones)) {
        continue;
      }

      // Check overlap with walls
      if (this.overlapsExisting(x, y, size, size, walls)) {
        continue;
      }

      // Check overlap with existing crates
      if (this.overlapsExisting(x, y, size, size, crates)) {
        continue;
      }

      crates.push(new Wall(x, y, size, size, true));
    }

    // Generate hazards
    const numHazards = this.randomInt(params.minHazards, params.maxHazards);
    attempts = 0;

    while (hazards.length < numHazards && attempts < maxAttempts) {
      attempts++;

      const w = this.randomInt(params.hazardMinSize, params.hazardMaxSize);
      const h = this.randomInt(params.hazardMinSize, params.hazardMaxSize);
      const x = this.randomInt(150, Constants.GAME_WIDTH - w - 150);
      const y = this.randomInt(100, Constants.GAME_HEIGHT - h - 100);

      // Check if hazard is in spawn safe zone
      if (this.isInSpawnZone(x, y, w, h, spawnZones)) {
        continue;
      }

      // Check overlap with existing hazards
      if (this.overlapsHazards(x, y, w, h, hazards)) {
        continue;
      }

      hazards.push(new Hazard(x, y, w, h, 'RADIATION'));
    }

    // Verify path exists between spawn points
    if (!this.verifyPathExists(spawnPoints.p1, spawnPoints.p2, walls)) {
      // If no path exists, remove a random wall and try again
      if (walls.length > 0) {
        const removeIndex = this.randomInt(0, walls.length - 1);
        walls.splice(removeIndex, 1);
      }
    }

    return { walls, crates, hazards, spawnPoints };
  }

  /**
   * Check if a rectangle is within any spawn safe zone
   */
  private isInSpawnZone(
    x: number,
    y: number,
    w: number,
    h: number,
    zones: { x: number; y: number; radius: number }[]
  ): boolean {
    const centerX = x + w / 2;
    const centerY = y + h / 2;

    for (const zone of zones) {
      const dx = centerX - zone.x;
      const dy = centerY - zone.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const objectRadius = Math.max(w, h) / 2;

      if (distance < zone.radius + objectRadius) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a rectangle overlaps with existing walls
   */
  private overlapsExisting(
    x: number,
    y: number,
    w: number,
    h: number,
    existing: Wall[]
  ): boolean {
    const padding = 20; // Minimum gap between obstacles

    for (const wall of existing) {
      if (
        x < wall.x + wall.w + padding &&
        x + w + padding > wall.x &&
        y < wall.y + wall.h + padding &&
        y + h + padding > wall.y
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a rectangle overlaps with existing hazards
   */
  private overlapsHazards(
    x: number,
    y: number,
    w: number,
    h: number,
    existing: Hazard[]
  ): boolean {
    const padding = 30; // Minimum gap between hazards

    for (const hazard of existing) {
      if (
        x < hazard.x + hazard.w + padding &&
        x + w + padding > hazard.x &&
        y < hazard.y + hazard.h + padding &&
        y + h + padding > hazard.y
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Simple pathfinding verification using flood fill
   * Ensures tanks can reach each other
   */
  private verifyPathExists(start: Vector, end: Vector, walls: Wall[]): boolean {
    const gridSize = 50; // Grid cell size for pathfinding
    const gridWidth = Math.ceil(Constants.GAME_WIDTH / gridSize);
    const gridHeight = Math.ceil(Constants.GAME_HEIGHT / gridSize);

    // Create grid (true = passable)
    const grid: boolean[][] = [];
    for (let y = 0; y < gridHeight; y++) {
      grid[y] = [];
      for (let x = 0; x < gridWidth; x++) {
        const cellX = x * gridSize;
        const cellY = y * gridSize;

        // Check if cell is blocked by any wall
        let blocked = false;
        for (const wall of walls) {
          if (
            cellX < wall.x + wall.w &&
            cellX + gridSize > wall.x &&
            cellY < wall.y + wall.h &&
            cellY + gridSize > wall.y
          ) {
            blocked = true;
            break;
          }
        }
        grid[y][x] = !blocked;
      }
    }

    // BFS from start to end
    const startCell = {
      x: Math.floor(start.x / gridSize),
      y: Math.floor(start.y / gridSize),
    };
    const endCell = {
      x: Math.floor(end.x / gridSize),
      y: Math.floor(end.y / gridSize),
    };

    const visited: boolean[][] = [];
    for (let y = 0; y < gridHeight; y++) {
      visited[y] = new Array(gridWidth).fill(false);
    }

    const queue: { x: number; y: number }[] = [startCell];
    visited[startCell.y][startCell.x] = true;

    const directions = [
      { x: 0, y: -1 },
      { x: 0, y: 1 },
      { x: -1, y: 0 },
      { x: 1, y: 0 },
    ];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.x === endCell.x && current.y === endCell.y) {
        return true;
      }

      for (const dir of directions) {
        const nx = current.x + dir.x;
        const ny = current.y + dir.y;

        if (
          nx >= 0 &&
          nx < gridWidth &&
          ny >= 0 &&
          ny < gridHeight &&
          !visited[ny][nx] &&
          grid[ny][nx]
        ) {
          visited[ny][nx] = true;
          queue.push({ x: nx, y: ny });
        }
      }
    }

    return false;
  }

  /**
   * Set a new seed for random generation
   */
  public setSeed(seed: number): void {
    this.seed = seed;
  }

  /**
   * Get current seed
   */
  public getSeed(): number {
    return this.seed;
  }
}
