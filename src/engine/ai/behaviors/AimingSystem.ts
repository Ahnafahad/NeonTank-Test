// Aiming System - Predictive targeting for AI
import { Vector } from '../../utils/Vector';
import { Tank } from '../../entities/Tank';
import { Wall } from '../../entities/Wall';
import { Constants } from '../../utils/Constants';

export type AIDifficulty = 'easy' | 'medium' | 'hard';

interface AimResult {
  targetAngle: number;
  shouldShoot: boolean;
  confidence: number;
}

export class AimingSystem {
  private difficulty: AIDifficulty;
  private accuracyOffset: number;
  private lastTargetPos: Vector | null = null;
  private targetVelocity: Vector = Vector.zero();

  constructor(difficulty: AIDifficulty = 'medium') {
    this.difficulty = difficulty;
    this.accuracyOffset = Math.PI / 6;
    this.setDifficulty(difficulty);
  }

  setDifficulty(difficulty: AIDifficulty): void {
    this.difficulty = difficulty;
    switch (difficulty) {
      case 'easy':
        this.accuracyOffset = Math.PI / 3;
        break;
      case 'medium':
        this.accuracyOffset = Math.PI / 6;
        break;
      case 'hard':
        this.accuracyOffset = Math.PI / 18;
        break;
    }
  }

  calculateAim(aiTank: Tank, targetTank: Tank, walls: Wall[], crates: Wall[]): AimResult {
    if (this.lastTargetPos !== null) {
      this.targetVelocity = targetTank.pos.sub(this.lastTargetPos);
    }
    this.lastTargetPos = targetTank.pos.clone();

    const distance = aiTank.pos.distanceTo(targetTank.pos);
    const bulletSpeed = this.getBulletSpeed(aiTank);
    const travelTime = distance / bulletSpeed;

    let predictedPos: Vector;
    if (this.difficulty === 'easy') {
      predictedPos = targetTank.pos;
    } else {
      const predictionFrames = Math.min(travelTime * 60, 60);
      predictedPos = targetTank.pos.add(this.targetVelocity.mult(predictionFrames));
    }

    const direction = predictedPos.sub(aiTank.pos);
    let targetAngle = Math.atan2(direction.y, direction.x);
    const randomOffset = (Math.random() - 0.5) * 2 * this.accuracyOffset;
    targetAngle += randomOffset;

    const hasLineOfSight = this.hasLineOfSight(aiTank.pos, predictedPos, walls, crates);

    let confidence = 1.0;
    confidence *= Math.max(0.3, 1 - distance / 500);
    if (!hasLineOfSight) confidence *= 0.3;
    if (this.targetVelocity.mag() > 2) confidence *= 0.7;

    switch (this.difficulty) {
      case 'easy': confidence *= 0.4; break;
      case 'medium': confidence *= 0.7; break;
      case 'hard': confidence *= 0.95; break;
    }

    const shouldShoot =
      hasLineOfSight &&
      confidence > 0.3 &&
      !aiTank.isReloading &&
      aiTank.cooldown <= 0 &&
      (this.difficulty === 'hard' || Math.random() < confidence);

    return { targetAngle, shouldShoot, confidence };
  }

  private hasLineOfSight(from: Vector, to: Vector, walls: Wall[], crates: Wall[]): boolean {
    const allObstacles = [...walls, ...crates.filter(c => c.active)];
    const direction = to.sub(from).normalize();
    const distance = from.distanceTo(to);
    const steps = Math.ceil(distance / 10);

    for (let i = 1; i < steps; i++) {
      const checkPos = from.add(direction.mult(i * 10));
      for (const obstacle of allObstacles) {
        if (
          checkPos.x > obstacle.x - 5 &&
          checkPos.x < obstacle.x + obstacle.w + 5 &&
          checkPos.y > obstacle.y - 5 &&
          checkPos.y < obstacle.y + obstacle.h + 5
        ) {
          return false;
        }
      }
    }
    return true;
  }

  private getBulletSpeed(tank: Tank): number {
    switch (tank.currentWeapon) {
      case 'LASER': return Constants.LASER_SPEED;
      case 'CHARGE': return Constants.CHARGE_BULLET_SPEED;
      default: return Constants.BULLET_SPEED;
    }
  }

  shouldChargeShot(aiTank: Tank, targetTank: Tank): boolean {
    if (this.difficulty === 'easy') return false;
    const distance = aiTank.pos.distanceTo(targetTank.pos);
    if (distance > 150 && distance < 400 && aiTank.ammo >= Constants.CHARGE_AMMO_COST && !aiTank.isReloading) {
      return this.difficulty === 'hard' || Math.random() < 0.3;
    }
    return false;
  }
}
