/**
 * bootSipGuard — runs once at app boot.
 *
 * 1. Logs the SIP-related env flags and which provider will be used.
 * 2. Verifies the dispatcher banner ([Softphone] dispatcher loaded …) was
 *    printed during module evaluation. If not, surfaces a loud error.
 * 3. Wraps console.log/info/warn so any JsSIP UA log emitted while the
 *    native flag is active is reported as a fatal misconfiguration.
 * 4. Exposes `getSipBootReport()` for the UI fallback panel.
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

  // Sniff every console call until the dispatcher banner shows up, and to
  // catch any JsSIP UA log while native is active.
  const channels: Array<'log' | 'info' | 'warn' | 'error' | 'debug'> = [
    'log', 'info', 'warn', 'error', 'debug',
  ];
  channels.forEach((ch) => {
    const original = (console as any)[ch].bind(console);
    (console as any)[ch] = (...args: any[]) => {
      try {
        const first = typeof args[0] === 'string' ? args[0] : '';
        if (!report.dispatcherLoaded && first.startsWith('[Softphone] dispatcher loaded')) {
          report.dispatcherLoaded = true;
        }
        if (NATIVE_SIP_ENABLED && !report.jsSipLeak) {
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

  // Validation: dispatcher must have loaded by the time the first render
  // tick happens. If not, the bundle is broken.
  setTimeout(() => {
    if (!report.dispatcherLoaded) {
      // eslint-disable-next-line no-console
      console.error(
        '[SipBootGuard] ❌ dispatcher banner missing — useSoftphone never loaded.',
        'The app cannot make calls. Check the bundle for VITE_NATIVE_SIP.',
      );
    } else {
      // eslint-disable-next-line no-console
      console.log('[SipBootGuard] ✓ dispatcher loaded, provider =',
        NATIVE_SIP_ENABLED ? 'native' : 'jssip');
    }
  }, 2000);
}

export function getSipBootReport(): Readonly<SipBootReport> {
  return report;
}
