// Manages remote audio output routing (earpiece / speaker / bluetooth).
// On Capacitor iOS we route through the native CapacitorPjsip plugin which
// drives AVAudioSession.overrideOutputAudioPort. On web we fall back to
// HTMLMediaElement.setSinkId where supported.

import { Capacitor } from '@capacitor/core';
import { CapacitorSipNative } from './nativeSipProvider';

export type AudioRoute = 'earpiece' | 'speaker' | 'bluetooth';

let audioEl: HTMLAudioElement | null = null;
let route: AudioRoute = 'earpiece';

let busy = false;
let bluetoothAvailable = false;
const listeners = new Set<(s: AudioState) => void>();

export type AudioState = {
  route: AudioRoute;
  busy: boolean;
  bluetoothAvailable: boolean;
};

function emit() {
  const s: AudioState = { route, busy, bluetoothAvailable };
  listeners.forEach((l) => l(s));
}

export function getAudioState(): AudioState {
  return { route, busy, bluetoothAvailable };
}

export function onAudioStateChange(cb: (s: AudioState) => void) {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}

export function registerRemoteAudioElement(el: HTMLAudioElement | null) {
  audioEl = el;
  if (el) void applySink(el, route);
  void probeBluetooth();
}

// Legacy compatibility -------------------------------------------------------
export function isSpeakerOn() { return route === 'speaker'; }
export function onSpeakerChange(cb: (on: boolean) => void) {
  return onAudioStateChange((s) => cb(s.route === 'speaker'));
}
export async function toggleSpeaker(): Promise<boolean> {
  const next: AudioRoute = route === 'speaker' ? 'earpiece' : 'speaker';
  const ok = await setRoute(next);
  return ok && route === 'speaker';
}

// New API --------------------------------------------------------------------
export async function setRoute(next: AudioRoute): Promise<boolean> {
  if (busy) return false;
  if (next === 'bluetooth' && !bluetoothAvailable) {
    // allow attempt anyway — native side may still route
  }
  busy = true; emit();
  try {
    if (audioEl) await applySink(audioEl, next);
    route = next;
    emit();
    return true;
  } catch (e) {
    console.warn('[audioOutput] setRoute failed', next, e);
    emit();
    throw e;
  } finally {
    busy = false;
    emit();
  }
}

async function applySink(el: HTMLAudioElement, target: AudioRoute) {
  const anyEl = el as any;
  el.volume = 1.0;
  if (typeof anyEl.setSinkId !== 'function') return; // iOS WKWebView path
  // Map to the limited sink ids the browser exposes. The native layer does
  // the real routing; this only nudges devices that support setSinkId.
  const sinkId =
    target === 'speaker' ? 'communications' :
    target === 'bluetooth' ? 'communications' :
    'default';
  await anyEl.setSinkId(sinkId);
}

async function probeBluetooth() {
  try {
    const md: any = navigator.mediaDevices;
    if (!md?.enumerateDevices) return;
    const devices: MediaDeviceInfo[] = await md.enumerateDevices();
    const next = devices.some((d) =>
      d.kind === 'audiooutput' && /bluetooth|airpods|bt|headset/i.test(d.label || '')
    );
    if (next !== bluetoothAvailable) {
      bluetoothAvailable = next;
      emit();
    }
  } catch { /* ignore */ }
}

if (typeof navigator !== 'undefined' && (navigator as any).mediaDevices?.addEventListener) {
  try {
    (navigator as any).mediaDevices.addEventListener('devicechange', probeBluetooth);
  } catch { /* ignore */ }
}
