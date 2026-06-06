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
