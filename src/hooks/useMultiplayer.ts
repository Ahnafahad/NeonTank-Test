'use client';

import { Logger } from '@/lib/logging/Logger';
import { useEffect, useCallback, useRef } from 'react';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { NetworkManager, NetworkStatus, getNetworkManager } from '@/engine/multiplayer/NetworkManager';

export function useMultiplayer() {
    const networkManagerRef = useRef<NetworkManager | null>(null);

    const {
        connectionStatus,
        sessionId,
        playerId,
        playerName,
        opponentId,
        opponentName,
        assignedTankId,
        countdown,
        roundNumber,
        latency,
        queuePosition,
        error,
        gameState,
        setConnectionStatus,
        setSessionInfo,
        setPlayerName,
        setOpponent,
        setAssignedTankId,
        setCountdown,
        setRoundNumber,
        setLatency,
        setQueuePosition,
        setError,
        setGameState,
        reset,
    } = useMultiplayerStore();

    // Initialize NetworkManager
    useEffect(() => {
        if (!networkManagerRef.current) {
            networkManagerRef.current = getNetworkManager();

            // Set up callbacks
            networkManagerRef.current.setCallbacks({
                onStatusChange: (status: NetworkStatus) => {
                    Logger.debug('[useMultiplayer] Status changed:', status);
                    // Map network status to store status
                    const storeStatus = status as typeof connectionStatus;
                    setConnectionStatus(storeStatus);
                },
                onGameState: (state) => {
                    setGameState(state);
                },
                onMatchFound: (opponent, tankId) => {
                    Logger.debug('[useMultiplayer] Match found callback:', opponent, tankId);
                    setOpponent(opponent.id, opponent.name);
                    setAssignedTankId(tankId);
                    setCountdown(3); // Start countdown
                },
                onPlayerJoined: (player) => {
                    Logger.debug('[useMultiplayer] Player joined callback:', player);
                    if (player.id !== networkManagerRef.current?.getPlayerId()) {
                        Logger.debug('[useMultiplayer] Setting as opponent');
                        setOpponent(player.id, player.name);
                    }
                },
                onPlayerLeft: (leftPlayerId, reason) => {
                    if (leftPlayerId === opponentId) {
                        setError(`Opponent ${reason === 'disconnect' ? 'disconnected' : 'left'}`);
                    }
                },
                onGameOver: (winner, scores) => {
                    // Will be handled by game component
                },
                onCountdown: (count) => {
                    setCountdown(count);
                },
                onRoundStart: (round) => {
                    setRoundNumber(round);
                    setCountdown(null);
                },
                onRoundOver: (round, winner, scores) => {
                    // Update round info
                },
                onError: (code, message) => {
                    setError(`${code}: ${message}`);
                },
                onLatencyUpdate: (ms) => {
                    setLatency(ms);
                },
            });
        }

        return () => {
            // Cleanup on unmount - just remove callbacks, don't disconnect!
            if (networkManagerRef.current) {
                networkManagerRef.current.clearCallbacks();
            }
            networkManagerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Connect to server
    const connect = useCallback(async () => {
        if (!networkManagerRef.current) return;

        try {
            Logger.debug('[useMultiplayer] Connecting to server...');
            await networkManagerRef.current.connect();
            Logger.debug('[useMultiplayer] Connected! Player ID:', networkManagerRef.current.getPlayerId());
            if (networkManagerRef.current.getPlayerId()) {
                setSessionInfo('', networkManagerRef.current.getPlayerId());
            }
        } catch (err) {
            console.error('[useMultiplayer] Connection failed:', err);

            // Provide specific error messages
            let errorMessage = 'Failed to connect to server';
            if (err instanceof Error) {
                if (err.message.includes('timeout')) {
                    errorMessage = 'Connection timed out. Please check if the online server is running and try again.';
                } else if (err.message.includes('ECONNREFUSED')) {
                    errorMessage = 'Server is not available. Online mode requires a backend server (see deployment docs).';
                } else {
                    errorMessage = err.message;
                }
            }

            setError(errorMessage);
        }
    }, [setSessionInfo, setError]);

    // Disconnect from server
    const disconnect = useCallback(() => {
        networkManagerRef.current?.disconnect();
        reset();
    }, [reset]);

    // Start matchmaking
    const findMatch = useCallback(async (gameSettings?: { scoreLimitValue: number; timeLimitEnabled: boolean; timeLimitSeconds: number }) => {
        if (!networkManagerRef.current) return;

        try {
            Logger.debug('[useMultiplayer] Starting matchmaking...');
            setConnectionStatus('matchmaking');
            setQueuePosition(1);

            const session = await networkManagerRef.current.findMatch(gameSettings);
            Logger.debug('[useMultiplayer] Matchmaking result:', session);
            setSessionInfo(session.sessionId, networkManagerRef.current.getPlayerId());

            if (session.players.length === 2) {
                Logger.debug('[useMultiplayer] Match found with 2 players!');
                const opponent = session.players.find(
                    (p) => p.id !== networkManagerRef.current?.getPlayerId()
                );
                if (opponent) {
                    Logger.debug('[useMultiplayer] Opponent:', opponent);
                    setOpponent(opponent.id, opponent.name);
                }
            } else {
                Logger.debug('[useMultiplayer] Waiting for opponent... Players:', session.players.length);
            }
        } catch (err) {
            console.error('[useMultiplayer] Matchmaking failed:', err);

            let errorMessage = 'Failed to find match';
            if (err instanceof Error) {
                if (err.message.includes('timeout')) {
                    errorMessage = 'Matchmaking timed out. The server may be unavailable.';
                } else {
                    errorMessage = err.message || 'Failed to find match';
                }
            }

            setError(errorMessage);
        }
    }, [setConnectionStatus, setQueuePosition, setSessionInfo, setOpponent, setError]);

    // Join specific session
    const joinSession = useCallback(async (
        sessionId: string,
        gameSettings?: { scoreLimitValue: number; timeLimitEnabled: boolean; timeLimitSeconds: number }
    ) => {
        if (!networkManagerRef.current) return;

        try {
            Logger.debug('[useMultiplayer] Joining session:', sessionId, 'with settings:', gameSettings);
            setConnectionStatus('matchmaking');

            const session = await networkManagerRef.current.joinSession(sessionId, gameSettings);
            Logger.debug('[useMultiplayer] Joined session:', session);
            setSessionInfo(session.sessionId, networkManagerRef.current.getPlayerId());

            if (session.players.length === 2) {
                Logger.debug('[useMultiplayer] Session has 2 players!');
                const opponent = session.players.find(
                    (p) => p.id !== networkManagerRef.current?.getPlayerId()
                );
                if (opponent) {
                    Logger.debug('[useMultiplayer] Opponent found:', opponent);
                    setOpponent(opponent.id, opponent.name);
                }
            } else {
                Logger.debug('[useMultiplayer] Waiting for opponent in session... Players:', session.players.length);
            }
        } catch (err: any) {
            console.error('[useMultiplayer] Failed to join session:', err);
            setError(err.message || 'Failed to join session');
        }
    }, [setConnectionStatus, setSessionInfo, setOpponent, setError]);

    // Cancel matchmaking
    const cancelMatch = useCallback(() => {
        networkManagerRef.current?.leaveMatch();
        setConnectionStatus('connected');
        setQueuePosition(null);
    }, [setConnectionStatus, setQueuePosition]);

    // Send player input
    const sendInput = useCallback((movement: { x: number; y: number }, shoot: boolean, chargeLevel: number = 0) => {
        networkManagerRef.current?.sendInput(movement, shoot, chargeLevel);
    }, []);

    // Update player name
    const updatePlayerName = useCallback((name: string) => {
        networkManagerRef.current?.setPlayerName(name);
        setPlayerName(name);
    }, [setPlayerName]);

    return {
        // State
        connectionStatus,
        sessionId,
        playerId,
        playerName,
        opponentId,
        opponentName,
        assignedTankId,
        countdown,
        roundNumber,
        latency,
        queuePosition,
        error,
        gameState,

        // Actions
        connect,
        disconnect,
        findMatch,
        joinSession,
        cancelMatch,
        sendInput,
        updatePlayerName,
        reset,

        // Helper flags
        isConnected: connectionStatus === 'connected' || connectionStatus === 'matchmaking' || connectionStatus === 'matched' || connectionStatus === 'in_game',
        isMatchmaking: connectionStatus === 'matchmaking',
        isMatched: connectionStatus === 'matched',
        isInGame: connectionStatus === 'in_game',
        hasError: connectionStatus === 'error' || error !== null,
    };
}
