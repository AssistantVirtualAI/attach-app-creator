import React from 'react';
import lemtelLogo from '../assets/lemtel-logo.png';

export type LemtelLogoSize = 'xs' | 'sm' | 'md' | 'lg';

const HEIGHTS: Record<LemtelLogoSize, number> = {
  xs: 18,
  sm: 24,
  md: 44,
  lg: 90,
};

interface Props {
  size?: LemtelLogoSize;
  glow?: boolean;
  halo?: boolean; // conic glow ring behind logo
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Single source of truth for the Lemtel logo across the app
 * (TitleBar, Auth/SetupWizard, Softphone footer).
 */
export default function LemtelLogo({
  size = 'sm',
  glow = true,
  halo = false,
  className,
  style,
}: Props) {
  const height = HEIGHTS[size];

  const img = (
    <img
      src={lemtelLogo}
      alt="Lemtel Communications"
      draggable={false}
      style={{
        position: 'relative',
        height,
        width: 'auto',
        zIndex: 1,
        display: 'block',
        filter: glow ? 'drop-shadow(0 0 10px rgba(255,215,0,0.4))' : undefined,
        transition: 'filter 200ms ease, transform 200ms ease',
        ...style,
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLImageElement).style.filter =
          'drop-shadow(0 0 16px rgba(255,215,0,0.7))';
        (e.currentTarget as HTMLImageElement).style.transform = 'scale(1.04)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLImageElement).style.filter = glow
          ? 'drop-shadow(0 0 10px rgba(255,215,0,0.4))'
          : '';
        (e.currentTarget as HTMLImageElement).style.transform = 'scale(1)';
      }}
    />
  );

  if (!halo) return <span className={className}>{img}</span>;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        padding: 14,
        borderRadius: 24,
        display: 'inline-flex',
        background:
          'radial-gradient(circle at 50% 50%, rgba(0,90,255,0.25), rgba(255,215,0,0.08) 60%, transparent 80%)',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24,
          background:
            'conic-gradient(from 0deg, rgba(255,215,0,0.4), rgba(0,140,255,0.4), rgba(255,215,0,0.4))',
          filter: 'blur(18px)',
          opacity: 0.4,
          zIndex: 0,
        }}
      />
      {img}
    </div>
  );
}
