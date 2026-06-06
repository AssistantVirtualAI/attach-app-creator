import { useEffect, useState } from 'react';

export type Brightness = 'dim' | 'medium' | 'bright';
const KEY = 'lemtel.brightness';

const listeners = new Set<(b: Brightness) => void>();

export function getBrightness(): Brightness {
  try {
    const v = localStorage.getItem(KEY) as Brightness | null;
    if (v === 'dim' || v === 'medium' || v === 'bright') return v;
  } catch {}
  return 'medium';
}

export function setBrightness(b: Brightness) {
  try { localStorage.setItem(KEY, b); } catch {}
  listeners.forEach((fn) => fn(b));
}

// Overlay opacity per level — lifts the dark navy with a soft blue tint.
export const BRIGHTNESS_OVERLAY: Record<Brightness, number> = {
  dim: 0,
  medium: 0.07,
  bright: 0.16,
};

export function useBrightness() {
  const [b, setB] = useState<Brightness>(() => getBrightness());
  useEffect(() => {
    const fn = (nv: Brightness) => setB(nv);
    listeners.add(fn);
    return () => { listeners.delete(fn); };
  }, []);
  return { brightness: b, setBrightness };
}
