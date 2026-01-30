// Bullet class (extracted from HTML lines 546-652)
import { Vector } from '../utils/Vector';
import { Wall } from './Wall';
import { Constants, MAX_BOUNCES } from '../utils/Constants';

export type BulletType = 'NORMAL' | 'CHARGE' | 'SHOTGUN' | 'LASER';

export class Bullet {
  public pos: Vector;
  public vel: Vector;
  public radius: number;
  public color: string;
  public ownerId: number;
  public id: string;
  public active: boolean;
  public type: BulletType;
  public damage: number;
  public bounces: number;

  // Trail system
  public positionHistory: Vector[] = [];
  public trailLength: number = 5;
  public trailsEnabled: boolean = false;

  // Client-side prediction
  public isPredicted: boolean = false;
  public predictionId?: string;

  constructor(x: number, y: number, angle: number, ownerColor: string, ownerId: number, type: BulletType = 'NORMAL') {
    this.pos = new Vector(x, y);

    let speed: number = Constants.BULLET_SPEED;
    if (type === 'LASER') speed = Constants.LASER_SPEED;
    if (type === 'CHARGE') speed = Constants.CHARGE_BULLET_SPEED;

    this.vel = new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.radius = type === 'CHARGE' ? Constants.CHARGE_BULLET_RADIUS : Constants.BULLET_RADIUS;
    this.color = ownerColor;
    this.ownerId = ownerId;
    this.id = `${ownerId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.active = true;
    this.type = type;

    this.damage = Constants.BULLET_DAMAGE;
    if (type === 'CHARGE') this.damage = Constants.CHARGE_DAMAGE;
    if (type === 'SHOTGUN') this.damage = Constants.SHOTGUN_DAMAGE;
    if (type === 'LASER') this.damage = Constants.LASER_DAMAGE;

    this.bounces = MAX_BOUNCES;
    if (type === 'CHARGE') this.bounces = 0; // Charge shot breaks on impact
    if (type === 'LASER') this.bounces = 0;
  }

  // Configure trail settings
  public setTrailSettings(enabled: boolean, length: number): void {
    this.trailsEnabled = enabled;
    this.trailLength = length;
  }

  update(walls: Wall[], crates: Wall[]): void {
    // Update position history for trails
    if (this.trailsEnabled) {
      this.positionHistory.push(this.pos.clone());
      // Keep only the last trailLength positions
      if (this.positionHistory.length > this.trailLength) {
        this.positionHistory.shift();
      }
    }

    this.pos = this.pos.add(this.vel);

    // Boundary collisions (Ricochet)
    if (this.pos.x < 0 || this.pos.x > Constants.GAME_WIDTH) {
      if (this.bounces > 0) {
        this.vel.x *= -1;
        this.bounces--;
        this.pos.x = Math.max(0, Math.min(Constants.GAME_WIDTH, this.pos.x));
      } else {
        this.active = false;
      }
    }
    if (this.pos.y < 0 || this.pos.y > Constants.GAME_HEIGHT) {
      if (this.bounces > 0) {
        this.vel.y *= -1;
        this.bounces--;
        this.pos.y = Math.max(0, Math.min(Constants.GAME_HEIGHT, this.pos.y));
      } else {
        this.active = false;
      }
    }

    // Wall/Crate Collisions
    const allWalls = [...walls, ...crates];
    for (const w of allWalls) {
      if (!w.active) continue;

      if (
        this.pos.x > w.x &&
        this.pos.x < w.x + w.w &&
        this.pos.y > w.y &&
        this.pos.y < w.y + w.h
      ) {
        if (this.bounces > 0) {
          const prevX = this.pos.x - this.vel.x;
          if (prevX <= w.x || prevX >= w.x + w.w) {
            this.vel.x *= -1;
          } else {
            this.vel.y *= -1;
          }
          this.bounces--;
          this.pos = this.pos.add(this.vel);
        } else {
          this.active = false;
        }

        if (w.destructible) {
          w.takeDamage(this.damage);
        }
        return;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    // Draw trail if enabled and we have history
    if (this.trailsEnabled && this.positionHistory.length > 1) {
      this.drawTrail(ctx);
    }

    ctx.fillStyle = '#fff';
    ctx.shadowBlur = 10;
    ctx.shadowColor = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
    ctx.fill();

    // Charge Shot Extra Glow
    if (this.type === 'CHARGE') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.radius + 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  private drawTrail(ctx: CanvasRenderingContext2D): void {
    const historyLen = this.positionHistory.length;
    if (historyLen < 2) return;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // Draw gradient line from oldest to newest position
    for (let i = 0; i < historyLen - 1; i++) {
      const start = this.positionHistory[i];
      const end = this.positionHistory[i + 1];

      // Calculate alpha based on position in history (older = more faded)
      const alpha = (i + 1) / historyLen;
      // Calculate line width (thinner at the tail)
      const lineWidth = this.radius * 2 * alpha;

      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);

      ctx.strokeStyle = this.color;
      ctx.globalAlpha = alpha * 0.7;
      ctx.lineWidth = lineWidth;
      ctx.shadowBlur = 5;
      ctx.shadowColor = this.color;
      ctx.stroke();
    }

    // Draw final segment from last history point to current position
    if (historyLen > 0) {
      const lastHistoryPos = this.positionHistory[historyLen - 1];
      ctx.beginPath();
      ctx.moveTo(lastHistoryPos.x, lastHistoryPos.y);
      ctx.lineTo(this.pos.x, this.pos.y);
      ctx.strokeStyle = this.color;
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = this.radius * 2;
      ctx.shadowBlur = 8;
      ctx.shadowColor = this.color;
      ctx.stroke();
    }

    ctx.restore();
  }
}
