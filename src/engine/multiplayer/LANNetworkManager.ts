import { Logger } from '@/lib/logging/Logger';
import { LocalMultiplayerServer, LANGameState, LANMessage } from '../../lib/socket/localServer';
import { LocalMultiplayerClient } from '../../lib/socket/localClient';
import type { Tank } from '../entities/Tank';
import type { Bullet } from '../entities/Bullet';

export type LANRole = 'host' | 'guest';

export interface LANNetworkCallbacks {
  onStateUpdate?: (state: LANGameState) => void;
  onConnectionLost?: () => void;
  onInput?: (guestId: string, input: any) => void;
}

/**
 * LAN Network Manager - Optimized for local network play
 * Key differences from NetworkManager:
 * - No interpolation buffer (zero latency)
 * - No client-side prediction (not needed with <5ms latency)
 * - No delta compression (LAN bandwidth is abundant)
 * - 60 Hz tick rate (vs 30 Hz for online)
 */
export class LANNetworkManager {
  private role: LANRole;
  private server: LocalMultiplayerServer | null = null;
  private client: LocalMultiplayerClient | null = null;
  private callbacks: LANNetworkCallbacks = {};
  private assignedTankId: number;

  constructor(role: LANRole, serverOrClient: LocalMultiplayerServer | LocalMultiplayerClient) {
    this.role = role;
    this.assignedTankId = role === 'host' ? 1 : 2;

    if (role === 'host' && serverOrClient instanceof LocalMultiplayerServer) {
      this.server = serverOrClient;
      this.setupHostCallbacks();
    } else if (role === 'guest' && serverOrClient instanceof LocalMultiplayerClient) {
      this.client = serverOrClient;
      this.setupGuestCallbacks();
    } else {
      throw new Error('[LANNetworkManager] Invalid role/server/client combination');
    }
  }

  private setupHostCallbacks(): void {
    if (!this.server) return;

    this.server.onInput((guestId, input) => {
      // Forward input to game engine via callback
      Logger.debug('[LANNetworkManager] Received input from guest:', input);
      if (this.callbacks.onInput) {
        this.callbacks.onInput(guestId, input);
      }
    });

    this.server.onGuestLeft((guestId) => {
      Logger.debug('[LANNetworkManager] Guest disconnected:', guestId);
      if (this.callbacks.onConnectionLost) {
        this.callbacks.onConnectionLost();
      }
    });
  }

  private setupGuestCallbacks(): void {
    if (!this.client) return;

    this.client.onState((state) => {
      // Apply state directly to game (no interpolation for LAN)
      if (this.callbacks.onStateUpdate) {
        this.callbacks.onStateUpdate(state);
      }
    });

    this.client.onDisconnect(() => {
      Logger.debug('[LANNetworkManager] Disconnected from host');
      if (this.callbacks.onConnectionLost) {
        this.callbacks.onConnectionLost();
      }
    });
  }

  public setCallbacks(callbacks: LANNetworkCallbacks): void {
    this.callbacks = callbacks;
  }

  public getRole(): LANRole {
    return this.role;
  }

  public getAssignedTankId(): number {
    return this.assignedTankId;
  }

  public isHost(): boolean {
    return this.role === 'host';
  }

  public isGuest(): boolean {
    return this.role === 'guest';
  }

  /**
   * Send player input (guest only)
   */
  public sendInput(movement: { x: number; y: number }, shoot: boolean, chargeLevel: number): void {
    if (this.role !== 'guest' || !this.client) return;

    this.client.sendInput({
      movement,
      shoot,
      chargeLevel,
      timestamp: Date.now()
    });
  }

  /**
   * Broadcast game state (host only)
   */
  public broadcastGameState(tanks: Tank[], bullets: Bullet[]): void {
    if (this.role !== 'host' || !this.server) return;

    const state: LANGameState = {
      tanks: tanks.map(tank => ({
        id: tank.id.toString(),
        position: { x: tank.pos.x, y: tank.pos.y },
        velocity: { x: 0, y: 0 }, // Tanks don't store velocity directly
        rotation: tank.angle,
        health: tank.health
      })),
      bullets: bullets.map(bullet => ({
        id: bullet.id.toString(),
        position: { x: bullet.pos.x, y: bullet.pos.y },
        velocity: { x: bullet.vel.x, y: bullet.vel.y },
        ownerId: bullet.ownerId.toString()
      })),
      powerups: [], // TODO: Add power-ups if needed
      timestamp: Date.now()
    };

    this.server.broadcastGameState(state);
  }

  /**
   * Start game loop (host only)
   */
  public startGameLoop(updateCallback: () => LANGameState): void {
    if (this.role !== 'host' || !this.server) {
      console.warn('[LANNetworkManager] startGameLoop called on non-host');
      return;
    }

    this.server.startGameLoop(updateCallback);
  }

  /**
   * Get average latency (for display purposes)
   */
  public getLatency(): number {
    if (this.role === 'guest' && this.client) {
      return this.client.getAverageLatency();
    }
    return 0;
  }

  /**
   * Disconnect and cleanup
   */
  public disconnect(): void {
    if (this.server) {
      this.server.destroy();
      this.server = null;
    }

    if (this.client) {
      this.client.destroy();
      this.client = null;
    }
  }

  /**
   * Check if connected
   */
  public isConnected(): boolean {
    if (this.role === 'host') {
      return this.server !== null;
    } else {
      return this.client !== null && this.client.isConnected();
    }
  }
}

// Singleton instance for LAN network manager
let lanNetworkManagerInstance: LANNetworkManager | null = null;

export function createLANNetworkManager(
  role: LANRole,
  serverOrClient: LocalMultiplayerServer | LocalMultiplayerClient
): LANNetworkManager {
  // Clean up existing instance
  if (lanNetworkManagerInstance) {
    lanNetworkManagerInstance.disconnect();
  }

  lanNetworkManagerInstance = new LANNetworkManager(role, serverOrClient);
  return lanNetworkManagerInstance;
}

export function getLANNetworkManager(): LANNetworkManager | null {
  return lanNetworkManagerInstance;
}

export function destroyLANNetworkManager(): void {
  if (lanNetworkManagerInstance) {
    lanNetworkManagerInstance.disconnect();
    lanNetworkManagerInstance = null;
  }
}
