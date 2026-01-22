'use client';

import { useRef, useState, useCallback, useEffect } from 'react';
import { Vector } from '@/engine/utils/Vector';

interface JoystickProps {
  size?: number;
  color: string;
  playerLabel: string;
  onMove: (vector: Vector) => void;
  onRelease: () => void;
}

export default function Joystick({
  size = 120,
  color,
  playerLabel,
  onMove,
  onRelease,
}: JoystickProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isActive, setIsActive] = useState(false);
  const [knobPosition, setKnobPosition] = useState({ x: 0, y: 0 });
  const touchIdRef = useRef<number | null>(null);

  const maxDistance = size / 2 - 20; // Maximum knob travel distance

  const calculateVector = useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return Vector.zero();

      const rect = containerRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      let deltaX = clientX - centerX;
      let deltaY = clientY - centerY;

      // Calculate distance from center
      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

      // Clamp to max distance
      if (distance > maxDistance) {
        deltaX = (deltaX / distance) * maxDistance;
        deltaY = (deltaY / distance) * maxDistance;
      }

      // Update knob visual position
      setKnobPosition({ x: deltaX, y: deltaY });

      // Return normalized vector (-1 to 1)
      return new Vector(deltaX / maxDistance, deltaY / maxDistance);
    },
    [maxDistance]
  );

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current !== null) return; // Already tracking a touch

      const touch = e.changedTouches[0];
      touchIdRef.current = touch.identifier;
      setIsActive(true);

      const vector = calculateVector(touch.clientX, touch.clientY);
      onMove(vector);
    },
    [calculateVector, onMove]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current === null) return;

      // Find our tracked touch
      for (let i = 0; i < e.changedTouches.length; i++) {
        const touch = e.changedTouches[i];
        if (touch.identifier === touchIdRef.current) {
          const vector = calculateVector(touch.clientX, touch.clientY);
          onMove(vector);
          break;
        }
      }
    },
    [calculateVector, onMove]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      if (touchIdRef.current === null) return;

      // Check if our tracked touch ended
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i].identifier === touchIdRef.current) {
          touchIdRef.current = null;
          setIsActive(false);
          setKnobPosition({ x: 0, y: 0 });
          onRelease();
          break;
        }
      }
    },
    [onRelease]
  );

  // Mouse support for desktop testing
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsActive(true);
      const vector = calculateVector(e.clientX, e.clientY);
      onMove(vector);

      const handleMouseMove = (e: MouseEvent) => {
        const vector = calculateVector(e.clientX, e.clientY);
        onMove(vector);
      };

      const handleMouseUp = () => {
        setIsActive(false);
        setKnobPosition({ x: 0, y: 0 });
        onRelease();
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [calculateVector, onMove, onRelease]
  );

  return (
    <div className="flex flex-col items-center gap-2">
      <span
        className="text-xs font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {playerLabel}
      </span>

      <div
        ref={containerRef}
        className="relative rounded-full touch-none select-none"
        style={{
          width: size,
          height: size,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
          border: `3px solid ${color}`,
          boxShadow: isActive ? `0 0 20px ${color}, inset 0 0 20px rgba(255,255,255,0.1)` : `0 0 10px ${color}40`,
          transition: 'box-shadow 0.15s ease',
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseDown={handleMouseDown}
      >
        {/* Direction indicators */}
        <div className="absolute inset-0 flex items-center justify-center opacity-30">
          <div
            className="absolute top-2 w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderBottom: `10px solid ${color}`,
            }}
          />
          <div
            className="absolute bottom-2 w-0 h-0"
            style={{
              borderLeft: '8px solid transparent',
              borderRight: '8px solid transparent',
              borderTop: `10px solid ${color}`,
            }}
          />
          <div
            className="absolute left-2 w-0 h-0"
            style={{
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderRight: `10px solid ${color}`,
            }}
          />
          <div
            className="absolute right-2 w-0 h-0"
            style={{
              borderTop: '8px solid transparent',
              borderBottom: '8px solid transparent',
              borderLeft: `10px solid ${color}`,
            }}
          />
        </div>

        {/* Knob */}
        <div
          className="absolute rounded-full"
          style={{
            width: 50,
            height: 50,
            backgroundColor: color,
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${knobPosition.x}px), calc(-50% + ${knobPosition.y}px))`,
            boxShadow: isActive
              ? `0 0 15px ${color}, 0 0 30px ${color}`
              : `0 0 10px ${color}`,
            transition: isActive ? 'none' : 'transform 0.15s ease-out',
          }}
        >
          {/* Inner highlight */}
          <div
            className="absolute inset-2 rounded-full"
            style={{
              background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.4), transparent)`,
            }}
          />
        </div>
      </div>
    </div>
  );
}
