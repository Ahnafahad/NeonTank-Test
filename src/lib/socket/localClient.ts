import Peer, { DataConnection } from 'peerjs';
import { LANMessage, LANGameState } from './localServer';

export class LocalMultiplayerClient {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private roomCode: string = '';
  private hostId: string = '';
  private onStateReceived?: (state: LANGameState) => void;
  private onConnected?: () => void;
  private onDisconnected?: () => void;
  private onError?: (error: Error) => void;
  private latencyMeasurements: number[] = [];

  async connect(roomCode: string): Promise<void> {
    this.roomCode = roomCode;

    return new Promise((resolve, reject) => {
      try {
        // Create peer client
        this.peer = new Peer({
          config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' }
            ]
          }
        });

        this.peer.on('open', (id) => {
          console.log(`[LAN Client] Peer initialized with ID: ${id}`);

          // Connect to host using room code
          this.connection = this.peer!.connect(roomCode, {
            reliable: true
          });

          this.setupConnection(resolve, reject);
        });

        this.peer.on('error', (error) => {
          console.error('[LAN Client] Peer error:', error);
          if (this.onError) {
            this.onError(error as Error);
          }
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  private setupConnection(resolve: () => void, reject: (error: any) => void): void {
    if (!this.connection) return;

    this.connection.on('open', () => {
      console.log(`[LAN Client] Connected to host: ${this.roomCode}`);

      if (this.onConnected) {
        this.onConnected();
      }

      resolve();

      // Start latency measurement
      this.startLatencyMonitoring();
    });

    this.connection.on('data', (data) => {
      this.handleMessage(data as LANMessage);
    });

    this.connection.on('close', () => {
      console.log('[LAN Client] Connection closed');
      if (this.onDisconnected) {
        this.onDisconnected();
      }
    });

    this.connection.on('error', (error) => {
      console.error('[LAN Client] Connection error:', error);
      if (this.onError) {
        this.onError(error as Error);
      }
      reject(error);
    });
  }

  private handleMessage(message: LANMessage): void {
    switch (message.type) {
      case 'init':
        this.hostId = message.data.hostId;
        console.log(`[LAN Client] Initialized with host: ${this.hostId}`);
        break;

      case 'state':
        if (this.onStateReceived) {
          this.onStateReceived(message.data);
        }
        break;

      case 'pong':
        // Calculate latency
        if (message.timestamp) {
          const latency = Date.now() - message.timestamp;
          this.latencyMeasurements.push(latency);

          // Keep only last 10 measurements
          if (this.latencyMeasurements.length > 10) {
            this.latencyMeasurements.shift();
          }

          console.log(`[LAN Client] Latency: ${latency}ms`);
        }
        break;

      case 'start':
        console.log('[LAN Client] Game starting');
        break;

      default:
        console.warn(`[LAN Client] Unknown message type: ${message.type}`);
    }
  }

  sendInput(input: any): void {
    if (this.connection && this.connection.open) {
      this.send({
        type: 'input',
        data: input,
        timestamp: Date.now()
      });
    }
  }

  private send(message: LANMessage): void {
    if (this.connection && this.connection.open) {
      try {
        this.connection.send(message);
      } catch (error) {
        console.error('[LAN Client] Error sending message:', error);
      }
    }
  }

  private startLatencyMonitoring(): void {
    // Send ping every 2 seconds
    const pingInterval = setInterval(() => {
      if (!this.connection || !this.connection.open) {
        clearInterval(pingInterval);
        return;
      }

      this.send({
        type: 'ping',
        timestamp: Date.now()
      });
    }, 2000);
  }

  getAverageLatency(): number {
    if (this.latencyMeasurements.length === 0) return 0;

    const sum = this.latencyMeasurements.reduce((a, b) => a + b, 0);
    return Math.round(sum / this.latencyMeasurements.length);
  }

  isConnected(): boolean {
    return this.connection !== null && this.connection.open;
  }

  getHostId(): string {
    return this.hostId;
  }

  onState(callback: (state: LANGameState) => void): void {
    this.onStateReceived = callback;
  }

  onConnect(callback: () => void): void {
    this.onConnected = callback;
  }

  onDisconnect(callback: () => void): void {
    this.onDisconnected = callback;
  }

  onErrorReceived(callback: (error: Error) => void): void {
    this.onError = callback;
  }

  destroy(): void {
    console.log('[LAN Client] Shutting down');

    // Close connection
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }

    // Destroy peer
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
