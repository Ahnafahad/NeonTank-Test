import { Logger } from '@/lib/logging/Logger';
import { useState, useEffect, useCallback, useRef } from 'react';
import { LocalMultiplayerServer } from '../lib/socket/localServer';
import { LocalMultiplayerClient } from '../lib/socket/localClient';

export type LANRole = 'host' | 'guest' | null;
export type LANStatus = 'idle' | 'connecting' | 'connected' | 'error' | 'disconnected';

export interface LANMultiplayerState {
  role: LANRole;
  status: LANStatus;
  roomCode: string;
  error: string | null;
  latency: number;
  isReady: boolean;
  guestId: string | null;
}

export function useLANMultiplayer() {
  const [state, setState] = useState<LANMultiplayerState>({
    role: null,
    status: 'idle',
    roomCode: '',
    error: null,
    latency: 0,
    isReady: false,
    guestId: null
  });

  const serverRef = useRef<LocalMultiplayerServer | null>(null);
  const clientRef = useRef<LocalMultiplayerClient | null>(null);
  const latencyIntervalRef = useRef<number | null>(null);

  // Start hosting
  const startHosting = useCallback(async () => {
    try {
      setState(prev => ({
        ...prev,
        role: 'host',
        status: 'connecting',
        error: null
      }));

      const server = new LocalMultiplayerServer();
      serverRef.current = server;

      await server.startHosting();

      const roomCode = server.getRoomCode();

      setState(prev => ({
        ...prev,
        status: 'connected',
        roomCode
      }));

      // Set up callbacks
      server.onGuestJoined((guestId) => {
        Logger.debug(`Guest joined: ${guestId}`);
        setState(prev => ({
          ...prev,
          guestId
        }));
        // Don't set isReady yet - wait for explicit ready signal
      });

      server.onGuestLeft((guestId) => {
        Logger.debug(`Guest left: ${guestId}`);
        setState(prev => ({
          ...prev,
          isReady: false,
          guestId: null
        }));
      });

      // Set up ready callback
      server.onGuestReady(() => {
        Logger.debug('Guest is ready, triggering countdown');
        setState(prev => ({
          ...prev,
          isReady: true
        }));
      });

      return roomCode;
    } catch (error) {
      console.error('Error starting host:', error);
      setState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Failed to start hosting'
      }));
      throw error;
    }
  }, []);

  // Join game
  const joinGame = useCallback(async (roomCode: string) => {
    try {
      setState(prev => ({
        ...prev,
        role: 'guest',
        status: 'connecting',
        roomCode,
        error: null
      }));

      const client = new LocalMultiplayerClient();
      clientRef.current = client;

      // Set up callbacks before connecting
      client.onConnect(() => {
        Logger.debug('Connected to host');
        setState(prev => ({
          ...prev,
          status: 'connected'
          // Don't set isReady here - will be set by readyUp()
        }));

        // Start latency monitoring
        latencyIntervalRef.current = window.setInterval(() => {
          const avgLatency = client.getAverageLatency();
          setState(prev => ({
            ...prev,
            latency: avgLatency
          }));
        }, 1000);
      });

      client.onDisconnect(() => {
        Logger.debug('Disconnected from host');
        setState(prev => ({
          ...prev,
          status: 'disconnected',
          isReady: false
        }));

        // Clear latency monitoring
        if (latencyIntervalRef.current !== null) {
          clearInterval(latencyIntervalRef.current);
          latencyIntervalRef.current = null;
        }
      });

      client.onErrorReceived((error) => {
        console.error('Client error:', error);
        setState(prev => ({
          ...prev,
          status: 'error',
          error: error.message
        }));
      });

      // Attempt connection with timeout
      const connectTimeout = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Connection timeout')), 30000);
      });

      await Promise.race([
        client.connect(roomCode),
        connectTimeout
      ]);

    } catch (error) {
      console.error('Error joining game:', error);

      let errorMessage = 'Failed to connect';
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = 'Connection timed out. Host may have left or network issue.';
        } else if (error.message.includes('not found')) {
          errorMessage = 'Room code not found. Check the code and try again.';
        } else {
          errorMessage = error.message;
        }
      }

      setState(prev => ({
        ...prev,
        status: 'error',
        error: errorMessage
      }));
      throw error;
    }
  }, []);

  // Disconnect
  const disconnect = useCallback(() => {
    // Clear latency monitoring
    if (latencyIntervalRef.current !== null) {
      clearInterval(latencyIntervalRef.current);
      latencyIntervalRef.current = null;
    }

    // Destroy server or client
    if (serverRef.current) {
      serverRef.current.destroy();
      serverRef.current = null;
    }

    if (clientRef.current) {
      clientRef.current.destroy();
      clientRef.current = null;
    }

    setState({
      role: null,
      status: 'idle',
      roomCode: '',
      error: null,
      latency: 0,
      isReady: false,
      guestId: null
    });
  }, []);

  // Get server instance (for host)
  const getServer = useCallback(() => {
    return serverRef.current;
  }, []);

  // Get client instance (for guest)
  const getClient = useCallback(() => {
    return clientRef.current;
  }, []);

  // Signal ready (called after callbacks are set)
  const readyUp = useCallback(() => {
    if (state.role === 'guest' && clientRef.current) {
      Logger.debug('[useLANMultiplayer] Guest calling readyUp()');
      clientRef.current.sendReady();
      setState(prev => ({
        ...prev,
        isReady: true
      }));
    } else if (state.role === 'host') {
      Logger.debug('[useLANMultiplayer] Host is already ready');
      // Host is always ready once connected
      setState(prev => ({
        ...prev,
        isReady: true
      }));
    }
  }, [state.role]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    state,
    startHosting,
    joinGame,
    disconnect,
    getServer,
    getClient,
    readyUp
  };
}
