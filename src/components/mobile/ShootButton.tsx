'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface ShootButtonProps {
  size?: number;
  color: string;
  onShootStart: () => void;
  onShootEnd: () => void;
  isReloading?: boolean;
  chargeLevel?: number; // 0-1, for visual feedback
  maxChargeTime?: number; // ms to reach full charge
}

export default function ShootButton({
  size = 80,
  color,
  onShootStart,
  onShootEnd,
  isReloading = false,
  chargeLevel = 0,
  maxChargeTime = 500,
}: ShootButtonProps) {
  const [isPressed, setIsPressed] = useState(false);
  const [localChargeLevel, setLocalChargeLevel] = useState(0);
  const touchIdRef = useRef<number | null>(null);
  const chargeStartRef = useRef<number | null>(null);
  const animationRef = useRef<number | null>(null);

  // Update charge level animation
  const updateCharge = useCallback(() => {
    if (chargeStartRef.current !== null) {
      const elapsed = Date.now() - chargeStartRef.current;
      const charge = Math.min(elapsed / maxChargeTime, 1);
      setLocalChargeLevel(charge);
      animationRef.current = requestAnimationFrame(updateCharge);
    }
  }, [maxChargeTime]);

  const handleStart = useCallback(() => {
    if (isReloading) return;

    setIsPressed(true);
    chargeStartRef.current = Date.now();
    setLocalChargeLevel(0);
    animationRef.current = requestAnimationFrame(updateCharge);
    onShootStart();
  }, [isReloading, onShootStart, updateCharge]);

  const handleEnd = useCallback(() => {
    setIsPressed(false);
    chargeStartRef.current = null;
    setLocalChargeLevel(0);

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }

    onShootEnd();
  }, [onShootEnd]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return;

      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      handleStart();
    },
    [handleStart]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();

      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          handleEnd();
          break;
        }
      }
    },
    [handleEnd]
  );

  // Mouse support for desktop testing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      handleStart();

      const handleMouseUp = () => {
        handleEnd();
        window.removeEventListener('mouseup', handleMouseUp);
      };
      window.addEventListener('mouseup', handleMouseUp);
    },
    [handleStart, handleEnd]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  const displayCharge = chargeLevel > 0 ? chargeLevel : localChargeLevel;
  const isFullyCharged = displayCharge >= 1;

  return (
    <div
      className="relative rounded-full touch-none select-none flex items-center justify-center"
      style={{
        width: size,
        height: size,
        backgroundColor: isReloading ? '#333' : 'rgba(0, 0, 0, 0.6)',
        border: `3px solid ${isReloading ? '#666' : color}`,
        boxShadow: isPressed && !isReloading
          ? `0 0 30px ${color}, 0 0 60px ${color}50`
          : `0 0 10px ${color}40`,
        opacity: isReloading ? 0.5 : 1,
        transition: 'box-shadow 0.1s ease, opacity 0.2s ease',
        cursor: isReloading ? 'not-allowed' : 'pointer',
      }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {/* Charge ring */}
      {isPressed && !isReloading && (
        <svg
          className="absolute inset-0"
          viewBox="0 0 100 100"
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={`${displayCharge * 283} 283`}
            style={{
              filter: isFullyCharged ? `drop-shadow(0 0 10px ${color})` : 'none',
              transition: 'stroke-dasharray 0.05s linear',
            }}
          />
        </svg>
      )}

      {/* Reload indicator */}
      {isReloading && (
        <svg
          className="absolute inset-0 animate-spin"
          viewBox="0 0 100 100"
          style={{ animationDuration: '1s' }}
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="#666"
            strokeWidth="4"
            strokeDasharray="70 213"
          />
        </svg>
      )}

      {/* Button label */}
      <span
        className="font-bold text-xs uppercase tracking-wider z-10"
        style={{
          color: isReloading ? '#666' : color,
          textShadow: isPressed && !isReloading ? `0 0 10px ${color}` : 'none',
        }}
      >
        {isReloading ? 'RELOAD' : 'FIRE'}
      </span>

      {/* Full charge indicator */}
      {isFullyCharged && !isReloading && (
        <div
          className="absolute inset-0 rounded-full animate-pulse"
          style={{
            border: `2px solid white`,
            boxShadow: `0 0 15px white, inset 0 0 15px ${color}50`,
          }}
        />
      )}

      {/* Press feedback */}
      {isPressed && !isReloading && (
        <div
          className="absolute inset-1 rounded-full"
          style={{
            background: `radial-gradient(circle, ${color}30, transparent)`,
          }}
        />
      )}
    </div>
  );
}
