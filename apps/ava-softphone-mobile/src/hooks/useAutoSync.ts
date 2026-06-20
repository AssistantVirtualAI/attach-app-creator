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
import { nextSyncId, syncBegin, syncSuccess, syncError, onSyncRefresh } from '../lib/syncStatus';

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

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function useAutoSync<T>(
  loader: (signal?: AbortSignal) => Promise<T>,
  opts: {
    intervalMs?: number;
    deps?: unknown[];
    cacheKey?: string;
    timeoutMs?: number;
    retries?: number;
    retryBaseMs?: number;
  } = {},
) {
  const {
    intervalMs = 60_000,
    deps = [],
    cacheKey,
    timeoutMs = 15_000,
    retries = 2,
    retryBaseMs = 800,
  } = opts;
  const [data, setData] = useState<T | null>(() => readCache<T>(cacheKey));
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const mounted = useRef(true);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const abortRef = useRef<AbortController | null>(null);
  const syncIdRef = useRef<string>(cacheKey || nextSyncId());

  const refresh = useCallback(async () => {
    if (!mounted.current) return;
    // Cancel any prior in-flight refresh (newer call supersedes older)
    abortRef.current?.abort();
    const outer = new AbortController();
    abortRef.current = outer;
    setLoading(true);
    const sid = syncIdRef.current;
    syncBegin(sid);

    let attempt = 0;
    let lastErr: unknown = null;
    while (attempt <= retries) {
      // Bail if a newer refresh took over.
      if (abortRef.current !== outer) { syncError(sid, 'aborted'); return; }
      // Per-attempt controller that triggers timeout or piggybacks outer cancel.
      const ac = new AbortController();
      const onOuterAbort = () => ac.abort();
      outer.signal.addEventListener('abort', onOuterAbort);
      const timeout = setTimeout(() => ac.abort(), timeoutMs);
      try {
        const next = await loaderRef.current(ac.signal);
        clearTimeout(timeout);
        outer.signal.removeEventListener('abort', onOuterAbort);
        if (!mounted.current || abortRef.current !== outer) { syncError(sid, 'aborted'); return; }
        setData(next); setError(null); setLastSyncedAt(Date.now());
        writeCache(cacheKey, next);
        setLoading(false);
        syncSuccess(sid);
        return;
      } catch (e: any) {
        clearTimeout(timeout);
        outer.signal.removeEventListener('abort', onOuterAbort);
        lastErr = e;
        if (!mounted.current) { syncError(sid, 'unmounted'); return; }
        if (abortRef.current !== outer) { syncError(sid, 'aborted'); return; }
        attempt++;
        if (attempt > retries) break;
        await sleep(retryBaseMs * Math.pow(2, attempt - 1));
      }
    }
    if (!mounted.current) return;
    const errObj = lastErr instanceof Error ? lastErr : new Error(String(lastErr));
    setError(errObj);
    setLoading(false);
    syncError(sid, errObj.message || 'sync failed');
  }, [cacheKey, timeoutMs, retries, retryBaseMs]);



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
