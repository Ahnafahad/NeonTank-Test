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
      // Set connection timeout
      const connectionTimeout = setTimeout(() => {
        console.error('[LAN Client] Connection timeout after 30 seconds');
        if (this.peer) {
          this.peer.destroy();
          this.peer = null;
        }
        reject(new Error('Connection timeout. Make sure you are on the same network as the host.'));
      }, 30000);

      try {
        // Create peer client with explicit configuration
        this.peer = new Peer({
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
          console.log(`[LAN Client] Peer initialized with ID: ${id}`);
          console.log(`[LAN Client] Attempting to connect to host: ${roomCode}`);

          // Connect to host using room code
          this.connection = this.peer!.connect(roomCode, {
            reliable: true,
            serialization: 'json'
          });

          if (!this.connection) {
            clearTimeout(connectionTimeout);
            reject(new Error('Failed to create connection to host'));
            return;
          }

          this.setupConnection(resolve, reject, connectionTimeout);
        });

        this.peer.on('error', (error) => {
          clearTimeout(connectionTimeout);
          console.error('[LAN Client] Peer error:', error);

          let errorMessage = 'Failed to connect to host';
          if (error.type === 'peer-unavailable') {
            errorMessage = 'Host not found. Please check the room code.';
          } else if (error.type === 'network') {
            errorMessage = 'Network error. Please check your connection.';
          } else if (error.type === 'server-error') {
            errorMessage = 'PeerJS server error. Please try again later.';
          }

          if (this.onError) {
            this.onError(new Error(errorMessage));
          }
          reject(new Error(errorMessage));
        });

        this.peer.on('disconnected', () => {
          console.log('[LAN Client] Peer disconnected from signaling server');
          // Try to reconnect to signaling server
          if (this.peer && !this.peer.destroyed) {
            console.log('[LAN Client] Attempting to reconnect to signaling server...');
            this.peer.reconnect();
          }
        });
      } catch (error) {
        clearTimeout(connectionTimeout);
        reject(error);
      }
    });
  }

  private setupConnection(resolve: () => void, reject: (error: any) => void, timeoutId: NodeJS.Timeout): void {
    if (!this.connection) {
      clearTimeout(timeoutId);
      reject(new Error('Connection object not initialized'));
      return;
    }

    // Add timeout for the connection establishment
    const connectionEstablishTimeout = setTimeout(() => {
      console.error('[LAN Client] Connection establishment timeout');
      if (this.connection && this.connection.open === false) {
        reject(new Error('Failed to establish connection to host. Please try again.'));
      }
    }, 15000); // 15 second timeout for connection to open

    this.connection.on('open', () => {
      clearTimeout(timeoutId);
      clearTimeout(connectionEstablishTimeout);
      console.log(`[LAN Client] ✅ Successfully connected to host: ${this.roomCode}`);

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
      clearTimeout(connectionEstablishTimeout);
      console.log('[LAN Client] Connection closed');
      if (this.onDisconnected) {
        this.onDisconnected();
      }
    });

    this.connection.on('error', (error) => {
      clearTimeout(timeoutId);
      clearTimeout(connectionEstablishTimeout);
      console.error('[LAN Client] Connection error:', error);

      const errorMessage = 'Connection failed. Please check your network and try again.';
      if (this.onError) {
        this.onError(new Error(errorMessage));
      }
      reject(new Error(errorMessage));
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
