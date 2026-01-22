// PowerUp class (extracted from HTML lines 473-520)
import { Vector } from '../utils/Vector';
import { Constants } from '../utils/Constants';

export type PowerUpType = 'HEALTH' | 'SPEED' | 'SHOTGUN' | 'LASER' | 'SHIELD';

export class PowerUp {
  public pos: Vector;
  public type: PowerUpType;
  public radius: number;
  public pulse: number;
  public active: boolean;

  constructor(x: number, y: number, type: PowerUpType) {
    this.pos = new Vector(x, y);
    this.type = type;
    this.radius = Constants.POWERUP_RADIUS;
    this.pulse = Math.random() * Math.PI;
    this.active = true;
  }

  update(): void {
    this.pulse += 0.05;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (!this.active) return;

    const s = 1 + Math.sin(this.pulse) * 0.2;
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.scale(s, s);

    let color = '#fff';
    let label = '';

    switch (this.type) {
      case 'SPEED':
        color = '#00ffff';
        label = '>>';
        break;
      case 'HEALTH':
        color = '#00ff00';
        label = '+';
        break;
      case 'SHOTGUN':
        color = '#ffaa00';
        label = 'SG';
        break;
      case 'LASER':
        color = '#ff00ff';
        label = 'LZ';
        break;
      case 'SHIELD':
        color = '#0088ff';
        label = 'SH';
        break;
    }

    ctx.shadowBlur = 15;
    ctx.shadowColor = color;
    ctx.fillStyle = 'rgba(20,20,20,0.8)';
    ctx.beginPath();
    ctx.arc(0, 0, 14, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, 1);

    ctx.restore();
  }

  isCollidingWith(pos: Vector, radius: number): boolean {
    if (!this.active) return false;
    return this.pos.distanceTo(pos) < this.radius + radius;
  }
}
