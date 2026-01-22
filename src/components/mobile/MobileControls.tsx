'use client';

import { useCallback } from 'react';
import { useOrientation, useIsMobile } from '@/hooks/useResponsiveCanvas';
import { Vector } from '@/engine/utils/Vector';
import Joystick from './Joystick';
import ShootButton from './ShootButton';

interface MobileControlsProps {
  onP1Move: (vector: Vector) => void;
  onP1MoveEnd: () => void;
  onP1ShootStart: () => void;
  onP1ShootEnd: () => void;
  onP2Move: (vector: Vector) => void;
  onP2MoveEnd: () => void;
  onP2ShootStart: () => void;
  onP2ShootEnd: () => void;
  p1Reloading?: boolean;
  p2Reloading?: boolean;
  p1ChargeLevel?: number;
  p2ChargeLevel?: number;
  isOnlineMode?: boolean;
}

export default function MobileControls({
  onP1Move,
  onP1MoveEnd,
  onP1ShootStart,
  onP1ShootEnd,
  onP2Move,
  onP2MoveEnd,
  onP2ShootStart,
  onP2ShootEnd,
  p1Reloading = false,
  p2Reloading = false,
  p1ChargeLevel = 0,
  p2ChargeLevel = 0,
  isOnlineMode = false,
}: MobileControlsProps) {
  const orientation = useOrientation();
  const isMobile = useIsMobile();

  // Don't render on desktop
  if (!isMobile) return null;

  const p1Color = '#ff0055';
  const p2Color = '#00ffff';

  // Online mode: Show only P1 controls with joystick on left, shoot button on right
  if (isOnlineMode) {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 flex items-center justify-between px-6 touch-none"
        style={{
          height: '200px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.7))',
          borderTop: '1px solid #333',
        }}
      >
        {/* Joystick - Left Side */}
        <div className="flex items-center justify-center">
          <Joystick
            size={120}
            color={p1Color}
            playerLabel="P1"
            onMove={onP1Move}
            onRelease={onP1MoveEnd}
          />
        </div>

        {/* Shoot Button - Right Side */}
        <div className="flex items-center justify-center">
          <ShootButton
            size={80}
            color={p1Color}
            onShootStart={onP1ShootStart}
            onShootEnd={onP1ShootEnd}
            isReloading={p1Reloading}
            chargeLevel={p1ChargeLevel}
          />
        </div>
      </div>
    );
  }

  // Portrait layout: Controls at bottom, split left/right
  if (orientation === 'portrait') {
    return (
      <div
        className="fixed bottom-0 left-0 right-0 flex touch-none"
        style={{
          height: '220px',
          background: 'linear-gradient(to top, rgba(0,0,0,0.9), rgba(0,0,0,0.7))',
          borderTop: '1px solid #333',
        }}
      >
        {/* Player 1 Controls - Left Side */}
        <div className="flex-1 flex items-center justify-center gap-4 px-2">
          <Joystick
            size={100}
            color={p1Color}
            playerLabel="P1"
            onMove={onP1Move}
            onRelease={onP1MoveEnd}
          />
          <ShootButton
            size={70}
            color={p1Color}
            onShootStart={onP1ShootStart}
            onShootEnd={onP1ShootEnd}
            isReloading={p1Reloading}
            chargeLevel={p1ChargeLevel}
          />
        </div>

        {/* Divider */}
        <div
          className="w-px self-stretch my-4"
          style={{
            background: 'linear-gradient(to bottom, transparent, #444, transparent)',
          }}
        />

        {/* Player 2 Controls - Right Side */}
        <div className="flex-1 flex items-center justify-center gap-4 px-2">
          <ShootButton
            size={70}
            color={p2Color}
            onShootStart={onP2ShootStart}
            onShootEnd={onP2ShootEnd}
            isReloading={p2Reloading}
            chargeLevel={p2ChargeLevel}
          />
          <Joystick
            size={100}
            color={p2Color}
            playerLabel="P2"
            onMove={onP2Move}
            onRelease={onP2MoveEnd}
          />
        </div>
      </div>
    );
  }

  // Landscape layout: Controls on sides
  return (
    <>
      {/* Player 1 Controls - Left Side */}
      <div
        className="fixed left-0 top-0 bottom-0 flex flex-col items-center justify-center gap-4 touch-none"
        style={{
          width: '140px',
          background: 'linear-gradient(to right, rgba(0,0,0,0.9), rgba(0,0,0,0.5))',
          borderRight: '1px solid #333',
        }}
      >
        <Joystick
          size={100}
          color={p1Color}
          playerLabel="P1"
          onMove={onP1Move}
          onRelease={onP1MoveEnd}
        />
        <ShootButton
          size={60}
          color={p1Color}
          onShootStart={onP1ShootStart}
          onShootEnd={onP1ShootEnd}
          isReloading={p1Reloading}
          chargeLevel={p1ChargeLevel}
        />
      </div>

      {/* Player 2 Controls - Right Side */}
      <div
        className="fixed right-0 top-0 bottom-0 flex flex-col items-center justify-center gap-4 touch-none"
        style={{
          width: '140px',
          background: 'linear-gradient(to left, rgba(0,0,0,0.9), rgba(0,0,0,0.5))',
          borderLeft: '1px solid #333',
        }}
      >
        <Joystick
          size={100}
          color={p2Color}
          playerLabel="P2"
          onMove={onP2Move}
          onRelease={onP2MoveEnd}
        />
        <ShootButton
          size={60}
          color={p2Color}
          onShootStart={onP2ShootStart}
          onShootEnd={onP2ShootEnd}
          isReloading={p2Reloading}
          chargeLevel={p2ChargeLevel}
        />
      </div>
    </>
  );
}
