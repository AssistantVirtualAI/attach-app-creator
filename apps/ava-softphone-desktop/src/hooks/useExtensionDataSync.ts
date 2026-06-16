import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';

/**
 * useExtensionDataSync — once an extension is signed in, automatically pull
 * everything tied to it (CDRs, voicemails, recordings) and refresh on an
 * interval. Idempotent: existing rows are deduped via pbx_dedup_key on the
 * server. Failures are swallowed (non-blocking) and surfaced in console only.
 */
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

    const runOnce = async (deep = false) => {
      const limit = deep ? deepLimit : 500;
      const calls: Array<Promise<unknown>> = [];

      // Presence first — marks the user online so other clients see them.
      calls.push(supabase.rpc('update_platform_seen', { p_platform: 'desktop' }).then(() => null, () => null));

      // CDRs
      calls.push(
        supabase.functions
          .invoke('fusionpbx-proxy', {
            body: { action: 'sync-cdrs', organization_id: orgId, extension: extension || undefined, limit },
          })
          .catch((e) => console.warn('[sync] cdrs failed', e?.message)),
      );

      // Voicemails (fusionpbx-proxy supports sync-voicemail-messages)
      calls.push(
        supabase.functions
          .invoke('fusionpbx-proxy', {
            body: { action: 'sync-voicemail-messages', organization_id: orgId, extension: extension || undefined },
          })
          .catch((e) => console.warn('[sync] voicemails failed', e?.message)),
      );

      // Recordings — list-recordings persists rows on the server side via the proxy.
      calls.push(
        supabase.functions
          .invoke('fusionpbx-proxy', {
            body: { action: 'list-recordings', organization_id: orgId, extension: extension || undefined, limit },
          })
          .catch((e) => console.warn('[sync] recordings failed', e?.message)),
      );

      await Promise.allSettled(calls);
      if (!cancelled && deep) firstRunDone.current = true;
    };

    // First-load deep backfill if this extension has zero CDRs locally.
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
