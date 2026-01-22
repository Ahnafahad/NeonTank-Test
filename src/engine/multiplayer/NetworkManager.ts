// NetworkManager - Client-side multiplayer network handler
import { io, Socket } from 'socket.io-client';
import {
    ClientToServerEvents,
    ServerToClientEvents,
    PlayerInput,
    GameStateSnapshot,
    SessionInfo,
    PlayerInfo,
} from '@/lib/socket/events';

export type NetworkSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

export type NetworkStatus = 'disconnected' | 'connecting' | 'connected' | 'matchmaking' | 'matched' | 'in_game' | 'error';

export interface NetworkCallbacks {
    onStatusChange: (status: NetworkStatus) => void;
    onGameState: (state: GameStateSnapshot) => void;
    onMatchFound: (opponent: PlayerInfo, tankId: number) => void;
    onPlayerJoined: (player: PlayerInfo) => void;
    onPlayerLeft: (playerId: string, reason: string) => void;
    onGameOver: (winner: number, scores: { p1: number; p2: number }) => void;
    onCountdown: (countdown: number) => void;
    onRoundStart: (roundNumber: number) => void;
    onRoundOver: (roundNumber: number, winner: number, scores: { p1: number; p2: number }) => void;
    onError: (code: string, message: string) => void;
    onLatencyUpdate: (latency: number) => void;
}

export class NetworkManager {
    private socket: NetworkSocket | null = null;
    private callbacks: Partial<NetworkCallbacks> = {};
    private status: NetworkStatus = 'disconnected';

    // Player info
    private playerId: string;
    private playerName: string;
    private sessionId: string | null = null;
    private assignedTankId: number | null = null;

    // Input tracking
    private inputSequence: number = 0;
    private pendingInputs: PlayerInput[] = [];

    // Latency tracking
    private latency: number = 0;
    private latencyPingInterval: NodeJS.Timeout | null = null;

    constructor(playerId?: string, playerName?: string) {
        this.playerId = playerId || this.generatePlayerId();
        this.playerName = playerName || `Player_${this.playerId.substring(0, 6)}`;
    }

    private generatePlayerId(): string {
        return 'p_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
    }

    public setCallbacks(callbacks: Partial<NetworkCallbacks>): void {
        this.callbacks = { ...this.callbacks, ...callbacks };
    }

    public getStatus(): NetworkStatus {
        return this.status;
    }

    public getPlayerId(): string {
        return this.playerId;
    }

    public getPlayerName(): string {
        return this.playerName;
    }

    public setPlayerName(name: string): void {
        this.playerName = name;
    }

    public getSessionId(): string | null {
        return this.sessionId;
    }

    public getAssignedTankId(): number | null {
        return this.assignedTankId;
    }

    public getLatency(): number {
        return this.latency;
    }

    private setStatus(status: NetworkStatus): void {
        this.status = status;
        this.callbacks.onStatusChange?.(status);
    }

    // ============================================================================
    // Connection
    // ============================================================================

    public connect(serverUrl?: string): Promise<void> {
        return new Promise((resolve, reject) => {
            if (this.socket?.connected) {
                resolve();
                return;
            }

            this.setStatus('connecting');

            const url = serverUrl ||
                process.env.NEXT_PUBLIC_SOCKET_URL ||
                (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');

            this.socket = io(url, {
                transports: ['websocket', 'polling'],
                reconnection: true,
                reconnectionAttempts: 5,
                reconnectionDelay: 1000,
                timeout: 10000,
            });

            this.socket.on('connect', () => {
                console.log('[NetworkManager] Connected to server');
                this.setStatus('connected');
                this.startLatencyPing();
                resolve();
            });

            this.socket.on('disconnect', (reason) => {
                console.log('[NetworkManager] Disconnected:', reason);
                this.setStatus('disconnected');
                this.stopLatencyPing();
            });

            this.socket.on('connect_error', (error) => {
                console.error('[NetworkManager] Connection error:', error);
                this.setStatus('error');
                this.callbacks.onError?.('CONNECTION_ERROR', error.message);
                reject(error);
            });

            // Register event handlers
            this.registerEventHandlers();
        });
    }

    public disconnect(): void {
        if (this.socket) {
            if (this.sessionId) {
                this.socket.emit('leave_game', {
                    sessionId: this.sessionId,
                    playerId: this.playerId,
                    reason: 'quit',
                });
            }

            this.socket.disconnect();
            this.socket = null;
        }

        this.stopLatencyPing();
        this.sessionId = null;
        this.assignedTankId = null;
        this.setStatus('disconnected');
    }

    private registerEventHandlers(): void {
        if (!this.socket) return;

        // Game state updates (30Hz from server)
        this.socket.on('game_state', (payload) => {
            this.callbacks.onGameState?.(payload.state);

            // Reconcile pending inputs
            if (payload.state.lastProcessedInput[this.playerId]) {
                const lastProcessed = payload.state.lastProcessedInput[this.playerId];
                this.pendingInputs = this.pendingInputs.filter(
                    (input) => input.sequenceNumber > lastProcessed
                );
            }
        });

        this.socket.on('match_found', (payload) => {
            this.sessionId = payload.sessionId;
            this.assignedTankId = payload.assignedTankId;
            this.setStatus('matched');
            this.callbacks.onMatchFound?.(payload.opponent, payload.assignedTankId);
        });

        this.socket.on('player_joined', (payload) => {
            this.callbacks.onPlayerJoined?.(payload.player);
        });

        this.socket.on('player_left', (payload) => {
            this.callbacks.onPlayerLeft?.(payload.playerId, payload.reason);
        });

        this.socket.on('game_over', (payload) => {
            this.setStatus('connected');
            this.callbacks.onGameOver?.(payload.winner, payload.finalScores);
        });

        this.socket.on('countdown', (payload) => {
            this.callbacks.onCountdown?.(payload.countdown);
        });

        this.socket.on('round_start', (payload) => {
            this.setStatus('in_game');
            this.callbacks.onRoundStart?.(payload.roundNumber);
        });

        this.socket.on('round_over', (payload) => {
            this.callbacks.onRoundOver?.(payload.roundNumber, payload.winner, payload.scores);
        });

        this.socket.on('error', (payload) => {
            this.callbacks.onError?.(payload.code, payload.message);
        });
    }

    // ============================================================================
    // Matchmaking
    // ============================================================================

    public async findMatch(): Promise<SessionInfo> {
        if (!this.socket?.connected) {
            await this.connect();
        }

        this.setStatus('matchmaking');

        // Generate a matchmaking session ID
        const sessionId = 'match_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 8);

        return this.joinSession(sessionId);
    }

    public async joinSession(sessionId: string): Promise<SessionInfo> {
        return new Promise((resolve, reject) => {
            if (!this.socket?.connected) {
                reject(new Error('Not connected to server'));
                return;
            }

            this.socket.emit('join_game', {
                sessionId,
                playerId: this.playerId,
                playerName: this.playerName,
            }, (response) => {
                if (response.success && response.session) {
                    this.sessionId = sessionId;
                    this.assignedTankId = response.assignedTankId || null;

                    if (response.session.players.length === 2) {
                        this.setStatus('matched');
                    } else {
                        this.setStatus('matchmaking');
                    }

                    resolve(response.session);
                } else {
                    this.setStatus('error');
                    reject(new Error(response.error || 'Failed to join session'));
                }
            });
        });
    }

    public leaveMatch(): void {
        if (this.socket && this.sessionId) {
            this.socket.emit('leave_game', {
                sessionId: this.sessionId,
                playerId: this.playerId,
                reason: 'quit',
            });

            this.sessionId = null;
            this.assignedTankId = null;
            this.setStatus('connected');
        }
    }

    // ============================================================================
    // Input Sending
    // ============================================================================

    public sendInput(movement: { x: number; y: number }, shoot: boolean, chargeLevel: number = 0): void {
        if (!this.socket?.connected || !this.sessionId) return;

        const input: PlayerInput = {
            movement,
            shoot,
            chargeLevel,
            sequenceNumber: ++this.inputSequence,
            timestamp: Date.now(),
        };

        this.pendingInputs.push(input);

        this.socket.emit('player_input', {
            sessionId: this.sessionId,
            playerId: this.playerId,
            input,
        });
    }

    public getPendingInputs(): PlayerInput[] {
        return this.pendingInputs;
    }

    // ============================================================================
    // Latency Monitoring
    // ============================================================================

    private startLatencyPing(): void {
        this.stopLatencyPing();

        this.latencyPingInterval = setInterval(() => {
            if (this.socket?.connected) {
                const start = Date.now();
                this.socket.emit('ping', start, (serverTime) => {
                    this.latency = Math.round((Date.now() - start) / 2);
                    this.callbacks.onLatencyUpdate?.(this.latency);
                });
            }
        }, 2000);
    }

    private stopLatencyPing(): void {
        if (this.latencyPingInterval) {
            clearInterval(this.latencyPingInterval);
            this.latencyPingInterval = null;
        }
    }

    // ============================================================================
    // Utility
    // ============================================================================

    public isConnected(): boolean {
        return this.socket?.connected || false;
    }

    public isInGame(): boolean {
        return this.status === 'in_game';
    }

    public isMatched(): boolean {
        return this.status === 'matched' || this.status === 'in_game';
    }
}

// Singleton instance for global access
let networkManagerInstance: NetworkManager | null = null;

export function getNetworkManager(): NetworkManager {
    if (!networkManagerInstance) {
        networkManagerInstance = new NetworkManager();
    }
    return networkManagerInstance;
}

export function resetNetworkManager(): void {
    if (networkManagerInstance) {
        networkManagerInstance.disconnect();
        networkManagerInstance = null;
    }
}
