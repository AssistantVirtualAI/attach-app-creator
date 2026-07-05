/**
 * Higher-level permission state machine for the onboarding gate.
 *
 * Distinguishes:
 *   - 'unknown'  : never asked yet (fresh install)
 *   - 'granted'  : allowed
 *   - 'denied'   : user tapped Deny once, we can still show the OS prompt again
 *                  (Android before "Don't ask again", iOS first denial before the
 *                  system silently blocks re-prompts)
 *   - 'blocked'  : OS will no longer show the prompt; only Settings can flip it
 *   - 'unavailable' : platform doesn't expose the permission (e.g. web contacts)
 *
 * We remember whether we've already fired the OS request in this install so
 * that a second "denied" result maps to 'blocked' — matching the standard iOS
 * / Android UX (Zoom, WhatsApp, Google Voice).
 */
import { Capacitor } from '@capacitor/core';
import { requestMicrophone, requestContacts, requestNotifications, openAppSettings } from './permissions';

export type PermKey = 'microphone' | 'contacts' | 'notifications';
export type PermState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unavailable';

const STORAGE_KEY = 'lemtel.permissionAsked.v1';

function loadAsked(): Record<PermKey, boolean> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { microphone: false, contacts: false, notifications: false };
}
function saveAsked(v: Record<PermKey, boolean>) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

async function rawCheck(key: PermKey): Promise<PermState> {
  const native = Capacitor.isNativePlatform();
  try {
    if (key === 'microphone') {
      if (native) {
        try {
          const { Microphone } = await import('@mozartec/capacitor-microphone');
          const r = await Microphone.checkPermissions();
          if (r?.microphone === 'granted') return 'granted';
          if (r?.microphone === 'denied') return 'denied';
          return 'unknown';
        } catch { return 'unknown'; }
      }
      const p: any = (navigator as any).permissions;
      if (p?.query) {
        try {
          const s = await p.query({ name: 'microphone' as PermissionName });
          if (s.state === 'granted') return 'granted';
          if (s.state === 'denied') return 'denied';
          return 'unknown';
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
          return 'unknown';
        } catch { return 'unknown'; }
      }
      if (typeof Notification === 'undefined') return 'unavailable';
      if (Notification.permission === 'granted') return 'granted';
      if (Notification.permission === 'denied') return 'denied';
      return 'unknown';
    }
  } catch { /* ignore */ }
  return 'unknown';
}

export async function getPermState(key: PermKey): Promise<PermState> {
  const raw = await rawCheck(key);
  const asked = loadAsked();
  // Denied AFTER we already asked → the OS will not re-prompt (blocked).
  if (raw === 'denied' && asked[key]) return 'blocked';
  return raw;
}

export async function requestPerm(key: PermKey): Promise<PermState> {
  const asked = loadAsked();
  asked[key] = true;
  saveAsked(asked);
  let status: string = 'denied';
  if (key === 'microphone') status = await requestMicrophone();
  else if (key === 'contacts') status = await requestContacts();
  else if (key === 'notifications') status = await requestNotifications();
  if (status === 'granted') return 'granted';
  if (status === 'unsupported') return 'unavailable';
  // After a request, a non-granted result is treated as blocked only if the
  // OS won't re-prompt — re-check to differentiate.
  const post = await rawCheck(key);
  if (post === 'granted') return 'granted';
  if (post === 'denied') return 'blocked';
  return 'denied';
}

export { openAppSettings };
