/**
 * useAutoSync — keeps mobile data fresh with PBX.
 *
 * - Hydrates from localStorage cache instantly so screens paint immediately.
 * - Refetches on mount.
 * - Refetches on app foreground (Capacitor App `appStateChange`).
 * - Refetches on a configurable interval (default 60s) while foregrounded.
 * - Pauses interval when the app is backgrounded to save battery.
 * - Aborts in-flight requests when deps change to avoid stale writes.
 */
import { useEffect, useRef, useState, useCallback } from 'react';

const CACHE_PREFIX = 'ava.mobile.cache.';

function readCache<T>(key?: string): T | null {
  if (!key) return null;
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch { return null; }
}
function writeCache<T>(key: string | undefined, value: T) {
  if (!key) return;
  try { localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(value)); } catch {}
}

export function useAutoSync<T>(
  loader: (signal?: AbortSignal) => Promise<T>,
  opts: { intervalMs?: number; deps?: unknown[]; cacheKey?: string } = {},
) {
  const { intervalMs = 60_000, deps = [], cacheKey } = opts;
  const [data, setData] = useState<T | null>(() => readCache<T>(cacheKey));
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const next = await loaderRef.current(ac.signal);
      if (!mounted.current || ac.signal.aborted) return;
      setData(next); setError(null); setLastSyncedAt(Date.now());
      writeCache(cacheKey, next);
    } catch (e: any) {
      if (!mounted.current || ac.signal.aborted) return;
      if (e?.name === 'AbortError') return;
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (mounted.current && !ac.signal.aborted) setLoading(false);
    }
  }, [cacheKey]);

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
      } catch { /* ignore */ }
    })();

    return () => {
      mounted.current = false;
      stop();
      unsubAppState();
      abortRef.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, lastSyncedAt, refresh };
}
