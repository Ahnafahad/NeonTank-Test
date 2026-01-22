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
                    console.log('[useMultiplayer] Status changed:', status);
                    // Map network status to store status
                    const storeStatus = status as typeof connectionStatus;
                    setConnectionStatus(storeStatus);
                },
                onGameState: (state) => {
                    setGameState(state);
                },
                onMatchFound: (opponent, tankId) => {
                    console.log('[useMultiplayer] Match found callback:', opponent, tankId);
                    setOpponent(opponent.id, opponent.name);
                    setAssignedTankId(tankId);
                    setCountdown(3); // Start countdown
                },
                onPlayerJoined: (player) => {
                    console.log('[useMultiplayer] Player joined callback:', player);
                    if (player.id !== networkManagerRef.current?.getPlayerId()) {
                        console.log('[useMultiplayer] Setting as opponent');
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
            console.log('[useMultiplayer] Connecting to server...');
            await networkManagerRef.current.connect();
            console.log('[useMultiplayer] Connected! Player ID:', networkManagerRef.current.getPlayerId());
            if (networkManagerRef.current.getPlayerId()) {
                setSessionInfo('', networkManagerRef.current.getPlayerId());
            }
        } catch (err) {
            console.error('[useMultiplayer] Connection failed:', err);
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
            console.log('[useMultiplayer] Starting matchmaking...');
            setConnectionStatus('matchmaking');
            setQueuePosition(1);

            const session = await networkManagerRef.current.findMatch();
            console.log('[useMultiplayer] Matchmaking result:', session);
            setSessionInfo(session.sessionId, networkManagerRef.current.getPlayerId());

            if (session.players.length === 2) {
                console.log('[useMultiplayer] Match found with 2 players!');
                const opponent = session.players.find(
                    (p) => p.id !== networkManagerRef.current?.getPlayerId()
                );
                if (opponent) {
                    console.log('[useMultiplayer] Opponent:', opponent);
                    setOpponent(opponent.id, opponent.name);
                }
            } else {
                console.log('[useMultiplayer] Waiting for opponent... Players:', session.players.length);
            }
        } catch (err) {
            console.error('[useMultiplayer] Matchmaking failed:', err);
            setError('Failed to find match');
        }
    }, [setConnectionStatus, setQueuePosition, setSessionInfo, setOpponent, setError]);

    // Join specific session
    const joinSession = useCallback(async (sessionId: string) => {
        if (!networkManagerRef.current) return;

        try {
            console.log('[useMultiplayer] Joining session:', sessionId);
            setConnectionStatus('matchmaking');

            const session = await networkManagerRef.current.joinSession(sessionId);
            console.log('[useMultiplayer] Joined session:', session);
            setSessionInfo(session.sessionId, networkManagerRef.current.getPlayerId());

            if (session.players.length === 2) {
                console.log('[useMultiplayer] Session has 2 players!');
                const opponent = session.players.find(
                    (p) => p.id !== networkManagerRef.current?.getPlayerId()
                );
                if (opponent) {
                    console.log('[useMultiplayer] Opponent found:', opponent);
                    setOpponent(opponent.id, opponent.name);
                }
            } else {
                console.log('[useMultiplayer] Waiting for opponent in session... Players:', session.players.length);
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
