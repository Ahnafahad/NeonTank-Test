import { Logger } from '@/lib/logging/Logger';
import React, { useState, useEffect, useRef } from 'react';
import { useLANMultiplayer } from '../../hooks/useLANMultiplayer';

interface LANLobbyProps {
  onBack: () => void;
  onGameStart: (isHost: boolean, serverId?: any, clientId?: any) => void;
}

type LobbyMode = 'select' | 'host' | 'join';

export const LANLobby: React.FC<LANLobbyProps> = ({ onBack, onGameStart }) => {
  const [mode, setMode] = useState<LobbyMode>('select');
  const [inputCode, setInputCode] = useState('');
  const [countdown, setCountdown] = useState<number | null>(null);
  const { state, startHosting, joinGame, disconnect, getServer, getClient, readyUp } = useLANMultiplayer();
  const countdownIntervalRef = useRef<number | null>(null);
  const hasCalledReadyRef = useRef<boolean>(false);

  // Call readyUp after onGameStart callback is registered
  useEffect(() => {
    if (state.status === 'connected' && !hasCalledReadyRef.current) {
      Logger.debug('[LANLobby] Connection established and callback ready, calling readyUp()');
      hasCalledReadyRef.current = true;
      // Small delay to ensure everything is set up
      setTimeout(() => {
        readyUp();
      }, 100);
    }
  }, [state.status, readyUp]);

  // Handle countdown when both players ready
  useEffect(() => {
    if (state.isReady && countdown === null && state.status === 'connected') {
      setCountdown(3);
    }
  }, [state.isReady, state.status, countdown]);

  // Countdown timer
  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      countdownIntervalRef.current = window.setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);
    } else if (countdown === 0) {
      // Start game
      if (state.role === 'host') {
        onGameStart(true, getServer(), null);
      } else if (state.role === 'guest') {
        onGameStart(false, null, getClient());
      }
    }

    return () => {
      if (countdownIntervalRef.current !== null) {
        clearTimeout(countdownIntervalRef.current);
      }
    };
  }, [countdown, state.role, onGameStart, getServer, getClient]);

  const handleHostGame = async () => {
    setMode('host');
    try {
      await startHosting();
    } catch (error) {
      console.error('Failed to host:', error);
    }
  };

  const handleJoinGame = async () => {
    if (inputCode.length !== 6) {
      return;
    }

    try {
      await joinGame(inputCode);
    } catch (error) {
      console.error('Failed to join:', error);
    }
  };

  const handleBack = () => {
    disconnect();
    if (mode === 'select') {
      onBack();
    } else {
      setMode('select');
      setInputCode('');
      setCountdown(null);
    }
  };

  const handleCodeInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setInputCode(digits);
  };

  // Mode selection screen
  if (mode === 'select') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-wider mb-2 text-center"
            style={{
              textShadow: '0 0 20px rgba(59, 130, 246, 0.8)'
            }}>
          LAN MULTIPLAYER
        </h1>
        <p className="text-gray-400 text-lg mb-12 text-center">
          Play with zero lag on the same WiFi network
        </p>

        <div className="flex flex-col md:flex-row gap-6 mb-12 w-full max-w-4xl px-4">
          <button
            onClick={handleHostGame}
            className="flex-1 flex flex-col items-center p-8 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-xl hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] transition-all duration-300 group"
          >
            <div className="text-6xl mb-4">🎮</div>
            <div className="text-2xl font-bold text-white mb-2 uppercase tracking-wider">HOST GAME</div>
            <div className="text-gray-400 text-center">Create a room and share the code</div>
          </button>

          <button
            onClick={() => setMode('join')}
            className="flex-1 flex flex-col items-center p-8 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-xl hover:border-green-500 hover:shadow-[0_0_20px_rgba(34,197,94,0.3)] transition-all duration-300 group"
          >
            <div className="text-6xl mb-4">🔗</div>
            <div className="text-2xl font-bold text-white mb-2 uppercase tracking-wider">JOIN GAME</div>
            <div className="text-gray-400 text-center">Enter a room code to join</div>
          </button>
        </div>

        <button
          onClick={handleBack}
          className="px-8 py-3 text-lg font-bold border-2 border-gray-600 text-gray-400 rounded-full hover:border-white hover:text-white transition-all uppercase tracking-wider"
        >
          BACK TO MENU
        </button>
      </div>
    );
  }

  // Host mode
  if (mode === 'host') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-wider mb-8">HOST GAME</h1>

        {state.status === 'connecting' && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-xl w-full max-w-md">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-6"></div>
            <div className="text-gray-400 text-lg">Setting up server...</div>
          </div>
        )}

        {state.status === 'connected' && !state.isReady && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-xl w-full max-w-md">
            <div className="mb-8 text-center">
              <div className="text-gray-400 text-lg mb-4">Your Room Code:</div>
              <div className="text-7xl font-black text-blue-500 tracking-[0.3em] mb-4"
                   style={{ textShadow: '0 0 30px rgba(59, 130, 246, 0.6)' }}>
                {state.roomCode}
              </div>
              <div className="text-gray-500 text-sm">Share this code with your opponent</div>
            </div>

            <div className="flex flex-col items-center">
              <div className="w-10 h-10 border-4 border-gray-700 border-t-blue-500 rounded-full animate-spin mb-4"></div>
              <div className="text-gray-400">Waiting for player to join...</div>
            </div>
          </div>
        )}

        {state.status === 'connected' && state.isReady && countdown !== null && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-green-700 rounded-xl w-full max-w-md">
            <div className="text-gray-400 text-sm mb-2">Room Code: {state.roomCode}</div>

            <div className="my-8 text-center">
              <div className="text-gray-400 text-xl mb-4">Game starting in</div>
              <div className="text-9xl font-black text-green-500 animate-pulse"
                   style={{ textShadow: '0 0 40px rgba(74, 222, 128, 0.6)' }}>
                {countdown}
              </div>
            </div>
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-red-950 to-red-900 border-2 border-red-500 rounded-xl w-full max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <div className="text-red-300 text-lg text-center mb-2">{state.error || 'Failed to start hosting'}</div>
            <button
              onClick={handleHostGame}
              className="mt-6 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all uppercase"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        <button
          onClick={handleBack}
          className="mt-8 px-8 py-3 text-lg font-bold border-2 border-gray-600 text-gray-400 rounded-full hover:border-white hover:text-white transition-all uppercase"
        >
          CANCEL
        </button>
      </div>
    );
  }

  // Join mode
  if (mode === 'join') {
    return (
      <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-4">
        <h1 className="text-3xl md:text-4xl font-bold text-white uppercase tracking-wider mb-8">JOIN GAME</h1>

        {state.status === 'idle' && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-xl w-full max-w-md">
            <div className="text-gray-400 text-lg mb-6">Enter Room Code:</div>

            <div className="flex gap-2 mb-8">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <div
                  key={index}
                  className="w-14 h-20 flex items-center justify-center text-4xl font-bold text-white bg-gray-950 border-2 border-gray-700 rounded-lg shadow-inner"
                >
                  {inputCode[index] || ''}
                </div>
              ))}
            </div>

            <input
              type="text"
              inputMode="numeric"
              value={inputCode}
              onChange={(e) => handleCodeInput(e.target.value)}
              maxLength={6}
              autoFocus
              className="absolute opacity-0 pointer-events-all w-1 h-1"
            />

            <button
              onClick={handleJoinGame}
              disabled={inputCode.length !== 6}
              className="px-8 py-4 text-xl font-bold bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:shadow-[0_0_30px_rgba(59,130,246,0.5)] transition-all disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-wider"
            >
              JOIN GAME
            </button>
          </div>
        )}

        {state.status === 'connecting' && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-gray-700 rounded-xl w-full max-w-md">
            <div className="w-12 h-12 border-4 border-gray-700 border-t-green-500 rounded-full animate-spin mb-6"></div>
            <div className="text-gray-400 text-lg">Connecting to host...</div>
          </div>
        )}

        {state.status === 'connected' && countdown !== null && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-green-700 rounded-xl w-full max-w-md">
            <div className="text-green-500 text-xl mb-8">✓ Connected!</div>

            <div className="mb-6 text-center">
              <div className="text-gray-400 text-xl mb-4">Game starting in</div>
              <div className="text-9xl font-black text-green-500 animate-pulse"
                   style={{ textShadow: '0 0 40px rgba(74, 222, 128, 0.6)' }}>
                {countdown}
              </div>
            </div>

            {state.latency > 0 && (
              <div className="text-green-500 text-sm mt-4">Latency: {state.latency}ms</div>
            )}
          </div>
        )}

        {state.status === 'error' && (
          <div className="flex flex-col items-center p-12 bg-gradient-to-br from-red-950 to-red-900 border-2 border-red-500 rounded-xl w-full max-w-md">
            <div className="text-6xl mb-4">⚠️</div>
            <div className="text-red-300 text-lg text-center mb-2">{state.error || 'Failed to connect'}</div>
            <div className="text-gray-400 text-sm text-center mb-6">Make sure you're on the same WiFi network</div>
            <button
              onClick={() => {
                disconnect();
                setInputCode('');
              }}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg transition-all uppercase"
            >
              TRY AGAIN
            </button>
          </div>
        )}

        <button
          onClick={handleBack}
          className="mt-8 px-8 py-3 text-lg font-bold border-2 border-gray-600 text-gray-400 rounded-full hover:border-white hover:text-white transition-all uppercase"
        >
          BACK
        </button>
      </div>
    );
  }

  return null;
};
