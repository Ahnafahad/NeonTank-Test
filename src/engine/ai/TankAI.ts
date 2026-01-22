// TankAI - Main AI controller with behavior tree
import { Vector } from '../utils/Vector';
import { Tank } from '../entities/Tank';
import { Bullet } from '../entities/Bullet';
import { Wall } from '../entities/Wall';
import { PowerUp } from '../entities/PowerUp';
import { Constants } from '../utils/Constants';
import { PathFinding } from './behaviors/PathFinding';
import { AimingSystem, AIDifficulty } from './behaviors/AimingSystem';

export interface AIInput {
  movement: Vector;
  shoot: boolean;
  chargeLevel: number;
}

type AIState = 'idle' | 'chase' | 'attack' | 'evade' | 'collect' | 'patrol';

export class TankAI {
  private difficulty: AIDifficulty;
  private pathFinding: PathFinding;
  private aimingSystem: AimingSystem;

  // Behavior state
  private currentState: AIState = 'idle';
  private stateTimer: number = 0;
  private currentPath: Vector[] = [];
  private pathIndex: number = 0;
  private targetPowerUp: PowerUp | null = null;

  // Reaction timing
  private reactionTimer: number = 0;
  private reactionDelay: number = 15;

  // Charging state
  private isCharging: boolean = false;
  private chargeStartTime: number = 0;

  // Evasion
  private evadeDirection: Vector = Vector.zero();
  private lastDodgeTime: number = 0;

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
    this.pathFinding = new PathFinding(50);
    this.aimingSystem = new AimingSystem(difficulty);
    this.setDifficulty(difficulty);
  }

  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    this.aimingSystem.setDifficulty(difficulty);

    switch (difficulty) {
      case 'easy':
        this.reactionDelay = 30;
        break;
      case 'medium':
        this.reactionDelay = 15;
        break;
      case 'hard':
        this.reactionDelay = 3;
        break;
    }
  }

  update(
    aiTank: Tank,
    playerTank: Tank,
    bullets: Bullet[],
    walls: Wall[],
    crates: Wall[],
    powerups: PowerUp[],
    suddenDeathActive: boolean,
    suddenDeathInset: number
  ): AIInput {
    // Update pathfinding grid
    this.pathFinding.updateGrid(walls, crates);

    // Reaction delay
    if (this.reactionTimer > 0) {
      this.reactionTimer--;
      return { movement: Vector.zero(), shoot: false, chargeLevel: 0 };
    }

    // Priority-based behavior tree
    const input = this.executeBehaviorTree(
      aiTank,
      playerTank,
      bullets,
      walls,
      crates,
      powerups,
      suddenDeathActive,
      suddenDeathInset
    );

    return input;
  }

  private executeBehaviorTree(
    aiTank: Tank,
    playerTank: Tank,
    bullets: Bullet[],
    walls: Wall[],
    crates: Wall[],
    powerups: PowerUp[],
    suddenDeathActive: boolean,
    suddenDeathInset: number
  ): AIInput {
    // Priority 1: Evade incoming bullets
    const dangerousBullet = this.findDangerousBullet(aiTank, bullets);
    if (dangerousBullet) {
      return this.evadeBullet(aiTank, dangerousBullet);
    }

    // Priority 2: Escape sudden death zone
    if (suddenDeathActive) {
      const escapeMove = this.escapeSuddenDeath(aiTank, suddenDeathInset);
      if (escapeMove) {
        return { movement: escapeMove, shoot: false, chargeLevel: 0 };
      }
    }

    // Priority 3: Collect nearby power-ups (if beneficial)
    const nearbyPowerUp = this.findBestPowerUp(aiTank, powerups, playerTank);
    if (nearbyPowerUp && this.shouldCollectPowerUp(aiTank, nearbyPowerUp, playerTank)) {
      return this.collectPowerUp(aiTank, nearbyPowerUp, playerTank, walls, crates);
    }

    // Priority 4: Combat behavior
    return this.combatBehavior(aiTank, playerTank, walls, crates);
  }

  private findDangerousBullet(aiTank: Tank, bullets: Bullet[]): Bullet | null {
    const dangerRadius = this.difficulty === 'hard' ? 150 : this.difficulty === 'medium' ? 100 : 60;

    for (const bullet of bullets) {
      if (bullet.ownerId === aiTank.id) continue;

      // Check if bullet is heading towards AI
      const toBullet = bullet.pos.sub(aiTank.pos);
      const distance = toBullet.mag();

      if (distance < dangerRadius) {
        // Check if bullet is moving towards us
        const bulletDir = bullet.vel.normalize();
        const toAI = aiTank.pos.sub(bullet.pos).normalize();
        const dot = bulletDir.x * toAI.x + bulletDir.y * toAI.y;

        if (dot > 0.5) {
          return bullet;
        }
      }
    }

    return null;
  }

  private evadeBullet(aiTank: Tank, bullet: Bullet): AIInput {
    // Calculate perpendicular direction to bullet path
    const bulletDir = bullet.vel.normalize();
    const perpendicular1 = new Vector(-bulletDir.y, bulletDir.x);
    const perpendicular2 = new Vector(bulletDir.y, -bulletDir.x);

    // Choose the direction that moves us further from bullet
    const pos1 = aiTank.pos.add(perpendicular1.mult(50));
    const pos2 = aiTank.pos.add(perpendicular2.mult(50));

    const dist1 = pos1.distanceTo(bullet.pos);
    const dist2 = pos2.distanceTo(bullet.pos);

    // Also check bounds
    const inBounds1 = pos1.x > 30 && pos1.x < Constants.GAME_WIDTH - 30 &&
                      pos1.y > 30 && pos1.y < Constants.GAME_HEIGHT - 30;
    const inBounds2 = pos2.x > 30 && pos2.x < Constants.GAME_WIDTH - 30 &&
                      pos2.y > 30 && pos2.y < Constants.GAME_HEIGHT - 30;

    let evadeDir: Vector;
    if (inBounds1 && (!inBounds2 || dist1 > dist2)) {
      evadeDir = perpendicular1;
    } else if (inBounds2) {
      evadeDir = perpendicular2;
    } else {
      // Move away from bullet
      evadeDir = aiTank.pos.sub(bullet.pos).normalize();
    }

    // Hard AI: serpentine evasion
    if (this.difficulty === 'hard') {
      const now = Date.now();
      if (now - this.lastDodgeTime > 200) {
        this.evadeDirection = evadeDir;
        this.lastDodgeTime = now;
      }
      evadeDir = this.evadeDirection;
    }

    return { movement: evadeDir, shoot: false, chargeLevel: 0 };
  }

  private escapeSuddenDeath(aiTank: Tank, inset: number): Vector | null {
    const margin = inset + 50;
    let escapeDir = Vector.zero();
    let needsEscape = false;

    if (aiTank.pos.x < margin) {
      escapeDir = escapeDir.add(new Vector(1, 0));
      needsEscape = true;
    }
    if (aiTank.pos.x > Constants.GAME_WIDTH - margin) {
      escapeDir = escapeDir.add(new Vector(-1, 0));
      needsEscape = true;
    }
    if (aiTank.pos.y < margin) {
      escapeDir = escapeDir.add(new Vector(0, 1));
      needsEscape = true;
    }
    if (aiTank.pos.y > Constants.GAME_HEIGHT - margin) {
      escapeDir = escapeDir.add(new Vector(0, -1));
      needsEscape = true;
    }

    return needsEscape ? escapeDir.normalize() : null;
  }

  private findBestPowerUp(aiTank: Tank, powerups: PowerUp[], playerTank: Tank): PowerUp | null {
    if (powerups.length === 0) return null;

    const searchRadius = this.difficulty === 'hard' ? 400 : this.difficulty === 'medium' ? 250 : 150;
    let best: PowerUp | null = null;
    let bestScore = -Infinity;

    for (const powerup of powerups) {
      const distance = aiTank.pos.distanceTo(powerup.pos);
      if (distance > searchRadius) continue;

      // Score based on type and need
      let score = 100 - distance;

      switch (powerup.type) {
        case 'HEALTH':
          score += (100 - aiTank.health) * 2;
          break;
        case 'SHIELD':
          if (aiTank.shieldTimer <= 0) score += 80;
          break;
        case 'SPEED':
          if (aiTank.speedTimer <= 0) score += 50;
          break;
        case 'SHOTGUN':
        case 'LASER':
          if (aiTank.currentWeapon === 'NORMAL') score += 60;
          break;
      }

      // Penalty if player is closer
      const playerDist = playerTank.pos.distanceTo(powerup.pos);
      if (playerDist < distance) score -= 50;

      if (score > bestScore) {
        bestScore = score;
        best = powerup;
      }
    }

    return best;
  }

  private shouldCollectPowerUp(aiTank: Tank, powerup: PowerUp, playerTank: Tank): boolean {
    const distance = aiTank.pos.distanceTo(powerup.pos);
    const playerDist = playerTank.pos.distanceTo(powerup.pos);

    // Always collect health if low
    if (powerup.type === 'HEALTH' && aiTank.health < 50) return true;

    // Don't go for power-ups if player is much closer
    if (playerDist < distance * 0.5) return false;

    // Difficulty affects collection willingness
    switch (this.difficulty) {
      case 'easy':
        return distance < 100;
      case 'medium':
        return distance < 200 || (powerup.type === 'HEALTH' && aiTank.health < 70);
      case 'hard':
        return true;
    }
  }

  private collectPowerUp(
    aiTank: Tank,
    powerup: PowerUp,
    playerTank: Tank,
    walls: Wall[],
    crates: Wall[]
  ): AIInput {
    const direction = powerup.pos.sub(aiTank.pos).normalize();

    // Still try to shoot while moving
    const aimResult = this.aimingSystem.calculateAim(aiTank, playerTank, walls, crates);

    return {
      movement: direction,
      shoot: aimResult.shouldShoot && aimResult.confidence > 0.5,
      chargeLevel: 0,
    };
  }

  private combatBehavior(
    aiTank: Tank,
    playerTank: Tank,
    walls: Wall[],
    crates: Wall[]
  ): AIInput {
    const distance = aiTank.pos.distanceTo(playerTank.pos);
    const aimResult = this.aimingSystem.calculateAim(aiTank, playerTank, walls, crates);

    // Determine optimal range based on difficulty
    const optimalMin = this.difficulty === 'hard' ? 150 : 200;
    const optimalMax = this.difficulty === 'hard' ? 350 : 300;

    let movement = Vector.zero();

    // Positioning
    if (distance < optimalMin) {
      // Too close - back away
      movement = aiTank.pos.sub(playerTank.pos).normalize();
    } else if (distance > optimalMax) {
      // Too far - move closer
      movement = playerTank.pos.sub(aiTank.pos).normalize();
    } else {
      // In optimal range - strafe
      if (this.difficulty !== 'easy') {
        const perpendicular = new Vector(
          -(playerTank.pos.y - aiTank.pos.y),
          playerTank.pos.x - aiTank.pos.x
        ).normalize();
        movement = perpendicular.mult(Math.sin(Date.now() / 500));
      }
    }

    // Check for charge shot
    let chargeLevel = 0;
    if (this.aimingSystem.shouldChargeShot(aiTank, playerTank)) {
      if (!this.isCharging) {
        this.isCharging = true;
        this.chargeStartTime = Date.now();
      }
      chargeLevel = Math.min((Date.now() - this.chargeStartTime) / 500, 1);

      if (chargeLevel >= 1) {
        this.isCharging = false;
        return { movement, shoot: true, chargeLevel: 1 };
      }
      return { movement, shoot: false, chargeLevel };
    } else {
      this.isCharging = false;
    }

    return {
      movement,
      shoot: aimResult.shouldShoot,
      chargeLevel: 0,
    };
  }

  // Convert AI input to virtual keyboard state
  getVirtualKeyState(input: AIInput, controls: { up: string; down: string; left: string; right: string; shoot: string }): { [key: string]: boolean } {
    const keys: { [key: string]: boolean } = {};
    const threshold = 0.3;

    if (input.movement.y < -threshold) keys[controls.up] = true;
    if (input.movement.y > threshold) keys[controls.down] = true;
    if (input.movement.x < -threshold) keys[controls.left] = true;
    if (input.movement.x > threshold) keys[controls.right] = true;
    if (input.shoot) keys[controls.shoot] = true;

    return keys;
  }
}
