/**
 * nativeSipProvider — JS facade for the native `CapacitorSip` plugin which
 * speaks SIP/TLS directly on port 5061 via Apple's Network.framework (no
 * WebRTC, no TURN, no mDNS — like Ringotel). Falls back to a no-op stub on
 * web/vitest so importing this module is always safe.
 */
import { registerPlugin, type PluginListenerHandle } from '@capacitor/core';

export type NativeSipEvent =
  | 'registration'
  | 'callReceived'
  | 'callStateChanged'
  | 'callEnded';

export interface NativeSipInitParams {
  extension: string;
  domain: string;
  password: string;
  host: string;
}

export interface CapacitorSipPlugin {
  initAccount(opts: NativeSipInitParams): Promise<{ ok: boolean; stub?: boolean }>;
  makeCall(opts: { number: string }): Promise<{ ok: boolean }>;
  hangup(): Promise<{ ok: boolean }>;
  answer(): Promise<{ ok: boolean }>;
  setMute(opts: { muted: boolean }): Promise<{ ok: boolean }>;
  setHold(opts: { held: boolean }): Promise<{ ok: boolean }>;
  sendDTMF(opts: { digits: string }): Promise<{ ok: boolean }>;
  addListener(
    eventName: NativeSipEvent,
    listenerFunc: (data: any) => void,
  ): Promise<PluginListenerHandle> | PluginListenerHandle;
  removeAllListeners(): Promise<void>;
}

/** Web stub used when running outside the native shell — keeps types intact. */
const webStub: CapacitorSipPlugin = {
  async initAccount() {
    console.warn('[nativeSipProvider] running web stub — initAccount no-op');
    return { ok: false, stub: true };
  },
  async makeCall() { return { ok: false }; },
  async hangup()   { return { ok: false }; },
  async answer()   { return { ok: false }; },
  async setMute()  { return { ok: false }; },
  async setHold()  { return { ok: false }; },
  async sendDTMF() { return { ok: false }; },
  addListener() {
    return { remove: async () => {} } as PluginListenerHandle;
  },
  async removeAllListeners() {},
};

export const CapacitorSipNative = registerPlugin<CapacitorSipPlugin>(
  'CapacitorSip',
  { web: () => webStub },
);

/** Back-compat alias — existing imports of `CapacitorPjsip` still work. */
export const CapacitorPjsip = CapacitorSipNative;

/** True when the feature flag is on at build time. */
export const NATIVE_SIP_ENABLED: boolean =
  (import.meta as any).env?.VITE_NATIVE_SIP === 'true';

/** Convenience: subscribe to a native SIP event with auto-cleanup. */
export async function onNativeSipEvent(
  event: NativeSipEvent,
  cb: (data: any) => void,
): Promise<() => void> {
  const handle = await Promise.resolve(CapacitorSipNative.addListener(event, cb));
  return () => { try { handle.remove(); } catch {} };
}
