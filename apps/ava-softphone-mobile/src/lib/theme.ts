import type React from 'react';
/**
 * Lemtel AI Phone — Mobile design tokens.
 * Dark cyberpunk glass UI: deep navy surfaces, Lemtel blue + signal gold + AVA cyan/violet AI shimmer.
 */
export const colors = {
  // Dark foundation
  midnight:   '#0A1429',
  midnight2:  '#0E1B3D',
  graphite:   'rgba(255,255,255,0.06)',
  graphite2:  'rgba(255,255,255,0.10)',
  // Brand — aligned with AVA Statistic portal (primary #0023e6)
  lemtelBlue: '#0023e6',
  blueGlow:   '#2a4dff',
  signalGold: '#E0A800',
  goldSoft:   '#F2C94C',
  // AI shimmer
  avaCyan:    '#23d6ff',
  avaViolet:  '#7A4CFF',
  // Text on dark
  textIce:    '#E8EEFB',
  textSub:    '#B0BACC',
  mutedSilver:'#7C8AA8',
  // Lines
  border:     'rgba(255,255,255,0.08)',
  borderGold: 'rgba(255,196,0,0.45)',
  borderAI:   'rgba(122,76,255,0.40)',
  // State
  danger:     '#EF4444',
  success:    '#10B981',
  warning:    '#F59E0B',
} as const;

export const gradients = {
  app:    `radial-gradient(1000px 620px at 6% -12%, rgba(0,35,230,0.32), transparent 62%), radial-gradient(780px 560px at 105% 105%, rgba(224,168,0,0.18), transparent 58%), linear-gradient(180deg, #060C1C 0%, #0A1429 52%, #0E1B3D 100%)`,
  call:   `linear-gradient(135deg, ${colors.lemtelBlue} 0%, ${colors.blueGlow} 50%, ${colors.signalGold} 140%)`,
  ai:     `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`,
  card:   `linear-gradient(155deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.03) 100%)`,
  hero:   `linear-gradient(160deg, rgba(0,35,230,0.32) 0%, rgba(42,77,255,0.16) 45%, rgba(255,255,255,0.0) 100%)`,
  shiny:  `linear-gradient(135deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.08) 100%)`,
  shinyPrimary: `linear-gradient(135deg, #0023e6 0%, #2a4dff 55%, #6680ff 100%)`,
} as const;

export const radius = { sm: 10, md: 14, lg: 18, xl: 24, xxl: 30, pill: 999 } as const;
export const space  = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 7: 32, 8: 40 } as const;

export const font = {
  family: `'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`,
  mono:   `'JetBrains Mono', 'SF Mono', ui-monospace, monospace`,
  xs: 10, sm: 11, base: 13, md: 15, lg: 18, xl: 22, xxl: 28, display: 34,
} as const;

export const shadow = {
  card: '0 12px 34px -18px rgba(0,0,0,0.6)',
  lift: '0 22px 48px -22px rgba(0,0,0,0.7)',
  gold: '0 14px 36px -16px rgba(224,168,0,0.40)',
  ai:   '0 14px 36px -16px rgba(122,76,255,0.40)',
  glass: '0 8px 24px -10px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.08)',
} as const;

export const glass = {
  surface: {
    background: gradients.card,
    border: `1px solid ${colors.border}`,
    backdropFilter: 'blur(18px) saturate(160%)',
    WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    boxShadow: shadow.card,
    borderRadius: radius.lg,
  } as React.CSSProperties,
} as const;
