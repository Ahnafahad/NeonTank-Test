// Hazard zone class (extracted from HTML lines 436-471)
export type HazardType = 'RADIATION';

export class Hazard {
  public x: number;
  public y: number;
  public w: number;
  public h: number;
  public type: HazardType;

  constructor(x: number, y: number, w: number, h: number, type: HazardType) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.type = type;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.type === 'RADIATION') {
      ctx.fillStyle = 'rgba(0, 255, 0, 0.1)';
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 1;

      // Stripes effect
      ctx.save();
      ctx.beginPath();
      ctx.rect(this.x, this.y, this.w, this.h);
      ctx.clip();

      ctx.strokeStyle = 'rgba(0, 255, 0, 0.3)';
      for (let i = 0; i < this.w + this.h; i += 20) {
        ctx.beginPath();
        ctx.moveTo(this.x + i, this.y);
        ctx.lineTo(this.x + i - 100, this.y + 200);
        ctx.stroke();
      }
      ctx.restore();

      ctx.shadowBlur = 5;
      ctx.shadowColor = '#00ff00';
      ctx.strokeStyle = '#00ff00';
      ctx.strokeRect(this.x, this.y, this.w, this.h);
      ctx.shadowBlur = 0;
    }
  }

  isPointInside(x: number, y: number): boolean {
    return x > this.x && x < this.x + this.w && y > this.y && y < this.y + this.h;
  }
}
