// Wall/Obstacle class (extracted from HTML lines 398-434)
import { Constants } from '../utils/Constants';

export class Wall {
  public x: number;
  public y: number;
  public w: number;
  public h: number;
  public destructible: boolean;
  public health: number;
  public active: boolean;
  public id: string;

  constructor(x: number, y: number, w: number, h: number, destructible: boolean = false) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.destructible = destructible;
    this.health = Constants.WALL_HEALTH;
    this.active = true;
    this.id = `wall-${x}-${y}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    if (this.destructible) {
      ctx.fillStyle = `rgba(150, 100, 50, ${this.health / Constants.WALL_HEALTH})`;
      ctx.strokeStyle = '#d68c24';
    } else {
      ctx.fillStyle = '#222';
      ctx.strokeStyle = '#444';
    }

    ctx.shadowBlur = 10;
    ctx.shadowColor = this.destructible ? '#d68c24' : '#444';
    ctx.fillRect(this.x, this.y, this.w, this.h);
    ctx.lineWidth = 2;
    ctx.strokeRect(this.x, this.y, this.w, this.h);

    if (this.destructible) {
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x + this.w, this.y + this.h);
      ctx.moveTo(this.x + this.w, this.y);
      ctx.lineTo(this.x, this.y + this.h);
      ctx.stroke();
    }

    ctx.shadowBlur = 0;
  }

  takeDamage(damage: number): void {
    if (this.destructible) {
      this.health -= damage;
      if (this.health <= 0) {
        this.active = false;
      }
    }
  }

  isColliding(x: number, y: number, width: number, height: number): boolean {
    if (!this.active) return false;

    return (
      x + width > this.x &&
      x < this.x + this.w &&
      y + height > this.y &&
      y < this.y + this.h
    );
  }

  isPointInside(x: number, y: number): boolean {
    if (!this.active) return false;

    return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
  }
}
