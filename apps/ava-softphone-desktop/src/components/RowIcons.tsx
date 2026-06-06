import React from 'react';

/** Refined inline SVG icons used inside list rows. Stroke 1.6. */
interface P { size?: number; color?: string; strokeWidth?: number }

const svg = (size: number, stroke: string, sw: number) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none',
  stroke, strokeWidth: sw, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const,
});

export function ArrowUpRight({ size = 14, color = 'currentColor', strokeWidth = 1.8 }: P) {
  return (
    <svg {...svg(size, color, strokeWidth)}>
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

export function ArrowDownLeft({ size = 14, color = 'currentColor', strokeWidth = 1.8 }: P) {
  return (
    <svg {...svg(size, color, strokeWidth)}>
      <path d="M17 7 7 17" />
      <path d="M16 17H7V8" />
    </svg>
  );
}

export function PhoneMissed({ size = 14, color = 'currentColor', strokeWidth = 1.8 }: P) {
  return (
    <svg {...svg(size, color, strokeWidth)}>
      <path d="m22 2-6 6" /><path d="m16 2 6 6" />
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.82.34 1.7.57 2.6.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}

export function PhoneCall({ size = 16, color = 'currentColor', strokeWidth = 1.8 }: P) {
  return (
    <svg {...svg(size, color, strokeWidth)}>
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.82.34 1.7.57 2.6.7A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
