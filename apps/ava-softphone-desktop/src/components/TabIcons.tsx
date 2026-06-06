import React from 'react';

/**
 * Tiny refined outline icon set for the bottom tab bar.
 * Inline SVG — no extra dependency. Stroke 1.5, 22px viewbox.
 */

interface Props {
  size?: number;
  color?: string;
  strokeWidth?: number;
}

const base = (size: number, color: string, strokeWidth: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function PhoneIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function ClockIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function UsersIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

export function VoicemailIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <circle cx="6" cy="12" r="4" />
      <circle cx="18" cy="12" r="4" />
      <line x1="6" y1="16" x2="18" y2="16" />
    </svg>
  );
}

export function MessageIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function DiscIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SparkleIcon({ size = 20, color = 'currentColor', strokeWidth = 1.5 }: Props) {
  return (
    <svg {...base(size, color, strokeWidth)}>
      <path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
      <path d="M19 16l.7 1.8L21.5 18.5l-1.8.7L19 21l-.7-1.8L16.5 18.5l1.8-.7z" />
    </svg>
  );
}
