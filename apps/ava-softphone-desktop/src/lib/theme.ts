/**
 * Lemtel Telecom — Design tokens v1.0.4
 * Dark glassmorphism + AI glow language.
 * Plain object, no React. For React-aware theming (light/dark toggle),
 * keep using `./theme.tsx`'s ThemeProvider in parallel.
 */
export const theme = {
  colors: {
    bg: '#050510',
    bgGradient:
      'radial-gradient(1100px 600px at 12% -10%, rgba(0,61,166,0.28), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(124,58,237,0.18), transparent 55%), radial-gradient(600px 400px at 50% 120%, rgba(255,215,0,0.06), transparent 60%), #050510',
    bgCard: 'rgba(255,255,255,0.04)',
    bgCardHover: 'rgba(255,255,255,0.07)',
    border: 'rgba(255,255,255,0.08)',
    borderGold: 'rgba(255,215,0,0.25)',
    borderAI: 'rgba(124,58,237,0.4)',
    primary: '#003DA6',
    primaryLight: '#0052CC',
    gold: '#FFD700',
    goldDim: 'rgba(255,215,0,0.15)',
    ai: '#7C3AED',
    aiLight: '#9D6FF0',
    aiGlow: 'rgba(124,58,237,0.3)',
    green: '#10B981',
    red: '#EF4444',
    yellow: '#F59E0B',
    text: '#FFFFFF',
    textSub: 'rgba(255,255,255,0.5)',
    textDim: 'rgba(255,255,255,0.25)',
  },
  glow: {
    gold: '0 0 20px rgba(255,215,0,0.3), 0 0 40px rgba(255,215,0,0.1)',
    blue: '0 0 20px rgba(0,61,166,0.5), 0 0 40px rgba(0,61,166,0.2)',
    ai: '0 0 20px rgba(124,58,237,0.4), 0 0 40px rgba(124,58,237,0.15)',
    green: '0 0 12px rgba(16,185,129,0.4)',
    red: '0 0 12px rgba(239,68,68,0.4)',
  },
  glass: {
    card: {
      background: 'rgba(255,255,255,0.04)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 16,
    } as React.CSSProperties,
    cardGold: {
      background: 'rgba(255,215,0,0.04)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(255,215,0,0.2)',
      borderRadius: 16,
    } as React.CSSProperties,
    cardAI: {
      background: 'rgba(124,58,237,0.06)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      border: '1px solid rgba(124,58,237,0.3)',
      borderRadius: 16,
    } as React.CSSProperties,
  },
  font: {
    xs: 10,
    sm: 12,
    base: 14,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
} as const;

export type Theme = typeof theme;
