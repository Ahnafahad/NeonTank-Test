'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useMultiplayerStore } from '@/store/useMultiplayerStore';
import { NetworkManager, NetworkStatus } from '@/engine/multiplayer/NetworkManager';

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
            networkManagerRef.current = new NetworkManager();

            // Set up callbacks
            networkManagerRef.current.setCallbacks({
                onStatusChange: (status: NetworkStatus) => {
                    // Map network status to store status
                    const storeStatus = status as typeof connectionStatus;
                    setConnectionStatus(storeStatus);
                },
                onGameState: (state) => {
                    setGameState(state);
                },
                onMatchFound: (opponent, tankId) => {
                    setOpponent(opponent.id, opponent.name);
                    setAssignedTankId(tankId);
                    setCountdown(3); // Start countdown
                },
                onPlayerJoined: (player) => {
                    if (player.id !== networkManagerRef.current?.getPlayerId()) {
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
            // Cleanup on unmount
            networkManagerRef.current?.disconnect();
            networkManagerRef.current = null;
        };
    }, [setConnectionStatus, setGameState, setOpponent, setAssignedTankId, setCountdown, setRoundNumber, setError, setLatency, opponentId]);

    // Connect to server
    const connect = useCallback(async () => {
        if (!networkManagerRef.current) return;

        try {
            await networkManagerRef.current.connect();
            if (networkManagerRef.current.getPlayerId()) {
                setSessionInfo('', networkManagerRef.current.getPlayerId());
            }
        } catch (err) {
            setError('Failed to connect to server');
        }
    }, [setSessionInfo, setError]);

    // Disconnect from server
    const disconnect = useCallback(() => {
        networkManagerRef.current?.disconnect();
        reset();
    }, [reset]);

    // Start matchmaking
    const findMatch = useCallback(async () => {
        if (!networkManagerRef.current) return;

        try {
            setConnectionStatus('matchmaking');
            setQueuePosition(1);

            const session = await networkManagerRef.current.findMatch();
            setSessionInfo(session.sessionId, networkManagerRef.current.getPlayerId());

            if (session.players.length === 2) {
                const opponent = session.players.find(
                    (p) => p.id !== networkManagerRef.current?.getPlayerId()
                );
                if (opponent) {
                    setOpponent(opponent.id, opponent.name);
                }
            }
        } catch (err) {
            setError('Failed to find match');
        }
    }, [setConnectionStatus, setQueuePosition, setSessionInfo, setOpponent, setError]);

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
