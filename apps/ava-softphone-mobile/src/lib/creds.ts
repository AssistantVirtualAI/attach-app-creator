import { useEffect, useState, useCallback } from 'react';
import { Preferences } from '@capacitor/preferences';

export type Creds = {
  portalUrl?: string;
  email: string;
  extension: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  accessToken?: string;
  refreshToken?: string;
  userId?: string;
};

const KEY = 'lemtel.creds.v1';

// Lightweight Preferences shim — uses Capacitor when native, localStorage on web preview.
export const Store = {
  async get(): Promise<Creds | null> {
    try {
      if ((Preferences as any)?.get) {
        const { value } = await Preferences.get({ key: KEY });
        if (value) return JSON.parse(value);
      }
    } catch {}
    const v = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    return v ? JSON.parse(v) : null;
  },
  async set(c: Creds) {
    const v = JSON.stringify(c);
    try {
      if ((Preferences as any)?.set) {
        await Preferences.set({ key: KEY, value: v });
        return;
      }
    } catch {}
    if (typeof localStorage !== 'undefined') localStorage.setItem(KEY, v);
  },
  async clear() {
    try {
      if ((Preferences as any)?.remove) {
        await Preferences.remove({ key: KEY });
        return;
      }
    } catch {}
    if (typeof localStorage !== 'undefined') localStorage.removeItem(KEY);
  },
};

export const saveCredentials = (c: Creds) => Store.set(c);
export const getCredentials = () => Store.get();
export const clearCredentials = () => Store.clear();

export function useStoredCreds() {
  const [creds, setCredsState] = useState<Creds | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Store.get().then((c) => { setCredsState(c); setLoading(false); });
  }, []);

  const setCreds = useCallback((c: Creds) => {
    setCredsState(c);
    Store.set(c).catch(() => {});
  }, []);

  const clearCreds = useCallback(() => {
    setCredsState(null);
    Store.clear().catch(() => {});
  }, []);

  return { creds, setCreds, clearCreds, loading };
}
