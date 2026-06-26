/**
 * Centralized mobile permission requests for Lemtel AI Phone.
 *
 * Requests microphone, speaker (via getUserMedia/audio output), contacts,
 * camera, and notification permissions. Safe to call on web (no-ops).
 */
import { Capacitor } from '@capacitor/core';
import { CapacitorPjsip } from './sip/nativeSipProvider';

export type PermissionStatus = 'granted' | 'denied' | 'prompt' | 'unsupported';

export interface AllPermissions {
  microphone: PermissionStatus;
  speaker: PermissionStatus;
  contacts: PermissionStatus;
  notifications: PermissionStatus;
  camera: PermissionStatus;
}

/** Microphone + speaker output (WebRTC). Triggers OS prompt on native. */
export async function requestMicrophone(): Promise<PermissionStatus> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
      const res = await CapacitorPjsip.requestMicrophonePermission();
      return res?.granted ? 'granted' : 'denied';
    }
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'unsupported';
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // Immediately stop so we don't keep the mic open before a call.
    stream.getTracks().forEach((t) => t.stop());
    return 'granted';
  } catch {
    return 'denied';
  }
}

/**
 * Speaker / audio output permission. Most platforms don't gate playback,
 * but we proactively initialize an AudioContext to satisfy autoplay policies.
 */
export async function unlockAudioOutput(): Promise<PermissionStatus> {
  try {
    const Ctx: typeof AudioContext | undefined =
      (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return 'unsupported';
    const ctx = new Ctx();
    if (ctx.state === 'suspended') await ctx.resume();
    // Play a 1-sample silent buffer to truly unlock on iOS.
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(ctx.destination);
    src.start(0);
    return ctx.state === 'running' ? 'granted' : 'prompt';
  } catch {
    return 'denied';
  }
}

/** Contacts permission via @capacitor-community/contacts. */
export async function requestContacts(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) return 'unsupported';
  try {
    const { Contacts } = await import('@capacitor-community/contacts');
    const res = await Contacts.requestPermissions();
    return (res?.contacts === 'granted' ? 'granted' : 'denied');
  } catch {
    return 'denied';
  }
}

/** Push + local notifications. */
export async function requestNotifications(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    if (typeof Notification === 'undefined') return 'unsupported';
    try {
      const result = await Notification.requestPermission();
      return result === 'granted' ? 'granted' : result === 'denied' ? 'denied' : 'prompt';
    } catch { return 'denied'; }
  }
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const push = await PushNotifications.requestPermissions();
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.requestPermissions();
    return push.receive === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'denied';
  }
}

/** Camera permission (for future video calls / avatar capture). */
export async function requestCamera(): Promise<PermissionStatus> {
  if (!Capacitor.isNativePlatform()) {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch { return 'denied'; }
  }
  try {
    const { Camera } = await import('@capacitor/camera');
    const res = await Camera.requestPermissions({ permissions: ['camera'] });
    return res.camera === 'granted' ? 'granted' : 'denied';
  } catch { return 'denied'; }
}

/**
 * Request all permissions required for a fully working call/SMS experience.
 * Call once after the user signs in.
 */
export async function requestAllPermissions(): Promise<AllPermissions> {
  // Mic + audio output FIRST so phone calls work immediately.
  const microphone = await requestMicrophone();
  const speaker = await unlockAudioOutput();
  // Then notifications (so missed call / SMS push works).
  const notifications = await requestNotifications();
  // Then contacts (so the dialer can autocomplete).
  const contacts = await requestContacts();
  // Camera last — only requested when user opens video call later.
  const camera: PermissionStatus = 'prompt';
  const result: AllPermissions = { microphone, speaker, contacts, notifications, camera };
  try { sessionStorage.setItem('lemtel-permissions', JSON.stringify(result)); } catch {}
  return result;
}

export function loadCachedPermissions(): AllPermissions | null {
  try {
    const raw = sessionStorage.getItem('lemtel-permissions');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/**
 * Non-prompting check of current permission state. Uses the Permissions API
 * where available, falls back to enumerateDevices() for microphone heuristics.
 */
export async function checkAllPermissions(): Promise<AllPermissions> {
  const perms: AllPermissions = {
    microphone: 'prompt',
    speaker: 'granted', // playback never gated
    contacts: 'prompt',
    notifications: 'prompt',
    camera: 'prompt',
  };

  // Microphone — try Permissions API, then enumerateDevices heuristic.
  try {
    const anyPerm: any = (navigator as any).permissions;
    if (anyPerm?.query) {
      try {
        const st = await anyPerm.query({ name: 'microphone' as PermissionName });
        if (st?.state === 'granted' || st?.state === 'denied' || st?.state === 'prompt') {
          perms.microphone = st.state as PermissionStatus;
        }
      } catch { /* not supported */ }
    }
    if (perms.microphone === 'prompt' && navigator.mediaDevices?.enumerateDevices) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mic = devices.find((d) => d.kind === 'audioinput');
      if (mic && mic.label) perms.microphone = 'granted';
    }
  } catch { /* ignore */ }

  // Notifications (web only; native uses real check via plugin).
  if (!Capacitor.isNativePlatform() && typeof Notification !== 'undefined') {
    perms.notifications =
      Notification.permission === 'granted' ? 'granted'
        : Notification.permission === 'denied' ? 'denied' : 'prompt';
  } else if (Capacitor.isNativePlatform()) {
    try {
      const { PushNotifications } = await import('@capacitor/push-notifications');
      const res = await PushNotifications.checkPermissions();
      perms.notifications = res.receive === 'granted' ? 'granted'
        : res.receive === 'denied' ? 'denied' : 'prompt';
    } catch { /* ignore */ }
  }

  // Contacts (native only).
  if (Capacitor.isNativePlatform()) {
    try {
      const { Contacts } = await import('@capacitor-community/contacts');
      const res = await Contacts.checkPermissions();
      perms.contacts = res?.contacts === 'granted' ? 'granted'
        : res?.contacts === 'denied' ? 'denied' : 'prompt';
    } catch { /* ignore */ }
  }

  return perms;
}

/** Open the OS-level app settings page so the user can flip a denied permission. */
export async function openAppSettings(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    const { App } = await import('@capacitor/app');
    // Capacitor App plugin doesn't directly expose settings on all versions;
    // fall back to platform-specific deep link via window.open.
    const platform = Capacitor.getPlatform();
    if (platform === 'ios') {
      window.open('app-settings:', '_system');
    } else if (platform === 'android') {
      window.open('package:com.lemtel.softphone', '_system');
    }
    // Touch App import to avoid unused warning.
    void App;
  } catch { /* ignore */ }
}
