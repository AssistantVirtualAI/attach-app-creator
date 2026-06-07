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
  root.style.setProperty('--lemtel-text-boost',
    c === 'low' ? '0.78' : c === 'high' ? '1.0' : '0.92');
  root.style.filter =
    c === 'low' ? 'contrast(0.96) brightness(0.98)'
    : c === 'high' ? 'contrast(1.10) brightness(1.02)'
    : 'none';
  // Toggle a global class so CSS can deliver a true high-contrast theme
  // that overrides button colors, row backgrounds, and text shadows.
  root.classList.toggle('lemtel-hc', c === 'high');
  root.classList.toggle('lemtel-low', c === 'low');
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
