// Particle class for explosion effects (extracted from HTML lines 522-544)
import { Vector } from '../utils/Vector';

export class Particle {
  public pos: Vector;
  public vel: Vector;
  public life: number;
  public decay: number;
  public color: string;

  constructor(x: number, y: number, color: string) {
    this.pos = new Vector(x, y);

    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 3 + 1;
    this.vel = new Vector(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.life = 1.0;
    this.decay = Math.random() * 0.03 + 0.02;
    this.color = color;
  }

  update(): void {
    this.pos = this.pos.add(this.vel);
    this.life -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = Math.max(0, this.life);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  isDead(): boolean {
    return this.life <= 0;
  }
}
