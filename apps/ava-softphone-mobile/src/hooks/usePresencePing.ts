import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Background presence ping (Phase 6).
 * Pings `update_platform_seen` RPC every 60s so the platform knows this
 * device is alive. Detects current platform from Capacitor.
 */
export function usePresencePing(opts: { portalUrl: string; accessToken: string | null }) {
  useEffect(() => {
    if (!opts.accessToken) return;
    const platform = Capacitor.isNativePlatform()
      ? (Capacitor.getPlatform() === 'ios' ? 'ios' : 'android')
      : 'web';

    const ping = async () => {
      try {
        await fetch(`${opts.portalUrl.replace(/\/$/, '')}/rest/v1/rpc/update_platform_seen`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${opts.accessToken}`,
            apikey: opts.accessToken,
          },
          body: JSON.stringify({ p_platform: platform }),
        });
      } catch {}
    };
    ping();
    const id = setInterval(ping, 60_000);
    return () => clearInterval(id);
  }, [opts.portalUrl, opts.accessToken]);
}
