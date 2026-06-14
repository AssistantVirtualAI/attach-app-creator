import type React from 'react';
/**
 * Lemtel AI Phone — Mobile design tokens.
 * Light glass UI: airy white surfaces, Lemtel blue + signal gold + AVA cyan/violet AI shimmer.
 */
export const colors = {
  // Light foundation
  midnight:   '#EEF3FB',
  midnight2:  '#F5F8FD',
  graphite:   'rgba(255,255,255,0.78)',
  graphite2:  'rgba(255,255,255,0.92)',
  // Brand — aligned with AVA Statistic portal (primary #0023e6)
  lemtelBlue: '#0023e6',
  blueGlow:   '#2a4dff',
  signalGold: '#E0A800',
  goldSoft:   '#F2C94C',
  // AI shimmer
  avaCyan:    '#23d6ff',
  avaViolet:  '#7A4CFF',
  // Text on light
  textIce:    '#0E1B3D',
  textSub:    '#42547A',
  mutedSilver:'#5A6B8C',
  // Lines
  border:     'rgba(0,35,230,0.10)',
  borderGold: 'rgba(255,196,0,0.45)',
  borderAI:   'rgba(122,76,255,0.32)',
  // State
  danger:     '#DC2626',
  success:    '#0FA471',
  warning:    '#D97706',
} as const;

export const gradients = {
  app:    `radial-gradient(1000px 620px at 6% -12%, rgba(0,35,230,0.18), transparent 62%), radial-gradient(780px 560px at 105% 105%, rgba(224,168,0,0.16), transparent 58%), linear-gradient(180deg, #F9FBFF 0%, #EDF3FB 52%, #E6EFFA 100%)`,
  call:   `linear-gradient(135deg, ${colors.lemtelBlue} 0%, ${colors.blueGlow} 50%, ${colors.signalGold} 140%)`,
  ai:     `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`,
  card:   `linear-gradient(155deg, rgba(255,255,255,0.78) 0%, rgba(255,255,255,0.62) 100%)`,
  hero:   `linear-gradient(160deg, rgba(0,35,230,0.20) 0%, rgba(42,77,255,0.10) 45%, rgba(255,255,255,0.0) 100%)`,
  shiny:  `linear-gradient(135deg, rgba(255,255,255,0.96) 0%, rgba(235,243,253,0.78) 45%, rgba(255,255,255,0.92) 100%)`,
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
  card: '0 12px 34px -18px rgba(0,35,230,0.24)',
  lift: '0 22px 48px -22px rgba(0,35,230,0.38)',
  gold: '0 14px 36px -16px rgba(224,168,0,0.40)',
  ai:   '0 14px 36px -16px rgba(122,76,255,0.40)',
  glass: '0 8px 24px -10px rgba(0,35,230,0.20), inset 0 1px 0 rgba(255,255,255,0.7)',
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

