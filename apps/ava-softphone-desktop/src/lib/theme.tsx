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

/* ============================================================
   AVA Statistic — Logo-aligned palette
   Deep brand blue #0023e6 → bright #4d6dff → aurora cyan #21d4fd
   Signal gold #d4a73a for premium accents
   ============================================================ */

const light: ThemeTokens = {
  mode: 'light',
  bg: '#eef2fa',
  bgGradient:
    'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.10), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(33,212,253,0.10), transparent 55%), linear-gradient(180deg, #eef2fa 0%, #dde4f1 100%)',
  surface: 'rgba(255,255,255,0.82)',
  surfaceElev: 'rgba(255,255,255,0.92)',
  surfaceHover: 'rgba(255,255,255,0.98)',
  border: 'rgba(180,196,224,0.55)',
  borderStrong: 'rgba(120,142,184,0.55)',
  text: '#0b1530',
  textMuted: '#3b4a6b',
  textSubtle: '#7d8aa6',
  accent: '#0023e6',
  accentSoft: 'rgba(0,35,230,0.10)',
  accentGradient: 'linear-gradient(135deg, #0023e6 0%, #4d6dff 45%, #21d4fd 100%)',
  accentGlow: '0 10px 30px -12px rgba(0,35,230,0.45)',
  success: '#0f9d58',
  danger: '#dc2626',
  warning: '#d97706',
  ringGlow: '0 0 0 3px rgba(0,35,230,0.22)',
  glass: 'rgba(255,255,255,0.80)',
  glassBorder: 'rgba(180,196,224,0.55)',
  shadow: '0 1px 2px rgba(11,21,48,0.06), 0 10px 28px -12px rgba(11,21,48,0.18)',
};

const dark: ThemeTokens = {
  mode: 'dark',
  bg: '#0b1124',
  bgGradient:
    'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.22), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(33,212,253,0.14), transparent 55%), linear-gradient(180deg, #0b1124 0%, #131a35 100%)',
  surface: 'rgba(255,255,255,0.05)',
  surfaceElev: 'rgba(255,255,255,0.08)',
  surfaceHover: 'rgba(255,255,255,0.12)',
  border: 'rgba(180,200,255,0.14)',
  borderStrong: 'rgba(180,200,255,0.28)',
  text: '#eaf0ff',
  textMuted: 'rgba(234,240,255,0.70)',
  textSubtle: 'rgba(234,240,255,0.46)',
  accent: '#6680ff',
  accentSoft: 'rgba(0,35,230,0.22)',
  accentGradient: 'linear-gradient(135deg, #0023e6 0%, #4d6dff 45%, #21d4fd 100%)',
  accentGlow: '0 10px 36px -10px rgba(0,35,230,0.60)',
  success: '#22d39a',
  danger: '#ff5577',
  warning: '#ffb84a',
  ringGlow: '0 0 0 3px rgba(102,128,255,0.32)',
  glass: 'rgba(20,28,56,0.55)',
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
   Static design tokens consumed via `import { theme } from '../lib/theme'`.
   These are the LIGHT defaults. Components that read theme.colors.*
   pick up the refresh automatically.
   ============================================================ */
export const theme = {
  colors: {
    // Base surfaces — medium-light frosted, futuristic
    bg: '#eef2fa',
    bgGradient:
      'radial-gradient(1200px 700px at 8% -10%, rgba(0,35,230,0.10), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(33,212,253,0.10), transparent 55%), linear-gradient(180deg, #eef2fa 0%, #dde4f1 100%)',
    bgMesh:
      'radial-gradient(1000px 600px at 8% -10%, rgba(0,35,230,0.08), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(33,212,253,0.08), transparent 55%)',
    bgCard: 'rgba(255,255,255,0.85)',
    bgCardHover: 'rgba(255,255,255,0.95)',
    bgElev: 'rgba(255,255,255,0.92)',
    border: 'rgba(180,196,224,0.55)',
    borderStrong: 'rgba(120,142,184,0.55)',
    borderGold: 'rgba(224,193,120,0.70)',
    borderAI: 'rgba(191,176,255,0.70)',

    // Brand — from AVA Statistic logo
    primary: '#0023e6',
    primaryLight: '#4d6dff',
    primarySoft: 'rgba(0,35,230,0.10)',
    cyan: '#21d4fd',

    // Accents
    gold: '#d4a73a',
    goldSoft: '#e8c878',
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

    // Console aliases — kept for back-compat with existing views
    midnight: '#eef2fa',
    deepPanel: 'rgba(255,255,255,0.78)',
    graphite: 'rgba(245,247,252,0.88)',
    lemtelBlue: '#0023e6',
    signalGold: '#d4a73a',
    avaCyan: '#0891b2',
    avaViolet: '#7a4cff',
    textIce: '#0b1530',
    mutedSilver: '#5e6c8a',
  },
  gradients: {
    aurora: 'linear-gradient(135deg, #0023e6 0%, #4d6dff 45%, #21d4fd 100%)',
    auroraSubtle: 'linear-gradient(135deg, rgba(0,35,230,0.18), rgba(33,212,253,0.12))',
    goldEdge: 'linear-gradient(135deg, #d4a73a, #e8c878 60%, #fff3d6)',
    mesh:
      'radial-gradient(1000px 600px at 8% -10%, rgba(0,35,230,0.08), transparent 60%), radial-gradient(900px 600px at 110% 110%, rgba(33,212,253,0.08), transparent 55%)',
  },
  glow: {
    gold: '0 8px 22px -10px rgba(212,167,58,0.45)',
    blue: '0 10px 30px -12px rgba(0,35,230,0.45)',
    blueStrong: '0 18px 44px -18px rgba(0,35,230,0.55)',
    ai: '0 10px 26px -10px rgba(122,76,255,0.35)',
    green: '0 8px 20px -8px rgba(15,157,88,0.40)',
    red: '0 8px 20px -8px rgba(220,38,38,0.40)',
  },
  glass: {
    card: {
      background: 'rgba(255,255,255,0.82)',
      border: '1px solid rgba(180,196,224,0.55)',
      borderRadius: 16,
      boxShadow: '0 1px 2px rgba(11,21,48,0.06), 0 10px 28px -12px rgba(11,21,48,0.18)',
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
    } as React.CSSProperties,
    cardGold: {
      background: 'rgba(255,255,255,0.82)',
      border: '1px solid rgba(224,193,120,0.70)',
      borderRadius: 16,
      boxShadow: '0 10px 26px -14px rgba(212,167,58,0.40)',
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
    } as React.CSSProperties,
    cardAI: {
      background: 'rgba(255,255,255,0.82)',
      border: '1px solid rgba(191,176,255,0.70)',
      borderRadius: 16,
      boxShadow: '0 10px 26px -14px rgba(122,76,255,0.35)',
      backdropFilter: 'blur(14px) saturate(140%)',
      WebkitBackdropFilter: 'blur(14px) saturate(140%)',
    } as React.CSSProperties,
    nav: {
      background: 'rgba(255,255,255,0.72)',
      borderRight: '1px solid rgba(180,196,224,0.55)',
      backdropFilter: 'blur(18px) saturate(160%)',
      WebkitBackdropFilter: 'blur(18px) saturate(160%)',
    } as React.CSSProperties,
    dock: {
      background: 'rgba(255,255,255,0.88)',
      border: '1px solid rgba(180,196,224,0.70)',
      borderRadius: 20,
      boxShadow: '0 24px 60px -22px rgba(0,35,230,0.40), 0 2px 6px rgba(11,21,48,0.08)',
      backdropFilter: 'blur(20px) saturate(160%)',
      WebkitBackdropFilter: 'blur(20px) saturate(160%)',
    } as React.CSSProperties,
  },
  motion: {
    fast: '160ms cubic-bezier(.2,.7,.2,1)',
    base: '240ms cubic-bezier(.2,.7,.2,1)',
    slow: '360ms cubic-bezier(.2,.7,.2,1)',
  },
  font: {
    display: "'Space Grotesk', 'DM Sans', sans-serif",
    body: "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    mono: "'JetBrains Mono', ui-monospace, monospace",
    xs: 11, sm: 12, base: 14, md: 16, lg: 20, xl: 24, xxl: 32, display: 40,
  },
  radius: { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 },
} as const;
