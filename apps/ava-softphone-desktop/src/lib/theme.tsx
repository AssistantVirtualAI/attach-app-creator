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

/* Medium light — frosted graphite with cyan/blue/gold accents */
const light: ThemeTokens = {
  mode: 'light',
  bg: '#e9eef7',
  bgGradient:
    'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.10), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(8,145,178,0.10), transparent 55%), linear-gradient(180deg, #eef2fa 0%, #dde4f1 100%)',
  surface: '#ffffff',
  surfaceElev: '#f5f7fc',
  surfaceHover: '#e6ecf6',
  border: '#cdd6e6',
  borderStrong: '#a9b6cf',
  text: '#0b1530',
  textMuted: '#3b4a6b',
  textSubtle: '#7d8aa6',
  accent: '#0023e6',
  accentSoft: '#dde4ff',
  accentGradient: 'linear-gradient(135deg, #0023e6 0%, #4d6dff 60%, #21d4fd 100%)',
  accentGlow: '0 10px 30px -12px rgba(0,35,230,0.45)',
  success: '#0f9d58',
  danger: '#dc2626',
  warning: '#d97706',
  ringGlow: '0 0 0 3px rgba(0,35,230,0.22)',
  glass: 'rgba(255,255,255,0.78)',
  glassBorder: 'rgba(180,196,224,0.55)',
  shadow: '0 1px 2px rgba(11,21,48,0.06), 0 10px 28px -12px rgba(11,21,48,0.18)',
};

/* Soft dark — re-tuned, less pitch-black */
const dark: ThemeTokens = {
  mode: 'dark',
  bg: '#0f1424',
  bgGradient:
    'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.16), transparent 60%), linear-gradient(180deg, #0f1424 0%, #131932 100%)',
  surface: 'rgba(255,255,255,0.05)',
  surfaceElev: 'rgba(255,255,255,0.07)',
  surfaceHover: 'rgba(255,255,255,0.10)',
  border: 'rgba(180,200,255,0.14)',
  borderStrong: 'rgba(180,200,255,0.26)',
  text: '#eaf0ff',
  textMuted: 'rgba(234,240,255,0.66)',
  textSubtle: 'rgba(234,240,255,0.42)',
  accent: '#6680ff',
  accentSoft: 'rgba(0,35,230,0.20)',
  accentGradient: 'linear-gradient(135deg, #0023e6 0%, #6680ff 60%, #a78bfa 100%)',
  accentGlow: '0 10px 36px -10px rgba(0,35,230,0.55)',
  success: '#22d39a',
  danger: '#ff5577',
  warning: '#ffb84a',
  ringGlow: '0 0 0 3px rgba(102,128,255,0.30)',
  glass: 'rgba(255,255,255,0.05)',
  glassBorder: 'rgba(180,200,255,0.16)',
  shadow: '0 18px 60px -22px rgba(0,0,0,0.6)',
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
    try { localStorage.setItem(STORAGE_KEY, mode); } catch {}
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
   Design tokens consumed via `import { theme } from '../lib/theme'`.
   These are the LIGHT defaults. Components that read theme.colors.*
   pick up the refresh automatically. The dark variant above is used
   via the ThemeProvider toggle.
   ============================================================ */
export const theme = {
  colors: {
    // Base surfaces — medium light, frosted, futuristic
    bg: '#e9eef7',
    bgGradient:
      'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.10), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(8,145,178,0.10), transparent 55%), linear-gradient(180deg, #eef2fa 0%, #dde4f1 100%)',
    bgCard: '#ffffff',
    bgCardHover: '#eef2f9',
    bgElev: '#f5f7fc',
    border: '#cdd6e6',
    borderGold: '#e0c178',
    borderAI: '#bfb0ff',

    // Brand
    primary: '#0023e6',
    primaryLight: '#4d6dff',
    primarySoft: '#dde4ff',

    // Accents
    gold: '#b8860b',
    goldSoft: '#d4a73a',
    goldDim: '#fff3d6',
    ai: '#7a4cff',
    aiLight: '#a78bfa',
    aiGlow: 'rgba(122,76,255,0.20)',

    // Status
    green: '#0f9d58',
    red: '#dc2626',
    yellow: '#d97706',
    success: '#0f9d58',
    warning: '#d97706',
    danger: '#dc2626',

    // Text
    text: '#0b1530',
    textSub: '#3b4a6b',
    textDim: '#7d8aa6',

    // Console aliases — medium-dark rails for contrast on a medium-light app
    midnight: '#e9eef7',
    deepPanel: '#1b2440',
    graphite: '#243054',
    lemtelBlue: '#0023e6',
    signalGold: '#d4a73a',
    avaCyan: '#0891b2',
    avaViolet: '#7a4cff',
    textIce: '#0b1530',
    mutedSilver: '#5e6c8a',
  },
  glow: {
    gold: '0 8px 22px -10px rgba(212,167,58,0.45)',
    blue: '0 10px 28px -12px rgba(0,35,230,0.45)',
    ai: '0 10px 26px -10px rgba(122,76,255,0.35)',
    green: '0 8px 20px -8px rgba(15,157,88,0.40)',
    red: '0 8px 20px -8px rgba(220,38,38,0.40)',
  },
  glass: {
    card: {
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(180,196,224,0.55)',
      borderRadius: 16,
      boxShadow: '0 1px 2px rgba(11,21,48,0.06), 0 10px 28px -12px rgba(11,21,48,0.18)',
      backdropFilter: 'blur(12px)',
    } as React.CSSProperties,
    cardGold: {
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(224,193,120,0.70)',
      borderRadius: 16,
      boxShadow: '0 10px 26px -14px rgba(212,167,58,0.40)',
      backdropFilter: 'blur(12px)',
    } as React.CSSProperties,
    cardAI: {
      background: 'rgba(255,255,255,0.85)',
      border: '1px solid rgba(191,176,255,0.70)',
      borderRadius: 16,
      boxShadow: '0 10px 26px -14px rgba(122,76,255,0.35)',
      backdropFilter: 'blur(12px)',
    } as React.CSSProperties,
  },
  font: { xs: 10, sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
} as const;
