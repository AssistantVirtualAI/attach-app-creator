/**
 * Permission state machine — 100 % backed by native OS APIs.
 *
 * `denied` vs `blocked` is inferred from a `requestPermissions()` round-trip
 * combined with an `App.appStateChange` observer: when the OS shows a system
 * dialog the app briefly becomes inactive. If we ask again and the app never
 * loses foreground while the request resolves immediately to `denied`, the OS
 * refused to prompt → treat as `blocked`. No JS-side flag is persisted.
 */
import { Capacitor } from '@capacitor/core';
import { requestMicrophone, requestContacts, requestNotifications, openAppSettings } from './permissions';

export type PermKey = 'microphone' | 'contacts' | 'notifications';
export type PermState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unavailable';

type RawState = 'granted' | 'denied' | 'prompt' | 'unavailable' | 'unknown';

async function rawCheck(key: PermKey): Promise<RawState> {
  const native = Capacitor.isNativePlatform();
  try {
    if (key === 'microphone') {
      if (native) {
        try {
          const { Microphone } = await import('@mozartec/capacitor-microphone');
          const r = await Microphone.checkPermissions();
          if (r?.microphone === 'granted') return 'granted';
          if (r?.microphone === 'denied') return 'denied';
          if (r?.microphone === 'prompt' || (r?.microphone as string) === 'prompt-with-rationale') return 'prompt';
          return 'unknown';
        } catch { return 'unknown'; }
      }
      const p: any = (navigator as any).permissions;
      if (p?.query) {
        try {
          const s = await p.query({ name: 'microphone' as PermissionName });
          if (s.state === 'granted') return 'granted';
          if (s.state === 'denied') return 'denied';
          return 'prompt';
        } catch { /* fall through */ }
      }
      return 'unknown';
    }
    if (key === 'contacts') {
      if (!native) return 'unavailable';
      try {
        const { Contacts } = await import('@capacitor-community/contacts');
        const r = await Contacts.checkPermissions();
        if (r?.contacts === 'granted') return 'granted';
        if (r?.contacts === 'denied') return 'denied';
        if (r?.contacts === 'prompt' || (r?.contacts as string) === 'prompt-with-rationale') return 'prompt';
        return 'unknown';
      } catch { return 'unavailable'; }
    }
    if (key === 'notifications') {
      if (native) {
        try {
          const { PushNotifications } = await import('@capacitor/push-notifications');
          const r = await PushNotifications.checkPermissions();
          if (r.receive === 'granted') return 'granted';
          if (r.receive === 'denied') return 'denied';
          if (r.receive === 'prompt' || (r.receive as string) === 'prompt-with-rationale') return 'prompt';
          return 'unknown';
        } catch { return 'unknown'; }
      }
      if (typeof Notification === 'undefined') return 'unavailable';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      return 'prompt';
    }
  } catch { /* ignore */ }
  return 'unknown';
}

function mapRaw(r: RawState): PermState {
  if (r === 'granted') return 'granted';
  if (r === 'denied') return 'denied';
  if (r === 'prompt') return 'unknown';
  if (r === 'unavailable') return 'unavailable';
  return 'unknown';
}

/**
 * Non-prompting check. Cannot distinguish denied from blocked on its own —
 * callers that need the distinction should call `requestPerm()` which runs
 * the app-state heuristic below.
 */
export async function getPermState(key: PermKey): Promise<PermState> {
  return mapRaw(await rawCheck(key));
}

/**
 * Attempt to request the permission and classify the outcome as
 * granted | denied | blocked | unavailable.
 *
 * The blocked detection observes `App.appStateChange`: an OS permission
 * dialog puts the app into the inactive state; if the request resolves
 * without the app ever leaving active state, the OS silently refused the
 * prompt (permanently denied).
 */
export async function requestPerm(key: PermKey): Promise<PermState> {
  const before = await rawCheck(key);
  if (before === 'granted') return 'granted';
  if (before === 'unavailable') return 'unavailable';

  let sawInactive = false;
  let removeListener: (() => void) | undefined;
  if (Capacitor.isNativePlatform()) {
    try {
      const { App } = await import('@capacitor/app');
      const h = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) sawInactive = true;
      });
      removeListener = () => { try { h.remove(); } catch {} };
    } catch { /* ignore */ }
  }

  const t0 = performance.now();
  let raw: string = 'denied';
  try {
    if (key === 'microphone') raw = await requestMicrophone();
    else if (key === 'contacts') raw = await requestContacts();
    else if (key === 'notifications') raw = await requestNotifications();
  } catch { raw = 'denied'; }
  const elapsed = performance.now() - t0;
  removeListener?.();

  if (raw === 'granted') return 'granted';
  if (raw === 'unsupported') return 'unavailable';

  // Heuristic: the OS showed no dialog if the request resolved fast AND the
  // app never went inactive. That means the permission is permanently denied.
  const nativeSuppressedPrompt = Capacitor.isNativePlatform() && !sawInactive && elapsed < 400;
  const post = await rawCheck(key);
  if (post === 'granted') return 'granted';
  if (before === 'denied' && nativeSuppressedPrompt) return 'blocked';
  if (post === 'denied' && before === 'denied' && !sawInactive) return 'blocked';
  return 'denied';
}

export { openAppSettings };
