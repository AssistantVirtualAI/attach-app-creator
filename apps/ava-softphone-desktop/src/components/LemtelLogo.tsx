import React from 'react';
import lemtelIcon from '../assets/lemtel-icon.png';


export type LemtelLogoSize = 'xs' | 'sm' | 'md' | 'lg';

const SIZE_PX: Record<LemtelLogoSize, number> = {
  xs: 22,
  sm: 32,
  md: 56,
  lg: 110,
};

interface Props {
  size?: LemtelLogoSize;
  glow?: boolean;
  halo?: boolean;
  shape?: 'circle' | 'square';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Official Lemtel "L + WiFi" brand mark — rendered from the canonical PNG asset
 * so it matches the mobile app and store icon exactly.
 */
export default function LemtelLogo({
  size = 'sm',
  glow = true,
  className,
  style,
}: Props) {
  const s = SIZE_PX[size];
  const filter = glow
    ? 'drop-shadow(0 4px 18px rgba(255,215,0,0.35))'
    : undefined;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, filter, ...style }}
    >
      <img
        src="/lemtel-icon.png"
        alt="Lemtel"
        width={s}
        height={s}
        style={{ display: 'block', width: s, height: s, objectFit: 'contain', borderRadius: Math.round(s * 0.22) }}
      />
    </span>
  );
}
