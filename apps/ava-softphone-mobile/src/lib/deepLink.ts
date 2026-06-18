// Capacitor deep-link handler for avastatistic://login?ava_token=...
// When the OS opens the app via the custom URL scheme, extract the auto-login
// token and append it to the current window.location.search so the shared
// consumeAppLoginToken() boot helper can pick it up and establish a session.
import { Capacitor } from '@capacitor/core';

export async function registerDeepLinkHandler(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  try {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('appUrlOpen', (event: { url: string }) => {
      try {
        const u = new URL(event.url);
        const token = u.searchParams.get('ava_token');
        if (!token) return;
        // Reload the SPA with the token attached so the shared consumer runs.
        const target = new URL(window.location.href);
        target.searchParams.set('ava_token', token);
        window.location.replace(target.toString());
      } catch (e) {
        console.warn('[deep-link] parse failed', e);
      }
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
