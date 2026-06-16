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
    // Base surfaces
    bg: '#f6f8fc',
    bgGradient:
      'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.06), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(102,128,255,0.05), transparent 55%), #f6f8fc',
    bgCard: '#ffffff',
    bgCardHover: '#eef2f9',
    bgElev: '#ffffff',
    border: '#e3e8f1',
    borderGold: '#e7c980',
    borderAI: '#cdbcff',

    // Brand
    primary: '#0023e6',
    primaryLight: '#6680ff',
    primarySoft: '#e6ebff',

    // Accents (re-tuned for white background contrast)
    gold: '#b8860b',
    goldSoft: '#d4a73a',
    goldDim: '#fff3d6',
    ai: '#7a4cff',
    aiLight: '#a78bfa',
    aiGlow: 'rgba(122,76,255,0.18)',

    // Status
    green: '#16a34a',
    red: '#dc2626',
    yellow: '#d97706',
    success: '#16a34a',
    warning: '#d97706',
    danger: '#dc2626',

    // Text
    text: '#0f172a',
    textSub: '#475569',
    textDim: '#94a3b8',

    // Console aliases (kept so legacy screens map onto the new palette)
    midnight: '#f6f8fc',
    deepPanel: '#ffffff',
    graphite: '#f8fafc',
    lemtelBlue: '#0023e6',
    signalGold: '#b8860b',
    avaCyan: '#0891b2',
    avaViolet: '#7a4cff',
    textIce: '#0f172a',
    mutedSilver: '#64748b',
  },
  glow: {
    gold: '0 8px 20px -10px rgba(184,134,11,0.35)',
    blue: '0 8px 24px -12px rgba(0,35,230,0.35)',
    ai: '0 8px 22px -10px rgba(122,76,255,0.30)',
    green: '0 6px 18px -8px rgba(22,163,74,0.35)',
    red: '0 6px 18px -8px rgba(220,38,38,0.35)',
  },
  glass: {
    card: {
      background: '#ffffff',
      border: '1px solid #e3e8f1',
      borderRadius: 16,
      boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 8px 24px -12px rgba(15,23,42,0.10)',
    } as React.CSSProperties,
    cardGold: {
      background: '#ffffff',
      border: '1px solid #e7c980',
      borderRadius: 16,
      boxShadow: '0 8px 22px -14px rgba(184,134,11,0.30)',
    } as React.CSSProperties,
    cardAI: {
      background: '#ffffff',
      border: '1px solid #cdbcff',
      borderRadius: 16,
      boxShadow: '0 8px 22px -14px rgba(122,76,255,0.28)',
    } as React.CSSProperties,
  },
  font: { xs: 10, sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 12, lg: 16, xl: 20 },
} as const;
