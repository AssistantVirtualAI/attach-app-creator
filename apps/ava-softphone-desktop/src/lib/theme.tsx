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
  bg: '#05060d',
  bgGradient:
    'radial-gradient(1400px 700px at 8% -12%, rgba(0,35,230,0.20), transparent 60%), radial-gradient(900px 600px at 108% 110%, rgba(124,76,255,0.14), transparent 55%), linear-gradient(180deg, #05060d 0%, #07091a 100%)',
  surface: 'rgba(255,255,255,0.04)',
  surfaceElev: 'rgba(255,255,255,0.06)',
  surfaceHover: 'rgba(0,35,230,0.10)',
  border: 'rgba(140,170,255,0.10)',
  borderStrong: 'rgba(140,170,255,0.22)',
  text: '#eaf0ff',
  textMuted: 'rgba(234,240,255,0.62)',
  textSubtle: 'rgba(234,240,255,0.38)',
  accent: '#3355ff',
  accentSoft: 'rgba(0,35,230,0.16)',
  accentGradient: 'linear-gradient(135deg, #0023e6 0%, #6680ff 60%, #a78bfa 100%)',
  accentGlow: '0 10px 36px -10px rgba(0,35,230,0.55)',
  success: '#22d39a',
  danger: '#ff5577',
  warning: '#ffb84a',
  ringGlow: '0 0 0 3px rgba(0,35,230,0.28)',
  glass: 'rgba(255,255,255,0.04)',
  glassBorder: 'rgba(140,170,255,0.12)',
  shadow: '0 18px 60px -22px rgba(0,0,0,0.7)',
};


const light: ThemeTokens = {
  mode: 'light',
  bg: '#f4f6fb',
  bgGradient:
    'radial-gradient(1200px 600px at 10% -10%, rgba(0,35,230,0.10), transparent 60%), radial-gradient(800px 500px at 110% 110%, rgba(236,72,153,0.07), transparent 55%), #f4f6fb',
  surface: 'rgba(255,255,255,0.85)',
  surfaceElev: '#ffffff',
  surfaceHover: 'rgba(15,18,28,0.04)',
  border: 'rgba(15,18,28,0.08)',
  borderStrong: 'rgba(15,18,28,0.16)',
  text: '#0f121c',
  textMuted: 'rgba(15,18,28,0.62)',
  textSubtle: 'rgba(15,18,28,0.42)',
  accent: '#0023e6',
  accentSoft: 'rgba(0,35,230,0.12)',
  accentGradient: 'linear-gradient(135deg, #0023e6 0%, #6680ff 50%, #a78bfa 100%)',
  accentGlow: '0 8px 32px -8px rgba(0,35,230,0.32)',
  success: '#059669',
  danger: '#dc2626',
  warning: '#d97706',
  ringGlow: '0 0 0 4px rgba(0,35,230,0.14)',
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
    return 'dark';
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
    // Aligned with AVA Statistic portal — primary #0023e6 (HSL 231 100% 50%).
    bg: '#05060d',
    bgGradient:
      'radial-gradient(1400px 700px at 8% -12%, rgba(0,35,230,0.20), transparent 60%), radial-gradient(900px 600px at 108% 110%, rgba(124,76,255,0.16), transparent 55%), linear-gradient(180deg, #05060d 0%, #07091a 100%)',
    bgCard: 'rgba(255,255,255,0.04)',
    bgCardHover: 'rgba(255,255,255,0.07)',
    bgElev: 'rgba(255,255,255,0.06)',
    border: 'rgba(140,170,255,0.10)',
    borderGold: 'rgba(255,184,74,0.45)',
    borderAI: 'rgba(124,76,255,0.32)',
    primary: '#0023e6',
    primaryLight: '#6680ff',
    gold: '#ffb84a',
    goldSoft: '#ffd07a',
    goldDim: 'rgba(255,184,74,0.18)',
    ai: '#7a4cff',
    aiLight: '#a78bfa',
    aiGlow: 'rgba(122,76,255,0.28)',
    green: '#22d39a',
    red: '#ff5577',
    yellow: '#ffb84a',
    text: '#eaf0ff',
    textSub: '#9eabd4',
    textDim: 'rgba(234,240,255,0.40)',
    // Console tokens — dark glass layers
    midnight: '#05060d',
    deepPanel: 'rgba(11,16,30,0.78)',
    graphite: 'rgba(18,24,42,0.66)',
    lemtelBlue: '#0023e6',
    signalGold: '#ffb84a',
    avaCyan: '#23d6ff',
    avaViolet: '#7a4cff',
    textIce: '#eaf0ff',
    mutedSilver: 'rgba(234,240,255,0.55)',
    success: '#22d39a',
    warning: '#ffb84a',
    danger: '#ff5577',
  },
  glow: {
    gold: '0 8px 28px -8px rgba(255,184,74,0.45)',
    blue: '0 10px 36px -10px rgba(0,35,230,0.55)',
    ai: '0 10px 30px -8px rgba(122,76,255,0.45)',
    green: '0 8px 22px -6px rgba(34,211,154,0.45)',
    red: '0 8px 22px -6px rgba(255,85,119,0.45)',
  },
  glass: {
    card: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(140,170,255,0.12)',
      borderRadius: 16,
      backdropFilter: 'blur(22px) saturate(160%)',
      WebkitBackdropFilter: 'blur(22px) saturate(160%)',
      boxShadow: '0 18px 60px -22px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
    } as React.CSSProperties,
    cardGold: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(255,184,74,0.40)',
      borderRadius: 16,
      backdropFilter: 'blur(22px) saturate(160%)',
      WebkitBackdropFilter: 'blur(22px) saturate(160%)',
      boxShadow: '0 18px 60px -22px rgba(255,184,74,0.30)',
    } as React.CSSProperties,
    cardAI: {
      background: 'rgba(255,255,255,0.05)',
      border: '1px solid rgba(124,76,255,0.36)',
      borderRadius: 16,
      backdropFilter: 'blur(22px) saturate(160%)',
      WebkitBackdropFilter: 'blur(22px) saturate(160%)',
      boxShadow: '0 18px 60px -22px rgba(124,76,255,0.35)',
    } as React.CSSProperties,
  },
  font: { xs: 10, sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
} as const;


