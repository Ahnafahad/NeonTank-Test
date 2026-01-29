import Peer, { DataConnection } from 'peerjs';

export interface LANGameState {
  tanks: Array<{
    id: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    rotation: number;
    health: number;
  }>;
  bullets: Array<{
    id: string;
    position: { x: number; y: number };
    velocity: { x: number; y: number };
    ownerId: string;
  }>;
  powerups: Array<{
    id: string;
    position: { x: number; y: number };
    type: string;
  }>;
  timestamp: number;
}

export interface LANMessage {
  type: 'input' | 'state' | 'ping' | 'pong' | 'init' | 'start' | 'disconnect';
  data?: any;
  timestamp?: number;
}

export class LocalMultiplayerServer {
  private peer: Peer | null = null;
  private connections: Map<string, DataConnection> = new Map();
  private roomCode: string;
  private gameLoop: number | null = null;
  private tickRate = 60; // 60 Hz for LAN
  private lastTickTime = 0;
  private onStateUpdate?: (state: LANGameState) => void;
  private onGuestJoin?: (guestId: string) => void;
  private onGuestLeave?: (guestId: string) => void;
  private onInputReceived?: (guestId: string, input: any) => void;

  constructor() {
    this.roomCode = this.generateRoomCode();
  }

  private generateRoomCode(): string {
    // Generate 6-digit room code
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  getRoomCode(): string {
    return this.roomCode;
  }

  async startHosting(): Promise<void> {
    return new Promise((resolve, reject) => {
      // Timeout for server initialization
      const initTimeout = setTimeout(() => {
        console.error('[LAN Server] Server initialization timeout');
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }
        reject(new Error('Failed to initialize server. Please try again.'));
      }, 15000);

      try {
        // Create peer with room code as ID
        this.peer = new Peer(this.roomCode, {
          debug: 2, // Enable debug logging
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
              { urls: 'stun:stun2.l.google.com:19302' },
              { urls: 'stun:stun3.l.google.com:19302' },
              { urls: 'stun:stun4.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          clearTimeout(initTimeout);
          console.log(`[LAN Server] ✅ Successfully hosting with room code: ${id}`);
          console.log(`[LAN Server] Share this code with your opponent: ${id}`);
          resolve();
        });

        this.peer.on('connection', (conn) => {
          console.log(`[LAN Server] 🔗 Incoming connection from: ${conn.peer}`);
          this.handleGuestConnection(conn);
        });

        this.peer.on('error', (error) => {
          clearTimeout(initTimeout);
          console.error('[LAN Server] Peer error:', error);

          let errorMessage = 'Server error occurred';
          if (error.type === 'unavailable-id') {
            errorMessage = 'Room code already in use. Please try again.';
            // Generate new room code
            this.roomCode = this.generateRoomCode();
          } else if (error.type === 'network') {
            errorMessage = 'Network error. Please check your connection.';
          } else if (error.type === 'server-error') {
            errorMessage = 'PeerJS server error. Please try again later.';
          }

          reject(new Error(errorMessage));
        });

        this.peer.on('disconnected', () => {
          console.log('[LAN Server] Peer disconnected from signaling server');
          // Try to reconnect to signaling server
          if (this.peer && !this.peer.destroyed) {
            console.log('[LAN Server] Attempting to reconnect to signaling server...');
            this.peer.reconnect();
          }
        });
      } catch (error) {
        clearTimeout(initTimeout);
        reject(error);
      }
    });
  }

  private handleGuestConnection(conn: DataConnection): void {
    console.log(`[LAN Server] 👤 Guest attempting to connect: ${conn.peer}`);

    // Set timeout for connection establishment
    const connectionTimeout = setTimeout(() => {
      if (!conn.open) {
        console.error(`[LAN Server] ⏱️ Connection timeout for guest: ${conn.peer}`);
        conn.close();
      }
    }, 15000);

    conn.on('open', () => {
      clearTimeout(connectionTimeout);
      console.log(`[LAN Server] ✅ Guest successfully connected: ${conn.peer}`);
      this.connections.set(conn.peer, conn);

      // Send initialization message
      this.sendToGuest(conn.peer, {
        type: 'init',
        data: {
          roomCode: this.roomCode,
          hostId: this.peer?.id,
          timestamp: Date.now()
        }
      });

      if (this.onGuestJoin) {
        this.onGuestJoin(conn.peer);
      }
    });

    conn.on('data', (data) => {
      this.handleGuestMessage(conn.peer, data as LANMessage);
    });

    conn.on('close', () => {
      clearTimeout(connectionTimeout);
      console.log(`[LAN Server] 👋 Guest disconnected: ${conn.peer}`);
      this.connections.delete(conn.peer);
      if (this.onGuestLeave) {
        this.onGuestLeave(conn.peer);
      }
    });

    conn.on('error', (error) => {
      clearTimeout(connectionTimeout);
      console.error(`[LAN Server] ❌ Connection error with ${conn.peer}:`, error);
      this.connections.delete(conn.peer);
    });
  }

  private handleGuestMessage(guestId: string, message: LANMessage): void {
    switch (message.type) {
      case 'input':
        if (this.onInputReceived) {
          this.onInputReceived(guestId, message.data);
        }
        break;

      case 'ping':
        // Respond with pong
        this.sendToGuest(guestId, {
          type: 'pong',
          timestamp: message.timestamp
        });
        break;

      default:
        console.warn(`[LAN Server] Unknown message type: ${message.type}`);
    }
  }

  private sendToGuest(guestId: string, message: LANMessage): void {
    const conn = this.connections.get(guestId);
    if (conn && conn.open) {
      try {
        conn.send(message);
      } catch (error) {
        console.error(`[LAN Server] Error sending to guest ${guestId}:`, error);
      }
    }
  }

  broadcast(message: LANMessage): void {
    this.connections.forEach((conn, guestId) => {
      this.sendToGuest(guestId, message);
    });
  }

  broadcastGameState(state: LANGameState): void {
    this.broadcast({
      type: 'state',
      data: state,
      timestamp: Date.now()
    });
  }

  startGameLoop(updateCallback: () => LANGameState): void {
    const tickInterval = 1000 / this.tickRate;
    this.lastTickTime = Date.now();

    const tick = () => {
      const now = Date.now();
      const delta = now - this.lastTickTime;

      if (delta >= tickInterval) {
        this.lastTickTime = now;

        // Get updated game state from callback
        const state = updateCallback();

        // Broadcast to all guests
        this.broadcastGameState(state);
      }

      this.gameLoop = requestAnimationFrame(tick);
    };

    tick();
  }

  stopGameLoop(): void {
    if (this.gameLoop !== null) {
      cancelAnimationFrame(this.gameLoop);
      this.gameLoop = null;
    }
  }

  getConnectedGuests(): string[] {
    return Array.from(this.connections.keys());
  }

  isGuestConnected(guestId: string): boolean {
    const conn = this.connections.get(guestId);
    return conn !== undefined && conn.open;
  }

  onGuestJoined(callback: (guestId: string) => void): void {
    this.onGuestJoin = callback;
  }

  onGuestLeft(callback: (guestId: string) => void): void {
    this.onGuestLeave = callback;
  }

  onInput(callback: (guestId: string, input: any) => void): void {
    this.onInputReceived = callback;
  }

  destroy(): void {
    console.log('[LAN Server] Shutting down');

    // Stop game loop
    this.stopGameLoop();

    // Close all connections
    this.connections.forEach((conn) => {
      conn.close();
    });
    this.connections.clear();

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
