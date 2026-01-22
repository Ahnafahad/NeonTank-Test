// Game type definitions
import { Tank } from '../engine/entities/Tank';
import { Bullet } from '../engine/entities/Bullet';
import { PowerUp } from '../engine/entities/PowerUp';
import { Wall } from '../engine/entities/Wall';
import { Hazard } from '../engine/entities/Hazard';
import { Particle } from '../engine/entities/Particle';

export interface GameEntities {
  tanks: Tank[];
  bullets: Bullet[];
  powerups: PowerUp[];
  walls: Wall[];
  crates: Wall[];
  hazards: Hazard[];
  particles: Particle[];
}

export interface Score {
  p1: number;
  p2: number;
}

export interface GameStats {
  health: {
    p1: number;
    p2: number;
  };
  scores: Score;
  gameTime: number;
  suddenDeath: boolean;
}
