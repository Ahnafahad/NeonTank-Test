// Entity lifecycle management system
import { PowerUp, PowerUpType } from '../entities/PowerUp';
import { Particle } from '../entities/Particle';
import { Constants } from '../utils/Constants';

export class EntitySystem {
  /**
   * Spawn a random power-up at a valid location
   */
  public spawnPowerUp(
    walls: any[],
    crates: any[],
    hazards: any[]
  ): PowerUp | null {
    const powerUpTypes: PowerUpType[] = ['HEALTH', 'SPEED', 'SHOTGUN', 'LASER', 'SHIELD'];
    const type = powerUpTypes[Math.floor(Math.random() * powerUpTypes.length)];

    // Try to find valid spawn location (max 10 attempts)
    for (let attempts = 0; attempts < 10; attempts++) {
      const x = Math.random() * (Constants.GAME_WIDTH - 100) + 50;
      const y = Math.random() * (Constants.GAME_HEIGHT - 100) + 50;

      // Check if position is clear
      let valid = true;

      for (const w of walls) {
        if (w.isPointInside(x, y)) {
          valid = false;
          break;
        }
      }

      if (!valid) continue;

      for (const c of crates) {
        if (c.isPointInside(x, y)) {
          valid = false;
          break;
        }
      }

      if (!valid) continue;

      for (const h of hazards) {
        if (h.isPointInside(x, y)) {
          valid = false;
          break;
        }
      }

      if (valid) {
        return new PowerUp(x, y, type);
      }
    }

    return null; // Couldn't find valid spot
  }

  /**
   * Create explosion particles
   */
  public createExplosion(
    x: number,
    y: number,
    color: string,
    count: number
  ): Particle[] {
    const particles: Particle[] = [];

    for (let i = 0; i < count; i++) {
      particles.push(new Particle(x, y, color));
    }

    return particles;
  }

  /**
   * Update and clean up inactive entities
   */
  public cleanupInactiveEntities<T extends { active?: boolean; isDead?: () => boolean }>(
    entities: T[]
  ): T[] {
    return entities.filter(entity => {
      if ('active' in entity) {
        return entity.active !== false;
      }
      if ('isDead' in entity && entity.isDead) {
        return !entity.isDead();
      }
      return true;
    });
  }
}
