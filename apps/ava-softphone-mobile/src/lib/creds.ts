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
const Store = {
  async get(): Promise<Creds | null> {
    try {
      if ((Preferences as any)?.get) {
        const { value } = await Preferences.get({ key: KEY });
        return value ? JSON.parse(value) : null;
      }
    } catch {}
    const v = localStorage.getItem(KEY);
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
    localStorage.setItem(KEY, v);
  },
  async clear() {
    try {
      if ((Preferences as any)?.remove) {
        await Preferences.remove({ key: KEY });
        return;
      }
    } catch {}
    localStorage.removeItem(KEY);
  },
};

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
