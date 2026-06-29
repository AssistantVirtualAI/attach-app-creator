// Capacitor deep-link handler.
//
// Handles two URL schemes:
//   1. avastatistic://login?ava_token=...  — auto-login token
//   2. tel:+15141234567                    — click-to-call from iOS native
//      (iOS Recents / Contacts tap → opens app → must auto-dial)
//
// For tel: URLs, we store the number in sessionStorage and dispatch a
// custom event so MobileApp.tsx can pick it up and call dialNumber().
import { Capacitor } from '@capacitor/core';

export const PENDING_CALL_KEY = 'ava.pendingCall';

/** Dispatch a custom event so MobileApp can trigger the call immediately. */
function dispatchPendingCall(number: string) {
  sessionStorage.setItem(PENDING_CALL_KEY, number);
  window.dispatchEvent(new CustomEvent('ava:pendingCall', { detail: { number } }));
  console.log('[deep-link] pendingCall dispatched:', number);
}

export async function registerDeepLinkHandler(): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  try {
    const { App } = await import('@capacitor/app');

    // Handle URL opened while app is already running (foreground / background).
    const sub = await App.addListener('appUrlOpen', (event: { url: string }) => {
      try {
        const raw = event.url;
        console.log('[deep-link] appUrlOpen:', raw);

        // tel: scheme — iOS Recents / Contacts click-to-call
        if (raw.startsWith('tel:')) {
          const number = raw.replace(/^tel:/, '').replace(/[^\d+*#]/g, '');
          if (number) dispatchPendingCall(number);
          return;
        }

        // avastatistic:// scheme — auto-login token
        const u = new URL(raw);
        const token = u.searchParams.get('ava_token');
        if (token) {
          const target = new URL(window.location.href);
          target.searchParams.set('ava_token', token);
          window.location.replace(target.toString());
        }
      } catch (e) {
        console.warn('[deep-link] parse failed', e);
      }
    });

    // Handle URL that launched the app from terminated state.
    // getLaunchUrl() returns the URL only once; call it at boot.
    try {
      const launch = await App.getLaunchUrl();
      if (launch?.url?.startsWith('tel:')) {
        const number = launch.url.replace(/^tel:/, '').replace(/[^\d+*#]/g, '');
        if (number) dispatchPendingCall(number);
      }
    } catch {}

    return () => sub.remove();
  } catch {
    return () => {};
  }
}
