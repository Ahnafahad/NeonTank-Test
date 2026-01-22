// Tank class (extracted from HTML lines 654-1062)
import { Vector } from '../utils/Vector';
import { Wall } from './Wall';
import { PowerUp, PowerUpType } from './PowerUp';
import { Bullet, BulletType } from './Bullet';
import { Hazard } from './Hazard';
import { Constants, STARTING_HEALTH } from '../utils/Constants';

export interface TankControls {
  up: string;
  down: string;
  left: string;
  right: string;
  shoot: string;
}

export class Tank {
  public id: number;
  public pos: Vector;
  public angle: number;
  public color: string;
  public controls: TankControls;
  public width: number;
  public height: number;
  public baseSpeed: number;
  public rotationSpeed: number;
  public cooldown: number;
  public maxHealth: number;
  public health: number;
  public dead: boolean;

  // Ammo & Reload
  public maxAmmo: number;
  public ammo: number;
  public reloadTimer: number;
  public reloadDuration: number;
  public isReloading: boolean;

  // Charging
  public chargeLevel: number;
  public chargeThreshold: number;
  public isCharging: boolean;

  // Weapon States
  public currentWeapon: BulletType;
  public weaponTimer: number;

  // Effect Timers
  public speedTimer: number;
  public shieldTimer: number;

  constructor(id: number, x: number, y: number, color: string, controls: TankControls) {
    this.id = id;
    this.pos = new Vector(x, y);
    this.angle = id === 1 ? 0 : Math.PI;
    this.color = color;
    this.controls = controls;
    this.width = Constants.TANK_SIZE;
    this.height = Constants.TANK_SIZE;
    this.baseSpeed = Constants.TANK_BASE_SPEED;
    this.rotationSpeed = Constants.TANK_ROTATION_SPEED;
    this.cooldown = 0;
    this.maxHealth = STARTING_HEALTH;
    this.health = this.maxHealth;
    this.dead = false;

    // Ammo & Reload
    this.maxAmmo = Constants.MAX_AMMO;
    this.ammo = this.maxAmmo;
    this.reloadTimer = 0;
    this.reloadDuration = Constants.RELOAD_DURATION;
    this.isReloading = false;

    // Charging
    this.chargeLevel = 0;
    this.chargeThreshold = Constants.CHARGE_THRESHOLD;
    this.isCharging = false;

    // Weapon States
    this.currentWeapon = 'NORMAL';
    this.weaponTimer = 0;

    // Effect Timers
    this.speedTimer = 0;
    this.shieldTimer = 0;
  }

  update(
    keys: { [key: string]: boolean },
    walls: Wall[],
    crates: Wall[],
    hazards: Hazard[],
    enemyTank: Tank,
    suddenDeathActive: boolean,
    suddenDeathInset: number,
    settings: { ammoSystem: boolean; charging: boolean; recoil: boolean },
    deltaMultiplier: number = 1.0
  ): Bullet[] {
    if (this.dead) return [];

    const newBullets: Bullet[] = [];

    // Effect Logic
    if (this.speedTimer > 0) this.speedTimer--;
    if (this.shieldTimer > 0) this.shieldTimer--;

    // Weapon Timer
    if (this.weaponTimer > 0) {
      this.weaponTimer--;
      if (this.weaponTimer <= 0) this.currentWeapon = 'NORMAL';
    }

    // Reload Logic
    if (this.isReloading) {
      this.reloadTimer--;
      if (this.reloadTimer <= 0) {
        this.isReloading = false;
        this.ammo = this.maxAmmo;
      }
    }

    // Hazard Damage
    for (const h of hazards) {
      if (h.type === 'RADIATION') {
        if (h.isPointInside(this.pos.x, this.pos.y)) {
          if (Math.random() < Constants.RADIATION_DAMAGE_CHANCE) {
            this.health -= Constants.RADIATION_DAMAGE;
            if (this.health <= 0) this.die();
          }
        }
      }
    }

    // Sudden Death Damage
    if (suddenDeathActive) {
      if (
        this.pos.x < suddenDeathInset ||
        this.pos.x > Constants.GAME_WIDTH - suddenDeathInset ||
        this.pos.y < suddenDeathInset ||
        this.pos.y > Constants.GAME_HEIGHT - suddenDeathInset
      ) {
        this.health -= 2; // Shield doesn't protect from sudden death
        if (this.health <= 0) this.die();
      }
    }

    const currentSpeed = this.speedTimer > 0 ? this.baseSpeed * 1.8 : this.baseSpeed;

    // Directional Movement Logic
    let moveX = 0;
    let moveY = 0;

    if (keys[this.controls.up]) moveY = -1;
    if (keys[this.controls.down]) moveY = 1;
    if (keys[this.controls.left]) moveX = -1;
    if (keys[this.controls.right]) moveX = 1;

    if (moveX !== 0 || moveY !== 0) {
      const targetAngle = Math.atan2(moveY, moveX);
      let diff = targetAngle - this.angle;
      while (diff <= -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;

      if (Math.abs(diff) < this.rotationSpeed) {
        this.angle = targetAngle;
      } else {
        this.angle += Math.sign(diff) * this.rotationSpeed;
      }

      const velocity = new Vector(moveX, moveY).normalize().mult(currentSpeed);
      const nextPos = this.pos.add(velocity);

      let collided = false;
      if (
        nextPos.x - 15 < 0 ||
        nextPos.x + 15 > Constants.GAME_WIDTH ||
        nextPos.y - 15 < 0 ||
        nextPos.y + 15 > Constants.GAME_HEIGHT
      )
        collided = true;

      const allWalls = [...walls, ...crates];
      if (!collided) {
        for (const w of allWalls) {
          if (!w.active) continue;
          if (
            nextPos.x + 10 > w.x &&
            nextPos.x - 10 < w.x + w.w &&
            nextPos.y + 10 > w.y &&
            nextPos.y - 10 < w.y + w.h
          ) {
            collided = true;
            break;
          }
        }
      }

      if (!enemyTank.dead) {
        const dist = nextPos.sub(enemyTank.pos).mag();
        if (dist < 35) collided = true;
      }

      if (!collided) {
        this.pos = nextPos;
      }
    }

    // Shooting & Charging Logic
    if (this.cooldown > 0) this.cooldown--;

    if (keys[this.controls.shoot]) {
      if (!this.isReloading && this.ammo > 0) {
        if (settings.charging) {
          this.chargeLevel++;
          this.isCharging = true;
        } else {
          // No charging, fire immediately
          if (this.cooldown === 0) {
            newBullets.push(...this.fireWeapon(settings, walls, crates));
          }
        }
      } else if (this.ammo <= 0 && !this.isReloading && settings.ammoSystem) {
        this.startReload();
      }
    } else {
      // Key released
      if (this.isCharging && settings.charging) {
        // Fire!
        newBullets.push(...this.fireWeapon(settings, walls, crates));
        this.chargeLevel = 0;
        this.isCharging = false;
      }
    }

    return newBullets;
  }

  startReload(): void {
    if (this.isReloading) return;
    this.isReloading = true;
    this.reloadTimer = this.reloadDuration;
  }

  applyPowerUp(type: PowerUpType): void {
    if (type === 'HEALTH') this.health = Math.min(this.maxHealth, this.health + 30);
    if (type === 'SPEED') this.speedTimer = Constants.POWERUP_DURATION;
    if (type === 'SHIELD') this.shieldTimer = Constants.POWERUP_DURATION;
    if (type === 'SHOTGUN') {
      this.currentWeapon = 'SHOTGUN';
      this.weaponTimer = Constants.POWERUP_DURATION;
      this.ammo = this.maxAmmo;
    }
    if (type === 'LASER') {
      this.currentWeapon = 'LASER';
      this.weaponTimer = Constants.POWERUP_DURATION;
      this.ammo = this.maxAmmo;
    }
  }

  fireWeapon(settings: { ammoSystem: boolean; recoil: boolean }, walls: Wall[], crates: Wall[]): Bullet[] {
    if ((settings.ammoSystem && this.ammo <= 0) || this.cooldown > 0) return [];

    const bullets: Bullet[] = [];

    // Determine Shot Type
    let shotType: BulletType = 'NORMAL';
    let cost = 1;

    // Check Charge
    if (this.chargeLevel > this.chargeThreshold) {
      if (!settings.ammoSystem || this.ammo >= 2) {
        shotType = 'CHARGE';
        cost = 2;
      } else {
        shotType = 'NORMAL';
      }
    } else if (this.currentWeapon !== 'NORMAL') {
      shotType = this.currentWeapon;
    }

    // Create Bullets
    const barrelLen = 25;
    const bx = this.pos.x + Math.cos(this.angle) * barrelLen;
    const by = this.pos.y + Math.sin(this.angle) * barrelLen;

    if (shotType === 'SHOTGUN') {
      bullets.push(new Bullet(bx, by, this.angle, this.color, this.id, 'SHOTGUN'));
      bullets.push(new Bullet(bx, by, this.angle - 0.2, this.color, this.id, 'SHOTGUN'));
      bullets.push(new Bullet(bx, by, this.angle + 0.2, this.color, this.id, 'SHOTGUN'));
    } else if (shotType === 'LASER') {
      bullets.push(new Bullet(bx, by, this.angle, this.color, this.id, 'LASER'));
    } else if (shotType === 'CHARGE') {
      bullets.push(new Bullet(bx, by, this.angle, this.color, this.id, 'CHARGE'));
    } else {
      bullets.push(new Bullet(bx, by, this.angle, this.color, this.id, 'NORMAL'));
    }

    if (settings.ammoSystem) {
      this.ammo -= cost;
      if (this.ammo < 0) this.ammo = 0;
    }

    this.cooldown = Constants.SHOOT_COOLDOWN;

    // Recoil
    if (settings.recoil) {
      const recoilVec = new Vector(
        Math.cos(this.angle) * Constants.TANK_RECOIL_DISTANCE,
        Math.sin(this.angle) * Constants.TANK_RECOIL_DISTANCE
      );
      const nextPos = this.pos.sub(recoilVec);

      let collided = false;
      if (
        nextPos.x - 15 < 0 ||
        nextPos.x + 15 > Constants.GAME_WIDTH ||
        nextPos.y - 15 < 0 ||
        nextPos.y + 15 > Constants.GAME_HEIGHT
      )
        collided = true;

      const allWalls = [...walls, ...crates];
      if (!collided) {
        for (const w of allWalls) {
          if (!w.active) continue;
          if (
            nextPos.x + 10 > w.x &&
            nextPos.x - 10 < w.x + w.w &&
            nextPos.y + 10 > w.y &&
            nextPos.y - 10 < w.y + w.h
          ) {
            collided = true;
            break;
          }
        }
      }

      if (!collided) {
        this.pos = nextPos;
      }
    }

    if (settings.ammoSystem && this.ammo <= 0) {
      this.startReload();
    }

    return bullets;
  }

  hit(isHazard: boolean = false): number {
    // Shield Logic
    if (this.shieldTimer > 0 && !isHazard) {
      return 0; // Block damage
    }

    if (this.shieldTimer > 0 && isHazard) return 0;

    const damage = isHazard ? 1 : 10;
    this.health -= damage;

    if (this.health <= 0) this.die();

    return damage;
  }

  die(): void {
    this.health = 0;
    this.dead = true;
  }

  draw(ctx: CanvasRenderingContext2D): void {
    if (this.dead) return;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);

    // Powerup Rings
    if (this.speedTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.strokeStyle = '#00ffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    if (this.weaponTimer > 0) {
      const color = this.currentWeapon === 'SHOTGUN' ? '#ffaa00' : '#ff00ff';
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Shield Visual
    if (this.shieldTimer > 0) {
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(0, 136, 255, ${0.5 + Math.sin(Date.now() / 100) * 0.3})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = `rgba(0, 136, 255, 0.1)`;
      ctx.fill();
    }

    // Charge Indicator
    if (this.isCharging) {
      const pct = Math.min(1, this.chargeLevel / this.chargeThreshold);
      ctx.beginPath();
      ctx.arc(0, 0, 15 + pct * 15, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 255, 255, ${pct})`;
      ctx.lineWidth = 2;
      ctx.stroke();

      if (pct >= 1 && this.ammo >= 2) {
        ctx.fillStyle = `rgba(255, 255, 255, 0.5)`;
        ctx.fill();
      }
    }

    // Floating Health Bar & Ammo UI
    ctx.fillStyle = 'rgba(0,0,0,0.8)';
    ctx.fillRect(-20, -40, 40, 6);

    // Health Fill
    const hpPercent = this.health / this.maxHealth;
    let hpColor = '#00ff00';
    if (hpPercent < 0.6) hpColor = '#ffff00';
    if (hpPercent < 0.3) hpColor = '#ff0000';
    ctx.fillStyle = hpColor;
    ctx.fillRect(-19, -39, Math.max(0, 38 * hpPercent), 4);

    // Reload / Ammo UI
    if (this.isReloading) {
      ctx.fillStyle = '#444';
      ctx.fillRect(-15, -30, 30, 3);
      ctx.fillStyle = '#fff';
      const reloadPct = 1 - this.reloadTimer / this.reloadDuration;
      ctx.fillRect(-15, -30, 30 * reloadPct, 3);
    } else {
      for (let i = 0; i < this.maxAmmo; i++) {
        ctx.fillStyle = i < this.ammo ? '#fff' : '#444';
        ctx.beginPath();
        const startX = -((this.maxAmmo - 1) * 6) / 2;
        ctx.arc(startX + i * 6, -30, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.rotate(this.angle);

    // Body
    ctx.shadowBlur = 20;
    ctx.shadowColor = this.color;
    ctx.fillStyle = '#000';
    ctx.fillRect(-15, -15, 30, 30);

    ctx.strokeStyle = this.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(-15, -15, 30, 30);

    // Weapon specific barrel
    ctx.fillStyle = this.color;
    if (this.currentWeapon === 'SHOTGUN') {
      ctx.fillRect(0, -8, 20, 16); // Wide barrel
    } else if (this.currentWeapon === 'LASER') {
      ctx.fillRect(0, -4, 30, 8); // Long thin barrel
    } else {
      ctx.fillRect(0, -6, 25, 12);
    }

    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = this.color;
    ctx.fillRect(-10, -18, 20, 4);
    ctx.fillRect(-10, 14, 20, 4);

    ctx.restore();
  }
}
