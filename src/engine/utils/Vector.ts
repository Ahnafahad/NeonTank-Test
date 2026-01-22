// Vector math utility class (extracted from HTML lines 383-396)
export class Vector {
  constructor(public x: number, public y: number) {}

  add(v: Vector): Vector {
    return new Vector(this.x + v.x, this.y + v.y);
  }

  sub(v: Vector): Vector {
    return new Vector(this.x - v.x, this.y - v.y);
  }

  mult(n: number): Vector {
    return new Vector(this.x * n, this.y * n);
  }

  mag(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }

  normalize(): Vector {
    const m = this.mag();
    return m === 0 ? new Vector(0, 0) : new Vector(this.x / m, this.y / m);
  }

  // Additional utility methods for game engine
  lerp(v: Vector, t: number): Vector {
    return new Vector(
      this.x + (v.x - this.x) * t,
      this.y + (v.y - this.y) * t
    );
  }

  dot(v: Vector): number {
    return this.x * v.x + this.y * v.y;
  }

  distanceTo(v: Vector): number {
    return this.sub(v).mag();
  }

  clone(): Vector {
    return new Vector(this.x, this.y);
  }

  static fromAngle(angle: number, magnitude: number = 1): Vector {
    return new Vector(
      Math.cos(angle) * magnitude,
      Math.sin(angle) * magnitude
    );
  }

  static zero(): Vector {
    return new Vector(0, 0);
  }
}
