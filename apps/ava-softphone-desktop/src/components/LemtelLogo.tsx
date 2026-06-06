import React from 'react';

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
 * Lemtel "L + WiFi Signal" wordmark SVG
 * Blue L with gold wifi arcs — single source of truth for brand mark.
 */
export default function LemtelLogo({
  size = 'sm',
  glow = true,
  shape = 'circle',
  className,
  style,
}: Props) {
  const s = SIZE_PX[size];
  const filter = glow
    ? 'drop-shadow(0 2px 10px rgba(255,215,0,0.35))'
    : undefined;

  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0, filter, ...style }}
    >
      <svg
        width={s}
        height={s}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: 'block' }}
      >
        {shape === 'square' ? (
          <rect x="6" y="6" width="108" height="108" rx="22" ry="22"
            fill="url(#lemtelSquareFill)" stroke="rgba(255,215,0,0.32)" strokeWidth="1.5" />
        ) : (
          <circle cx="60" cy="60" r="56" fill="#0A1530" stroke="rgba(255,215,0,0.18)" strokeWidth="1.5" />
        )}
        <defs>
          <linearGradient id="lemtelSquareFill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#0052CC" />
            <stop offset="100%" stopColor="#0A1530" />
          </linearGradient>
        </defs>

        {/* L shape — blue */}
        <path
          d="M34 28 h14 v38 h20 v12 h-34 z"
          fill="#003DA6"
          stroke="#003DA6"
          strokeWidth="2"
          strokeLinejoin="round"
        />
        <path
          d="M36 30 h10 v36 h18 v8 h-28 z"
          fill="#002d7a"
        />

        {/* WiFi signal arcs — gold, emanating from upper-right of L */}
        <path
          d="M62 34 Q82 20 102 34"
          stroke="#FFD700"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M58 44 Q82 28 106 44"
          stroke="#FFD700"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M54 54 Q82 36 110 54"
          stroke="#FFD700"
          strokeWidth="3.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* Subtle gold dot at signal origin */}
        <circle cx="62" cy="34" r="2.5" fill="#FFD700" />
      </svg>
    </span>
  );
}
