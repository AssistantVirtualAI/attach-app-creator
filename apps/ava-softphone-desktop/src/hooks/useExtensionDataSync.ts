import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useExtensionDataSync — once an extension is signed in, automatically pull
 * everything tied to it (CDRs, voicemails, recordings) and refresh on an
 * interval. Each sub-task is retried with exponential backoff. If a sub-task
 * exhausts all retries we record a row in `telecom_sync_health` and emit a
 * `ava:sync-alert` window event so the UI can surface a toast/banner.
 *
 * Backoff schedule (default): 1s, 2s, 4s, 8s, 16s — total 4 retries.
 */

type SyncAction = 'sync-cdrs' | 'sync-voicemail-messages' | 'list-recordings';

const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

async function withRetry<T>(label: SyncAction, fn: () => Promise<T>): Promise<{ ok: true; value: T } | { ok: false; error: string }> {
  let lastErr = '';
  for (let attempt = 0; attempt <= BACKOFF_MS.length; attempt++) {
    try {
      const value = await fn();
      if (attempt > 0) console.info(`[sync] ${label} recovered on attempt ${attempt + 1}`);
      return { ok: true, value };
    } catch (e: any) {
      lastErr = e?.message || String(e);
      console.warn(`[sync] ${label} attempt ${attempt + 1} failed:`, lastErr);
      if (attempt < BACKOFF_MS.length) {
        // Add a small jitter to avoid thundering herd.
        const jitter = Math.floor(Math.random() * 400);
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt] + jitter));
      }
    }
  }
  return { ok: false, error: lastErr };
}

async function reportFailure(orgId: string, extension: string | null | undefined, action: SyncAction, error: string) {
  // Best-effort: write a health record and emit an in-app alert event.
  try {
    await supabase.from('telecom_sync_health').insert({
      organization_id: orgId,
      job_type: action,
      status: 'failed',
      last_error: error,
      metadata: { extension: extension || null, source: 'useExtensionDataSync' },
    });
  } catch (e) {
    console.warn('[sync] failed to record telecom_sync_health row', e);
  }
  try {
    window.dispatchEvent(new CustomEvent('ava:sync-alert', { detail: { action, extension, error } }));
  } catch {}
}

export function useExtensionDataSync(
  orgId: string | null,
  extension: string | null | undefined,
  opts: { intervalMs?: number; firstRunDeepLimit?: number } = {},
) {
  const intervalMs = opts.intervalMs ?? 5 * 60 * 1000;
  const deepLimit = opts.firstRunDeepLimit ?? 2000;
  const firstRunDone = useRef(false);

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    const invokeWithRetry = (action: SyncAction, body: Record<string, unknown>) =>
      withRetry(action, async () => {
        const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', { body: { action, ...body } });
        if (error) throw new Error(error.message || `${action} failed`);
        if ((data as any)?.error) throw new Error(String((data as any).error));
        return data;
      }).then((res) => {
        if (!res.ok && !cancelled) reportFailure(orgId, extension, action, res.error);
        return res;
      });

    const runOnce = async (deep = false) => {
      const limit = deep ? deepLimit : 500;

      // Presence first — non-critical, no retry needed.
      supabase.rpc('update_platform_seen', { p_platform: 'desktop' }).then(() => null, () => null);

      await Promise.allSettled([
        invokeWithRetry('sync-cdrs', { organization_id: orgId, extension: extension || undefined, limit }),
        invokeWithRetry('sync-voicemail-messages', { organization_id: orgId, extension: extension || undefined }),
        invokeWithRetry('list-recordings', { organization_id: orgId, extension: extension || undefined, limit }),
      ]);

      if (!cancelled && deep) firstRunDone.current = true;
    };

    (async () => {
      if (firstRunDone.current) { runOnce(false); return; }
      try {
        const { count } = await supabase
          .from('pbx_call_records')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .limit(1);
        runOnce((count ?? 0) === 0);
      } catch {
        runOnce(false);
      }
    })();

    const t = setInterval(() => { if (!cancelled) runOnce(false); }, intervalMs);
    return () => { cancelled = true; clearInterval(t); };
  }, [orgId, extension, intervalMs, deepLimit]);
}
