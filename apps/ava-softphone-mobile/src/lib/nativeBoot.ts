/**
 * One-time native runtime initialization:
 * - Hide splash screen
 * - Set status bar style
 * - Wire app pause/resume hooks
 */
import { Capacitor } from '@capacitor/core';

export async function bootNative(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide({ fadeOutDuration: 400 });
  } catch {}
  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Dark });
    await StatusBar.setBackgroundColor({ color: '#001a3d' });
  } catch {}

  // Delta contact sync — fires at most once per 24h, non-blocking.
  try {
    const { maybeRunDeltaSync } = await import('./contactsSync');
    void maybeRunDeltaSync().then((r) => {
      if (r) console.log('[nativeBoot] contacts delta sync', r);
    });
  } catch {}
}

export async function onAppStateChange(handler: (active: boolean) => void): Promise<() => void> {
  if (!Capacitor.isNativePlatform()) return () => {};
  try {
    const { App } = await import('@capacitor/app');
    const sub = await App.addListener('appStateChange', (s) => handler(s.isActive));
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
