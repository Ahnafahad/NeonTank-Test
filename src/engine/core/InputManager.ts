// Input Manager - Unified keyboard and touch input handling
import { Vector } from '../utils/Vector';

export interface PlayerInput {
  movement: Vector;
  shoot: boolean;
  chargeLevel: number;
}

export class InputManager {
  private keyboardState: Map<string, boolean> = new Map();
  private touchState: Map<number, { x: number; y: number }> = new Map();

  // Virtual joystick data (for mobile)
  private joystickData: {
    player1: { movement: Vector; active: boolean };
    player2: { movement: Vector; active: boolean };
  } = {
    player1: { movement: Vector.zero(), active: false },
    player2: { movement: Vector.zero(), active: false },
  };

  // Shoot button state (for mobile)
  private shootButtonState: {
    player1: boolean;
    player2: boolean;
  } = {
    player1: false,
    player2: false,
  };

  constructor() {
    this.initKeyboard();
  }

  private initKeyboard(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('keydown', (e) => {
        this.keyboardState.set(e.code, true);

        // Prevent default for game keys
        if (
          ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.code)
        ) {
          e.preventDefault();
        }
      });

      window.addEventListener('keyup', (e) => {
        this.keyboardState.set(e.code, false);
      });
    }
  }

  // Keyboard methods
  isKeyPressed(code: string): boolean {
    return this.keyboardState.get(code) || false;
  }

  getKeyboardState(): { [key: string]: boolean } {
    const state: { [key: string]: boolean } = {};
    this.keyboardState.forEach((value, key) => {
      state[key] = value;
    });

    // Synthesize virtual key states from joystick input for Player 1 (WASD + Space)
    if (this.joystickData.player1.active) {
      const m = this.joystickData.player1.movement;
      const threshold = 0.3; // Deadzone threshold
      state['KeyW'] = m.y < -threshold;
      state['KeyS'] = m.y > threshold;
      state['KeyA'] = m.x < -threshold;
      state['KeyD'] = m.x > threshold;
    }
    if (this.shootButtonState.player1) {
      state['Space'] = true;
    }

    // Synthesize virtual key states from joystick input for Player 2 (Arrows + Enter)
    if (this.joystickData.player2.active) {
      const m = this.joystickData.player2.movement;
      const threshold = 0.3;
      state['ArrowUp'] = m.y < -threshold;
      state['ArrowDown'] = m.y > threshold;
      state['ArrowLeft'] = m.x < -threshold;
      state['ArrowRight'] = m.x > threshold;
    }
    if (this.shootButtonState.player2) {
      state['Enter'] = true;
    }

    return state;
  }

  // Mobile joystick methods
  setJoystickMovement(playerIndex: number, movement: Vector): void {
    if (playerIndex === 1) {
      this.joystickData.player1.movement = movement;
      this.joystickData.player1.active = true;
    } else if (playerIndex === 2) {
      this.joystickData.player2.movement = movement;
      this.joystickData.player2.active = true;
    }
  }

  resetJoystick(playerIndex: number): void {
    if (playerIndex === 1) {
      this.joystickData.player1.movement = Vector.zero();
      this.joystickData.player1.active = false;
    } else if (playerIndex === 2) {
      this.joystickData.player2.movement = Vector.zero();
      this.joystickData.player2.active = false;
    }
  }

  setShootButton(playerIndex: number, pressed: boolean): void {
    if (playerIndex === 1) {
      this.shootButtonState.player1 = pressed;
    } else if (playerIndex === 2) {
      this.shootButtonState.player2 = pressed;
    }
  }

  // Unified API - works for both keyboard and touch
  getMovementVector(playerIndex: number, controls: { up: string; down: string; left: string; right: string }): Vector {
    // Check if mobile joystick is active
    if (playerIndex === 1 && this.joystickData.player1.active) {
      return this.joystickData.player1.movement;
    }
    if (playerIndex === 2 && this.joystickData.player2.active) {
      return this.joystickData.player2.movement;
    }

    // Keyboard input
    let x = 0;
    let y = 0;

    if (this.isKeyPressed(controls.up)) y = -1;
    if (this.isKeyPressed(controls.down)) y = 1;
    if (this.isKeyPressed(controls.left)) x = -1;
    if (this.isKeyPressed(controls.right)) x = 1;

    if (x === 0 && y === 0) return Vector.zero();

    return new Vector(x, y).normalize();
  }

  isShootPressed(playerIndex: number, shootKey: string): boolean {
    // Check mobile shoot button
    if (playerIndex === 1 && this.shootButtonState.player1) return true;
    if (playerIndex === 2 && this.shootButtonState.player2) return true;

    // Keyboard
    return this.isKeyPressed(shootKey);
  }

  // Platform detection
  isMobile(): boolean {
    if (typeof window === 'undefined') return false;

    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || ('ontouchstart' in window);
  }

  getOrientation(): 'portrait' | 'landscape' {
    if (typeof window === 'undefined') return 'landscape';

    return window.innerHeight > window.innerWidth ? 'portrait' : 'landscape';
  }

  // Cleanup
  destroy(): void {
    this.keyboardState.clear();
    this.touchState.clear();
  }
}
