/**
 * Auto-reconnect helper: re-runs the provided callback when the app comes
 * back to the foreground or when the network reconnects. Both are best-effort
 * and silently noop on web/preview.
 */
import { Capacitor } from '@capacitor/core';

export async function attachNativeAutoReconnect(reconnect: () => void): Promise<() => void> {
  const cleanups: Array<() => void> = [];
  if (!Capacitor.isNativePlatform()) return () => {};

  try {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('appStateChange', (s) => {
      if (s.isActive) {
        // eslint-disable-next-line no-console
        console.log('[NativeSIP] appStateChange:active → reconnect');
        reconnect();
      }
    });
    cleanups.push(() => { sub.remove().catch(() => {}); });
  } catch {}

  try {
    const { Network } = await import('@capacitor/network');
    const sub = await Network.addListener('networkStatusChange', (s) => {
      // eslint-disable-next-line no-console
      console.log('[NativeSIP] networkStatusChange', s);
      if (s.connected) reconnect();
    });
    cleanups.push(() => { sub.remove().catch(() => {}); });
  } catch {}

  return () => { cleanups.forEach((c) => { try { c(); } catch {} }); };
}
