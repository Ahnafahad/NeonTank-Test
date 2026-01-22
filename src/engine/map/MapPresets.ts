// Map preset configurations for different map variants
import { Vector } from '../utils/Vector';

export type MapVariant = 'classic' | 'maze' | 'open' | 'fortress' | 'random';

export interface WallConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  destructible?: boolean;
}

export interface HazardConfig {
  x: number;
  y: number;
  w: number;
  h: number;
  type: 'RADIATION';
}

export interface SpawnConfig {
  p1: { x: number; y: number };
  p2: { x: number; y: number };
}

export interface MapPresetConfig {
  walls: WallConfig[];
  crates: WallConfig[];
  hazards: HazardConfig[];
  spawnPoints: SpawnConfig;
}

// CLASSIC - The original map layout
const CLASSIC_PRESET: MapPresetConfig = {
  walls: [
    // Center block
    { x: 450, y: 300, w: 100, h: 100 },
    // Corner cover
    { x: 150, y: 100, w: 50, h: 150 },
    { x: 800, y: 100, w: 50, h: 150 },
    { x: 150, y: 450, w: 50, h: 150 },
    { x: 800, y: 450, w: 50, h: 150 },
  ],
  crates: [
    { x: 250, y: 200, w: 40, h: 40, destructible: true },
    { x: 250, y: 460, w: 40, h: 40, destructible: true },
    { x: 710, y: 200, w: 40, h: 40, destructible: true },
    { x: 710, y: 460, w: 40, h: 40, destructible: true },
    { x: 450, y: 200, w: 100, h: 40, destructible: true },
    { x: 450, y: 460, w: 100, h: 40, destructible: true },
  ],
  hazards: [
    { x: 425, y: 50, w: 150, h: 100, type: 'RADIATION' },
    { x: 425, y: 550, w: 150, h: 100, type: 'RADIATION' },
  ],
  spawnPoints: {
    p1: { x: 100, y: 350 },
    p2: { x: 900, y: 350 },
  },
};

// MAZE - Dense network of walls creating corridors
const MAZE_PRESET: MapPresetConfig = {
  walls: [
    // Horizontal corridors
    { x: 100, y: 150, w: 200, h: 20 },
    { x: 400, y: 150, w: 200, h: 20 },
    { x: 700, y: 150, w: 200, h: 20 },
    { x: 200, y: 300, w: 150, h: 20 },
    { x: 425, y: 300, w: 150, h: 20 },
    { x: 650, y: 300, w: 150, h: 20 },
    { x: 100, y: 450, w: 200, h: 20 },
    { x: 400, y: 450, w: 200, h: 20 },
    { x: 700, y: 450, w: 200, h: 20 },
    // Vertical corridors
    { x: 200, y: 50, w: 20, h: 100 },
    { x: 350, y: 170, w: 20, h: 130 },
    { x: 500, y: 50, w: 20, h: 100 },
    { x: 630, y: 170, w: 20, h: 130 },
    { x: 800, y: 50, w: 20, h: 100 },
    { x: 200, y: 320, w: 20, h: 130 },
    { x: 350, y: 470, w: 20, h: 100 },
    { x: 500, y: 320, w: 20, h: 130 },
    { x: 630, y: 470, w: 20, h: 100 },
    { x: 800, y: 320, w: 20, h: 130 },
    // Additional maze elements
    { x: 150, y: 220, w: 20, h: 80 },
    { x: 280, y: 380, w: 80, h: 20 },
    { x: 720, y: 220, w: 20, h: 80 },
    { x: 640, y: 380, w: 80, h: 20 },
    { x: 450, y: 200, w: 100, h: 20 },
    { x: 450, y: 400, w: 100, h: 20 },
  ],
  crates: [], // Minimal crates in maze
  hazards: [], // Minimal hazards in maze
  spawnPoints: {
    p1: { x: 50, y: 50 },
    p2: { x: 950, y: 650 },
  },
};

// OPEN - Almost no walls, emphasis on aim
const OPEN_PRESET: MapPresetConfig = {
  walls: [
    // Small corner covers only
    { x: 50, y: 50, w: 30, h: 30 },
    { x: 920, y: 50, w: 30, h: 30 },
    { x: 50, y: 620, w: 30, h: 30 },
    { x: 920, y: 620, w: 30, h: 30 },
  ],
  crates: [
    // Lots of crates clustered in center
    { x: 400, y: 280, w: 40, h: 40, destructible: true },
    { x: 450, y: 280, w: 40, h: 40, destructible: true },
    { x: 500, y: 280, w: 40, h: 40, destructible: true },
    { x: 400, y: 330, w: 40, h: 40, destructible: true },
    { x: 450, y: 330, w: 40, h: 40, destructible: true },
    { x: 500, y: 330, w: 40, h: 40, destructible: true },
    { x: 400, y: 380, w: 40, h: 40, destructible: true },
    { x: 450, y: 380, w: 40, h: 40, destructible: true },
    { x: 500, y: 380, w: 40, h: 40, destructible: true },
    // Additional scattered crates
    { x: 300, y: 200, w: 40, h: 40, destructible: true },
    { x: 660, y: 200, w: 40, h: 40, destructible: true },
    { x: 300, y: 460, w: 40, h: 40, destructible: true },
    { x: 660, y: 460, w: 40, h: 40, destructible: true },
  ],
  hazards: [], // No hazards in open map
  spawnPoints: {
    p1: { x: 100, y: 350 },
    p2: { x: 900, y: 350 },
  },
};

// FORTRESS - Two fortified bases on each side
const FORTRESS_PRESET: MapPresetConfig = {
  walls: [
    // Player 1 fortress (left side)
    { x: 50, y: 200, w: 20, h: 300 }, // Back wall
    { x: 50, y: 200, w: 150, h: 20 }, // Top wall
    { x: 50, y: 480, w: 150, h: 20 }, // Bottom wall
    { x: 180, y: 200, w: 20, h: 100 }, // Inner top wall
    { x: 180, y: 400, w: 20, h: 100 }, // Inner bottom wall
    // Player 2 fortress (right side)
    { x: 930, y: 200, w: 20, h: 300 }, // Back wall
    { x: 800, y: 200, w: 150, h: 20 }, // Top wall
    { x: 800, y: 480, w: 150, h: 20 }, // Bottom wall
    { x: 800, y: 200, w: 20, h: 100 }, // Inner top wall
    { x: 800, y: 400, w: 20, h: 100 }, // Inner bottom wall
    // Small central pillars
    { x: 450, y: 250, w: 30, h: 30 },
    { x: 520, y: 250, w: 30, h: 30 },
    { x: 450, y: 420, w: 30, h: 30 },
    { x: 520, y: 420, w: 30, h: 30 },
  ],
  crates: [
    // Cover inside fortresses
    { x: 100, y: 280, w: 40, h: 40, destructible: true },
    { x: 100, y: 380, w: 40, h: 40, destructible: true },
    { x: 860, y: 280, w: 40, h: 40, destructible: true },
    { x: 860, y: 380, w: 40, h: 40, destructible: true },
  ],
  hazards: [
    // Hazards in no-man's land (center)
    { x: 350, y: 300, w: 80, h: 100, type: 'RADIATION' },
    { x: 570, y: 300, w: 80, h: 100, type: 'RADIATION' },
  ],
  spawnPoints: {
    p1: { x: 100, y: 350 },
    p2: { x: 900, y: 350 },
  },
};

// Map presets object for easy access
export const MapPresets: Record<Exclude<MapVariant, 'random'>, MapPresetConfig> = {
  classic: CLASSIC_PRESET,
  maze: MAZE_PRESET,
  open: OPEN_PRESET,
  fortress: FORTRESS_PRESET,
};

// Random map generation parameters
export interface RandomMapParams {
  minWalls: number;
  maxWalls: number;
  minCrates: number;
  maxCrates: number;
  minHazards: number;
  maxHazards: number;
  wallMinSize: number;
  wallMaxSize: number;
  crateSize: number;
  hazardMinSize: number;
  hazardMaxSize: number;
}

export const RANDOM_MAP_PARAMS: RandomMapParams = {
  minWalls: 8,
  maxWalls: 15,
  minCrates: 4,
  maxCrates: 10,
  minHazards: 1,
  maxHazards: 3,
  wallMinSize: 40,
  wallMaxSize: 120,
  crateSize: 40,
  hazardMinSize: 60,
  hazardMaxSize: 120,
};
