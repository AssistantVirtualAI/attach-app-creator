/**
 * useAutoSync — keeps mobile data fresh with PBX.
 *
 * - Refetches on mount.
 * - Refetches on app foreground (Capacitor App `appStateChange`).
 * - Refetches on a configurable interval (default 60s) while foregrounded.
 * - Pauses interval when the app is backgrounded to save battery.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export function useAutoSync<T>(
  loader: () => Promise<T>,
  opts: { intervalMs?: number; deps?: unknown[] } = {},
) {
  const { intervalMs = 60_000, deps = [] } = opts;
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    setLoading(true);
    try {
      const next = await loaderRef.current();
      if (!mounted.current) return;
      setData(next); setError(null); setLastSyncedAt(Date.now());
    } catch (e: any) {
      if (!mounted.current) return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    let timer: ReturnType<typeof setInterval> | null = null;
    let unsubAppState: () => void = () => {};

    const start = () => {
      if (timer) return;
      timer = setInterval(() => { refresh(); }, intervalMs);
    };
    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    start();

    (async () => {
      try {
        const { Capacitor } = await import('@capacitor/core');
        if (Capacitor.isNativePlatform()) {
          const { App } = await import('@capacitor/app');
          const sub = await App.addListener('appStateChange', (s) => {
            if (s.isActive) { refresh(); start(); }
            else stop();
          });
          unsubAppState = () => sub.remove();
        } else {
          // Web fallback: refresh on tab focus.
          const onFocus = () => { refresh(); start(); };
          const onBlur = () => stop();
          window.addEventListener('focus', onFocus);
          window.addEventListener('blur', onBlur);
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') { refresh(); start(); }
            else stop();
          });
          unsubAppState = () => {
            window.removeEventListener('focus', onFocus);
            window.removeEventListener('blur', onBlur);
          };
        }
      } catch { /* ignore — env without Capacitor */ }
    })();

    return () => {
      mounted.current = false;
      stop();
      unsubAppState();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, lastSyncedAt, refresh };
}
