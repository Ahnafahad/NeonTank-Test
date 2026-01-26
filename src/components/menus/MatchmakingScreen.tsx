'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMultiplayer } from '@/hooks/useMultiplayer';

export type ControlScheme = 'wasd' | 'arrows';

interface MatchmakingScreenProps {
  onCancel: () => void;
  onMatchStart: (playerName: string, controls: ControlScheme) => void;
  joinSessionId?: string | null;
}

export function MatchmakingScreen({ onCancel, onMatchStart, joinSessionId }: MatchmakingScreenProps) {
  const [screen, setScreen] = useState<'setup' | 'matchmaking'>('setup');
  const [playerName, setPlayerName] = useState('');
  const [controlScheme, setControlScheme] = useState<ControlScheme>('wasd');
  const [sessionCode, setSessionCode] = useState(joinSessionId || '');
  const [isJoining, setIsJoining] = useState(!!joinSessionId);

  const {
    connectionStatus,
    opponentName,
    queuePosition,
    countdown,
    error,
    sessionId,
    connect,
    findMatch,
    joinSession,
    cancelMatch,
    disconnect,
    reset,
    isMatched,
    updatePlayerName,
  } = useMultiplayer();

  // Start matchmaking after setup
  useEffect(() => {
    if (screen === 'matchmaking' && connectionStatus === 'disconnected') {
      const startMatchmaking = async () => {
        console.log('[MatchmakingScreen] Starting matchmaking...', { playerName, isJoining, sessionCode });

        // Update player name in multiplayer system
        updatePlayerName(playerName);

        console.log('[MatchmakingScreen] Connecting to server...');
        await connect();
        console.log('[MatchmakingScreen] Connected!');

        if (isJoining && sessionCode) {
          console.log('[MatchmakingScreen] Joining session:', sessionCode);
          await joinSession(sessionCode);
        } else {
          console.log('[MatchmakingScreen] Finding match...');
          await findMatch();
        }
      };
      startMatchmaking();
    }
  }, [screen, connect, findMatch, joinSession, connectionStatus, isJoining, sessionCode, playerName, updatePlayerName]);

  // Handle countdown completion
  useEffect(() => {
    console.log('[MatchmakingScreen] Countdown/Match check:', { countdown, isMatched, connectionStatus });
    if (countdown === 0 && isMatched) {
      console.log('[MatchmakingScreen] Starting game!');
      onMatchStart(playerName, controlScheme);
    }
  }, [countdown, isMatched, onMatchStart, playerName, controlScheme, connectionStatus]);

  const handleCancel = () => {
    cancelMatch();
    disconnect();
    onCancel();
  };

  const handleRetry = () => {
    reset();
    setScreen('setup');
  };

  const handleStartMatchmaking = () => {
    if (!playerName.trim()) return;
    setScreen('matchmaking');
  };

  const generateSessionCode = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  // Setup Screen
  if (screen === 'setup') {
    return (
      <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 overflow-hidden p-6">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px]"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.2, 0.3, 0.2],
            }}
            transition={{
              duration: 3,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
          <motion.div
            className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px]"
            animate={{
              scale: [1.2, 1, 1.2],
              opacity: [0.3, 0.2, 0.3],
            }}
            transition={{
              duration: 3,
              ease: 'easeInOut',
              repeat: Infinity,
            }}
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full max-w-md"
        >
          <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">
            ONLINE SETUP
          </h2>

          <div className="bg-gray-900/60 border border-cyan-500/30 rounded-xl p-8 mb-6 space-y-6">
            {/* Player Name */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 20))}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
                maxLength={20}
              />
            </div>

            {/* Control Scheme */}
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-3">
                Choose Controls
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setControlScheme('wasd')}
                  className={`p-4 rounded-lg border-2 transition-all ${controlScheme === 'wasd'
                      ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                    }`}
                >
                  <div className="text-lg font-bold text-white mb-1">WASD</div>
                  <div className="text-xs text-gray-400">W/A/S/D + Space</div>
                </button>
                <button
                  onClick={() => setControlScheme('arrows')}
                  className={`p-4 rounded-lg border-2 transition-all ${controlScheme === 'arrows'
                      ? 'border-cyan-500 bg-cyan-500/10 shadow-[0_0_15px_rgba(0,255,255,0.3)]'
                      : 'border-gray-600 bg-gray-800/50 hover:border-gray-500'
                    }`}
                >
                  <div className="text-lg font-bold text-white mb-1">Arrows</div>
                  <div className="text-xs text-gray-400">↑/←/↓/→ + Enter</div>
                </button>
              </div>
            </div>

            {/* Join or Create */}
            <div>
              <div className="flex items-center gap-3 mb-3">
                <button
                  onClick={() => {
                    setIsJoining(false);
                    setSessionCode('');
                  }}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${!isJoining
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                >
                  Create Game
                </button>
                <button
                  onClick={() => setIsJoining(true)}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${isJoining
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                >
                  Join Game
                </button>
              </div>

              {isJoining && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <input
                    type="text"
                    value={sessionCode}
                    onChange={(e) => setSessionCode(e.target.value.toUpperCase().slice(0, 5))}
                    placeholder="Enter 5-character code"
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white text-center text-xl font-mono tracking-widest placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors uppercase"
                    maxLength={5}
                  />
                </motion.div>
              )}
            </div>

            {/* Start Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStartMatchmaking}
              disabled={!playerName.trim() || (isJoining && sessionCode.length !== 5)}
              className="
                w-full py-3 px-6
                text-sm font-bold tracking-wider
                text-white
                bg-gradient-to-r from-pink-600 to-cyan-600
                border border-transparent
                rounded-lg
                shadow-[0_0_20px_rgba(0,255,255,0.3)]
                transition-all duration-200
                hover:shadow-[0_0_30px_rgba(0,255,255,0.5)]
                focus:outline-none focus:ring-2 focus:ring-cyan-500/50
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none
              "
            >
              {isJoining ? 'JOIN GAME' : 'CREATE GAME'}
            </motion.button>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onCancel}
            className="
              w-full py-3 px-6
              text-sm font-bold tracking-wider
              text-gray-400
              bg-gray-800/80 border border-gray-600
              rounded-lg
              transition-all duration-200
              hover:text-white hover:border-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-500/50
            "
          >
            CANCEL
          </motion.button>
        </motion.div>
      </div>
    );
  }

  // Matchmaking Screen
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gray-950 overflow-hidden p-6">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute top-1/4 left-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-[100px]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.3, 0.2],
          }}
          transition={{
            duration: 3,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
        <motion.div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/20 rounded-full blur-[100px]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.2, 0.3],
          }}
          transition={{
            duration: 3,
            ease: 'easeInOut',
            repeat: Infinity,
          }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Title */}
        <h2 className="text-2xl md:text-3xl font-bold text-center mb-8 text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500">
          ONLINE MATCH
        </h2>

        {/* Content Card */}
        <div className="bg-gray-900/60 border border-cyan-500/30 rounded-xl p-8 mb-6">
          <AnimatePresence mode="wait">
            {/* Connecting State */}
            {connectionStatus === 'connecting' && (
              <ConnectingContent key="connecting" />
            )}

            {/* Matchmaking State */}
            {connectionStatus === 'matchmaking' && (
              <MatchmakingContent
                key="matchmaking"
                queuePosition={queuePosition}
                sessionId={sessionId}
              />
            )}

            {/* Matched State */}
            {connectionStatus === 'matched' && (
              <MatchedContent
                key="matched"
                opponentName={opponentName}
              />
            )}

            {/* Error State */}
            {error && (
              <ErrorContent key="error" error={error} onRetry={handleRetry} />
            )}

            {/* Disconnected State (initial) */}
            {connectionStatus === 'disconnected' && !error && (
              <DisconnectedContent key="disconnected" />
            )}
          </AnimatePresence>
        </div>

        {/* Cancel Button */}
        {connectionStatus !== 'matched' && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleCancel}
            className="
              w-full py-3 px-6
              text-sm font-bold tracking-wider
              text-gray-400
              bg-gray-800/80 border border-gray-600
              rounded-lg
              transition-all duration-200
              hover:text-white hover:border-gray-500
              focus:outline-none focus:ring-2 focus:ring-gray-500/50
            "
          >
            CANCEL
          </motion.button>
        )}
      </motion.div>
    </div>
  );
}

function ConnectingContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-4"
    >
      {/* Spinner */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
        className="inline-block mb-6"
      >
        <div className="w-12 h-12 border-4 border-cyan-500/30 border-t-cyan-500 rounded-full" />
      </motion.div>

      <h3 className="text-xl font-semibold text-cyan-100 mb-2">
        Connecting...
      </h3>
      <p className="text-sm text-gray-400">
        Establishing connection to server
      </p>
    </motion.div>
  );
}

interface MatchmakingContentProps {
  queuePosition: number | null;
  sessionId: string | null;
}

function MatchmakingContent({ queuePosition, sessionId }: MatchmakingContentProps) {
  const [copied, setCopied] = useState(false);

  const copySessionCode = () => {
    if (sessionId && typeof window !== 'undefined') {
      navigator.clipboard.writeText(sessionId).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(err => {
        console.error('Failed to copy session code:', err);
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-4"
    >
      {/* Animated search indicator */}
      <div className="flex justify-center items-center gap-2 mb-6">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-3 h-3 rounded-full bg-gradient-to-r from-pink-500 to-cyan-500"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.5, 1, 0.5],
            }}
            transition={{
              duration: 1,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>

      <h3 className="text-xl font-semibold text-cyan-100 mb-2">
        Waiting for Player...
      </h3>

      {sessionId && (
        <div className="mt-6 mb-6">
          <p className="text-sm text-gray-400 mb-2">Share this code with your friend!</p>
          <div className="bg-gray-800/80 border-2 border-cyan-500/50 rounded-lg p-4 mb-3">
            <div className="text-3xl font-mono font-bold tracking-[0.5em] text-center text-cyan-400">
              {sessionId}
            </div>
          </div>
          <button
            onClick={copySessionCode}
            className="
              flex items-center justify-center gap-2 mx-auto
              py-2 px-4
              text-sm font-bold tracking-wider
              text-cyan-400
              bg-cyan-950/50 border border-cyan-500/50
              rounded-lg
              transition-all duration-200
              hover:bg-cyan-900/50 hover:border-cyan-400
            "
          >
            {copied ? (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                COPIED!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                COPY CODE
              </>
            )}
          </button>
        </div>
      )}

      <p className="text-sm text-gray-500 mt-4">
        Searching for players...
      </p>
    </motion.div>
  );
}

interface MatchedContentProps {
  opponentName: string | null;
}

function MatchedContent({ opponentName }: MatchedContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-4"
    >
      {/* Success icon */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', damping: 10, stiffness: 200 }}
        className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-gradient-to-r from-pink-500/20 to-cyan-500/20 border-2 border-cyan-500"
      >
        <motion.svg
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="w-8 h-8 text-cyan-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <motion.path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={3}
            d="M5 13l4 4L19 7"
          />
        </motion.svg>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-500 mb-2"
      >
        Match Found!
      </motion.h3>

      {opponentName && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mb-6"
        >
          <p className="text-sm text-gray-400 mb-1">Your Opponent</p>
          <p className="text-lg font-semibold text-white">{opponentName}</p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-cyan-400 text-sm font-semibold"
      >
        Starting game...
      </motion.div>
    </motion.div>
  );
}

interface ErrorContentProps {
  error: string;
  onRetry: () => void;
}

function ErrorContent({ error, onRetry }: ErrorContentProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-4"
    >
      {/* Error icon */}
      <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-red-500/20 border-2 border-red-500">
        <svg
          className="w-8 h-8 text-red-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </div>

      <h3 className="text-xl font-semibold text-red-400 mb-2">
        Connection Error
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        {error}
      </p>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onRetry}
        className="
          py-3 px-8
          text-sm font-bold tracking-wider
          text-white
          bg-red-600/80 border border-red-500
          rounded-lg
          transition-all duration-200
          hover:bg-red-600 hover:shadow-[0_0_20px_rgba(239,68,68,0.4)]
          focus:outline-none focus:ring-2 focus:ring-red-500/50
        "
      >
        RETRY
      </motion.button>
    </motion.div>
  );
}

function DisconnectedContent() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="text-center py-4"
    >
      {/* Globe icon */}
      <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-gray-800 border-2 border-gray-600">
        <svg
          className="w-8 h-8 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
          />
        </svg>
      </div>

      <h3 className="text-xl font-semibold text-gray-400 mb-2">
        Ready to Connect
      </h3>
      <p className="text-sm text-gray-500">
        Press Cancel to return to menu
      </p>
    </motion.div>
  );
}

export default MatchmakingScreen;
