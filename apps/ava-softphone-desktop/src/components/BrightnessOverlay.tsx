import React from 'react';
import { useBrightness, BRIGHTNESS_OVERLAY } from '../hooks/useBrightness';

/**
 * Sits absolutely over the app background. Lifts darkness with a soft
 * blue tint so the modern navy/gold palette can be tuned to taste.
 */
export default function BrightnessOverlay() {
  const { brightness } = useBrightness();
  const o = BRIGHTNESS_OVERLAY[brightness];
  if (o <= 0) return null;
  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `radial-gradient(1200px 800px at 50% 0%, rgba(160,200,255,${o + 0.04}) 0%, rgba(160,200,255,${o}) 40%, transparent 80%)`,
        mixBlendMode: 'screen' as any,
      }}
    />
  );
}
