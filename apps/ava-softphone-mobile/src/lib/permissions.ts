/**
 * Centralized mobile permission requests for Lemtel AI Phone.
 *
 * Requests microphone, speaker (via getUserMedia/audio output), contacts,
 * camera, and notification permissions. Safe to call on web (no-ops).
 */
import { Capacitor } from '@capacitor/core';

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
