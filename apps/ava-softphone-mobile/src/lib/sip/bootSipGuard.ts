/**
 * bootSipGuard — runs once at app boot.
 *
 * 1. Logs the SIP-related env flags and which provider will be used.
 * 2. Verifies the dispatcher banner ([Softphone] dispatcher loaded …) was
 *    printed after the hook mounts. If not within 15 s, surfaces a loud error.
 * 3. Wraps console.log/info/warn so any JsSIP UA log emitted while the
 *    native flag is active is reported as a fatal misconfiguration.
 * 4. Exposes `getSipBootReport()` for the UI fallback panel.
 *
 * IMPORTANT: the banner is now emitted INSIDE the hook body (not at module
 * evaluation time), so the guard console-patch is always installed first.
 * The hooks call notifySipDispatcherLoaded() directly instead of relying on
 * console-sniffing, which eliminates all timing races.
 */
import { NATIVE_SIP_ENABLED } from './nativeSipProvider';

export interface SipBootReport {
  nativeEnabled: boolean;
  dispatcherLoaded: boolean;
  jsSipLeak: string | null;       // first offending log message, if any
  startedAt: number;
}

const report: SipBootReport = {
  nativeEnabled: NATIVE_SIP_ENABLED,
  dispatcherLoaded: false,
  jsSipLeak: null,
  startedAt: Date.now(),
};

let installed = false;
let validationTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * Called directly by useSoftphoneNative / useSoftphone when the hook first
 * renders. This replaces the fragile console-sniffing approach and eliminates
 * all timing races between module evaluation and guard installation.
 */
export function notifySipDispatcherLoaded() {
  if (report.dispatcherLoaded) return;
  report.dispatcherLoaded = true;
  if (validationTimer !== null) {
    clearTimeout(validationTimer);
    validationTimer = null;
  }
  // eslint-disable-next-line no-console
  console.log('[SipBootGuard] ✓ dispatcher loaded, provider =',
    NATIVE_SIP_ENABLED ? 'native' : 'jssip');
}

export function installSipBootGuard() {
  if (installed) return;
  installed = true;

  const env = (import.meta as any).env ?? {};
  // eslint-disable-next-line no-console
  console.log('[SipBootGuard] env flags', {
    VITE_NATIVE_SIP: env.VITE_NATIVE_SIP,
    MODE: env.MODE,
    PROD: env.PROD,
    chosenProvider: NATIVE_SIP_ENABLED ? 'native (CapacitorPjsip)' : 'jssip (WebRTC)',
  });

  // Sniff every console call to catch any JsSIP UA log while native is active.
  const channels: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = [
    'log', 'info', 'warn', 'error', 'debug',
  ];
  channels.forEach((ch) => {
    const original = (console as any)[ch].bind(console);
    (console as any)[ch] = (...args: any[]) => {
      try {
        if (NATIVE_SIP_ENABLED && !report.jsSipLeak) {
          const first = typeof args[0] === 'string' ? args[0] : '';
          // JsSIP prints with the "JsSIP:" prefix on every internal log.
          if (/^JsSIP:/.test(first) || /JsSIP\b.*\bUA\b/.test(first)) {
            report.jsSipLeak = first;
            original(
              '[SipBootGuard] ❌ JsSIP UA log detected while VITE_NATIVE_SIP=true —',
              'a parallel SIP stack is running. This must never happen.',
              { sample: first },
            );
          }
        }
      } catch {
        // never let logging crash the app
      }
      original(...args);
    };
  });

  // Validation: the hook must call notifySipDispatcherLoaded() within 15 s.
  // This covers cold launches with slow permission gates or SplashAva screens.
  // The timer is cancelled as soon as the hook calls notifySipDispatcherLoaded().
  validationTimer = setTimeout(() => {
    validationTimer = null;
    if (!report.dispatcherLoaded) {
      // eslint-disable-next-line no-console
      console.error(
        '[SipBootGuard] ❌ dispatcher banner missing — useSoftphone never loaded.',
        'The app cannot make calls. Check the bundle for VITE_NATIVE_SIP.',
      );
    }
  }, 15000);
}

export function getSipBootReport(): Readonly<SipBootReport> {
  return report;
}
