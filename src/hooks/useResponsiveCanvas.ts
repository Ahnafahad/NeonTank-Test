'use client';

import { useState, useEffect, useCallback } from 'react';
import { Constants } from '@/engine/utils/Constants';

interface CanvasDimensions {
  width: number;
  height: number;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export function useResponsiveCanvas(
  baseWidth: number = Constants.GAME_WIDTH,
  baseHeight: number = Constants.GAME_HEIGHT,
  padding: number = 20, // Minimum padding from edges
  reservedTop: number = 60, // Space for HUD
  reservedBottom: number = 0 // Space for mobile controls (0 on desktop)
): CanvasDimensions {
  const [dimensions, setDimensions] = useState<CanvasDimensions>({
    width: baseWidth,
    height: baseHeight,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
  });

  const calculateDimensions = useCallback(() => {
    if (typeof window === 'undefined') return;

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Available space after reserving areas
    const availableWidth = viewportWidth - (padding * 2);
    const availableHeight = viewportHeight - reservedTop - reservedBottom - (padding * 2);

    // Calculate scale to fit
    const scaleX = availableWidth / baseWidth;
    const scaleY = availableHeight / baseHeight;

    // Use the smaller scale to ensure entire game fits
    const scale = Math.min(scaleX, scaleY, 1.5); // Cap at 1.5x to prevent too large on big screens

    // Calculate actual dimensions
    const width = Math.floor(baseWidth * scale);
    const height = Math.floor(baseHeight * scale);

    // Calculate centering offsets
    const offsetX = Math.floor((viewportWidth - width) / 2);
    const offsetY = Math.floor(reservedTop + (availableHeight - height) / 2);

    setDimensions({
      width,
      height,
      scale,
      offsetX,
      offsetY,
    });
  }, [baseWidth, baseHeight, padding, reservedTop, reservedBottom]);

  useEffect(() => {
    calculateDimensions();

    window.addEventListener('resize', calculateDimensions);
    window.addEventListener('orientationchange', calculateDimensions);

    return () => {
      window.removeEventListener('resize', calculateDimensions);
      window.removeEventListener('orientationchange', calculateDimensions);
    };
  }, [calculateDimensions]);

  return dimensions;
}

// Hook for detecting device orientation
export function useOrientation(): 'portrait' | 'landscape' {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('landscape');

  useEffect(() => {
    const updateOrientation = () => {
      if (typeof window !== 'undefined') {
        setOrientation(window.innerHeight > window.innerWidth ? 'portrait' : 'landscape');
      }
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return orientation;
}

// Hook for detecting mobile device
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      if (typeof window !== 'undefined') {
        const mobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || ('ontouchstart' in window && window.innerWidth < 1024);
        setIsMobile(mobile);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  return isMobile;
}
