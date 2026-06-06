import { useEffect, useState } from 'react';

export type Contrast = 'low' | 'med' | 'high';
const KEY = 'lemtel.contrast';
const listeners = new Set<(c: Contrast) => void>();

export function getContrast(): Contrast {
  try {
    const v = localStorage.getItem(KEY) as Contrast | null;
    if (v === 'low' || v === 'med' || v === 'high') return v;
  } catch {}
  return 'med';
}

export function setContrast(c: Contrast) {
  try { localStorage.setItem(KEY, c); } catch {}
  applyContrast(c);
  listeners.forEach((fn) => fn(c));
}

/**
 * Tunes a CSS variable that secondary text opacity can read, and adjusts
 * the document root filter for instant, readable contrast presets.
 * Keeps the blue/yellow palette untouched.
 */
export function applyContrast(c: Contrast) {
  const root = document.documentElement;
  // text boost variable consumed by .lemtel-soft classes (if any)
  root.style.setProperty('--lemtel-text-boost',
    c === 'low' ? '0.78' : c === 'high' ? '1.0' : '0.92');
  // tiny global contrast nudge — safe range, preserves color identity
  root.style.filter =
    c === 'low' ? 'contrast(0.96) brightness(0.98)'
    : c === 'high' ? 'contrast(1.08) brightness(1.04)'
    : 'none';
}

export function useContrast() {
  const [c, setC] = useState<Contrast>(() => getContrast());
  useEffect(() => {
    applyContrast(c);
    const fn = (nv: Contrast) => setC(nv);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { contrast: c, setContrast };
}
