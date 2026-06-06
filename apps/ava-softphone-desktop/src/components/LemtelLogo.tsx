import React from 'react';
import lemtelWordmark from '../assets/lemtel-wordmark.png';

export type LemtelLogoSize = 'xs' | 'sm' | 'md' | 'lg';

const HEIGHTS: Record<LemtelLogoSize, number> = {
  xs: 22,
  sm: 32,
  md: 56,
  lg: 110,
};

interface Props {
  size?: LemtelLogoSize;
  glow?: boolean;
  /** kept for API back-compat — no longer renders a halo */
  halo?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Single source of truth for the Lemtel wordmark across the desktop app
 * (TitleBar, Auth/SetupWizard, Softphone footer).
 */
export default function LemtelLogo({
  size = 'sm',
  glow = true,
  className,
  style,
}: Props) {
  const height = HEIGHTS[size];

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}
    >
      <img
        src={lemtelWordmark}
        alt="Lemtel Communications"
        draggable={false}
        style={{
          height,
          width: 'auto',
          display: 'block',
          filter: glow ? 'drop-shadow(0 2px 14px rgba(255,215,0,0.35))' : undefined,
          transition: 'filter 200ms ease',
          ...style,
        }}
      />
    </span>
  );
}
