import React, { createContext, useContext, useEffect, useState } from 'react';

export type ThemeMode = 'dark' | 'light';

export interface ThemeTokens {
  mode: ThemeMode;
  bg: string;
  bgGradient: string;
  surface: string;
  surfaceElev: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentSoft: string;
  accentGradient: string;
  accentGlow: string;
  success: string;
  danger: string;
  warning: string;
  ringGlow: string;
  glass: string;
  glassBorder: string;
  shadow: string;
}

const dark: ThemeTokens = {
  mode: 'dark',
  bg: '#0a0b12',
  bgGradient:
    'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.18), transparent 60%), radial-gradient(800px 500px at 110% 110%, rgba(236,72,153,0.12), transparent 55%), #0a0b12',
  surface: 'rgba(20,23,34,0.72)',
  surfaceElev: 'rgba(28,32,46,0.85)',
  surfaceHover: 'rgba(255,255,255,0.06)',
  border: 'rgba(255,255,255,0.07)',
  borderStrong: 'rgba(255,255,255,0.14)',
  text: '#f5f7fb',
  textMuted: 'rgba(245,247,251,0.62)',
  textSubtle: 'rgba(245,247,251,0.38)',
  accent: '#818cf8',
  accentSoft: 'rgba(129,140,248,0.16)',
  accentGradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
  accentGlow: '0 8px 32px -8px rgba(99,102,241,0.55)',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  ringGlow: '0 0 0 4px rgba(99,102,241,0.18)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(255,255,255,0.08)',
  shadow: '0 12px 40px -16px rgba(0,0,0,0.6)',
};

const light: ThemeTokens = {
  mode: 'light',
  bg: '#f4f6fb',
  bgGradient:
    'radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(800px 500px at 110% 110%, rgba(236,72,153,0.07), transparent 55%), #f4f6fb',
  surface: 'rgba(255,255,255,0.85)',
  surfaceElev: '#ffffff',
  surfaceHover: 'rgba(15,18,28,0.04)',
  border: 'rgba(15,18,28,0.08)',
  borderStrong: 'rgba(15,18,28,0.16)',
  text: '#0f121c',
  textMuted: 'rgba(15,18,28,0.62)',
  textSubtle: 'rgba(15,18,28,0.42)',
  accent: '#6366f1',
  accentSoft: 'rgba(99,102,241,0.12)',
  accentGradient: 'linear-gradient(135deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
  accentGlow: '0 8px 32px -8px rgba(99,102,241,0.35)',
  success: '#059669',
  danger: '#dc2626',
  warning: '#d97706',
  ringGlow: '0 0 0 4px rgba(99,102,241,0.14)',
  glass: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(15,18,28,0.06)',
  shadow: '0 12px 40px -16px rgba(15,18,28,0.18)',
};

interface ThemeCtx {
  t: ThemeTokens;
  mode: ThemeMode;
  setMode: (m: ThemeMode) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeCtx | null>(null);
const STORAGE_KEY = 'ava-softphone-theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY) as ThemeMode | null;
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return 'light';
  });

  const t = mode === 'dark' ? dark : light;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {}
    document.documentElement.style.background = t.bg;
    document.documentElement.style.color = t.text;
    document.body.style.background = t.bg;
    document.body.style.color = t.text;
  }, [mode, t]);

  const setMode = (m: ThemeMode) => setModeState(m);
  const toggle = () => setModeState((m) => (m === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ t, mode, setMode, toggle }}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

/* ============================================================
   v1.0.4 Design Tokens — Lemtel dark glassmorphism + AI glow
   Plain object, imported as `import { theme } from '../lib/theme'`.
   ============================================================ */
export const theme = {
  colors: {
    // Lighter, elegant glass palette — soft blue gradient, gold accents, AI shimmer
    bg: '#EEF3FB',
    bgGradient:
      'radial-gradient(1100px 700px at 12% -10%, rgba(0,82,204,0.18), transparent 60%), radial-gradient(900px 600px at 100% 110%, rgba(255,215,0,0.14), transparent 55%), linear-gradient(180deg, #F5F8FD 0%, #E6EEFA 100%)',
    bgCard: 'rgba(255,255,255,0.72)',
    bgCardHover: 'rgba(255,255,255,0.92)',
    bgElev: 'rgba(255,255,255,0.88)',
    border: 'rgba(0,61,166,0.10)',
    borderGold: 'rgba(255,196,0,0.45)',
    borderAI: 'rgba(124,58,237,0.32)',
    primary: '#0052CC',
    primaryLight: '#2D7BE5',
    gold: '#E0A800',
    goldSoft: '#F2C94C',
    goldDim: 'rgba(255,196,0,0.22)',
    ai: '#7C3AED',
    aiLight: '#9D6FF0',
    aiGlow: 'rgba(124,58,237,0.22)',
    green: '#0FA471',
    red: '#DC2626',
    yellow: '#D97706',
    text: '#0E1B3D',
    textSub: '#42547A',
    textDim: 'rgba(14,27,61,0.48)',
    // Console tokens — lifted, light glass
    midnight: '#EEF3FB',
    deepPanel: 'rgba(255,255,255,0.82)',
    graphite: 'rgba(255,255,255,0.72)',
    lemtelBlue: '#0052CC',
    signalGold: '#E0A800',
    avaCyan: '#0BB5D6',
    avaViolet: '#7A4CFF',
    textIce: '#0E1B3D',
    mutedSilver: '#5A6B8C',
    success: '#0FA471',
    warning: '#D97706',
    danger: '#DC2626',
  },
  glow: {
    gold: '0 6px 24px -6px rgba(224,168,0,0.45)',
    blue: '0 8px 28px -8px rgba(0,82,204,0.40)',
    ai: '0 8px 24px -6px rgba(124,58,237,0.30)',
    green: '0 6px 18px -4px rgba(15,164,113,0.35)',
    red: '0 6px 18px -4px rgba(220,38,38,0.35)',
  },
  glass: {
    card: {
      background: 'rgba(255,255,255,0.72)',
      border: '1px solid rgba(0,61,166,0.10)',
      borderRadius: 16,
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      boxShadow: '0 10px 40px -18px rgba(0,61,166,0.25)',
    } as React.CSSProperties,
    cardGold: {
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(255,196,0,0.45)',
      borderRadius: 16,
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      boxShadow: '0 12px 36px -16px rgba(224,168,0,0.30)',
    } as React.CSSProperties,
    cardAI: {
      background: 'rgba(255,255,255,0.78)',
      border: '1px solid rgba(124,58,237,0.30)',
      borderRadius: 16,
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
      boxShadow: '0 12px 36px -16px rgba(124,58,237,0.25)',
    } as React.CSSProperties,
  },
  font: { xs: 10, sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
} as const;

