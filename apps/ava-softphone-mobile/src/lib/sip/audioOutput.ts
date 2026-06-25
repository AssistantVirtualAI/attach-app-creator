// Manages remote audio output routing (earpiece vs speaker).
// Frontend best-effort: uses HTMLMediaElement.setSinkId when supported.
// On iOS WKWebView, native AVAudioSession (configured in AppDelegate with
// .defaultToSpeaker + .allowBluetooth) handles physical routing; this module
// still tracks the toggle state so the UI reflects user intent.

let audioEl: HTMLAudioElement | null = null;
let speakerOn = false;
const listeners = new Set<(on: boolean) => void>();

export function registerRemoteAudioElement(el: HTMLAudioElement | null) {
  audioEl = el;
  if (el && speakerOn) void applySink(el, true);
}

export function isSpeakerOn() {
  return speakerOn;
}

export function onSpeakerChange(cb: (on: boolean) => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export async function setSpeaker(on: boolean): Promise<boolean> {
  speakerOn = on;
  if (audioEl) await applySink(audioEl, on);
  listeners.forEach((l) => l(on));
  return on;
}

export async function toggleSpeaker(): Promise<boolean> {
  return setSpeaker(!speakerOn);
}

async function applySink(el: HTMLAudioElement, on: boolean) {
  try {
    // setSinkId is non-standard; iOS WKWebView ignores it (native session routes audio).
    const anyEl = el as any;
    if (typeof anyEl.setSinkId === 'function') {
      await anyEl.setSinkId(on ? 'communications' : 'default').catch(() => {});
    }
    // Maximize playback volume when on speaker
    el.volume = 1.0;
  } catch (e) {
    console.info('[audioOutput] setSinkId not supported', e);
  }
}
