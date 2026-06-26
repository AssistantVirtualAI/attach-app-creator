/**
 * nativeSipProvider — JS facade that talks to the native CapacitorPjsip plugin
 * (Swift on iOS, Kotlin on Android). Used when VITE_NATIVE_SIP=true. Falls back
 * to a no-op stub in environments where the native plugin isn't available
 * (web preview, vitest), so importing this module is always safe.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NativeSipEvent =
  | 'registered'
  | 'registrationFailed'
  | 'callReceived'
  | 'callStateChanged'
  | 'callEnded';

export interface NativeSipInitParams {
  extension: string;
  domain: string;
  password: string;
  wssUrl: string;
}

export interface CapacitorPjsipPlugin {
  initAccount(opts: NativeSipInitParams): Promise<{ ok: boolean; stub?: boolean }>;
  makeCall(opts: { number: string }): Promise<{ ok: boolean; callId?: number }>;
  hangup(): Promise<{ ok: boolean }>;
  answer(): Promise<{ ok: boolean }>;
  setMute(opts: { muted: boolean }): Promise<{ ok: boolean; muted: boolean }>;
  setHold(opts: { onHold: boolean }): Promise<{ ok: boolean; onHold: boolean }>;
  sendDTMF(opts: { digit: string }): Promise<{ ok: boolean }>;
  addListener(
    eventName: NativeSipEvent,
    listenerFunc: (data: any) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

/** Web stub used when running outside the native shell — keeps types intact. */
const webStub: CapacitorPjsipPlugin = {
  async initAccount() {
    console.warn('[nativeSipProvider] running web stub — initAccount no-op');
    return { ok: false, stub: true };
  },
  async makeCall() { return { ok: false }; },
  async hangup()   { return { ok: false }; },
  async answer()   { return { ok: false }; },
  async setMute({ muted }) { return { ok: false, muted }; },
  async setHold({ onHold }) { return { ok: false, onHold }; },
  async sendDTMF() { return { ok: false }; },
  addListener() {
    return { remove: async () => {} } as PluginListenerHandle;
  },
  async removeAllListeners() {},
};

export const CapacitorPjsip = registerPlugin<CapacitorPjsipPlugin>(
  'CapacitorPjsip',
  { web: () => webStub },
);

/** True when the feature flag is on at build time. */
export const NATIVE_SIP_ENABLED: boolean =
  (import.meta as any).env?.VITE_NATIVE_SIP === 'true';

/** Convenience: subscribe to a native SIP event with auto-cleanup. */
export async function onNativeSipEvent(
  event: NativeSipEvent,
  cb: (data: any) => void,
): Promise<() => void> {
  const handle = await Promise.resolve(CapacitorPjsip.addListener(event, cb));
  return () => { try { handle.remove(); } catch {} };
}
