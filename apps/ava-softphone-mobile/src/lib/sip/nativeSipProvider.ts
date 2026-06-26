import { registerPlugin } from '@capacitor/core';

export type CapacitorSipLogLevel = 0 | 1 | 2 | 3 | 4 | 5;
// 0=off 1=error 2=warn 3=info 4=debug 5=verbose (full SIP frames)

export interface CapacitorSipPlugin {
  initAccount(options: {
    extension: string;
    domain: string;
    password: string;
    host?: string;
    wssUrl?: string; // legacy, ignored by native TLS plugin
    logLevel?: CapacitorSipLogLevel;
  }): Promise<void>;
  disconnect(): Promise<void>;
  makeCall(options: { number: string }): Promise<void>;
  hangup(): Promise<void>;
  answer(): Promise<void>;
  setMute(options: { muted: boolean }): Promise<void>;
  setHold(options: { held?: boolean; onHold?: boolean }): Promise<void>;
  sendDTMF(options: { digits?: string; digit?: string }): Promise<void>;
  setLogLevel(options: { level: CapacitorSipLogLevel }): Promise<{ level: number }>;
  addListener(event: string, callback: (data: any) => void): Promise<{ remove: () => Promise<void> }>;
  removeAllListeners(): Promise<void>;
}

export const CapacitorSipNative = registerPlugin<CapacitorSipPlugin>('CapacitorSip');

// Legacy alias kept for existing hook imports.
export const CapacitorPjsip = CapacitorSipNative;

export const NATIVE_SIP_ENABLED =
  ((import.meta as any).env?.VITE_NATIVE_SIP ?? '').toString() === 'true';

/**
 * Subscribe to a native SIP event. Returns a cleanup function.
 * Maps legacy event names (registered / registrationFailed) onto the unified
 * `registration` event emitted by the new TLS plugin.
 */
export async function onNativeSipEvent(
  event: 'registered' | 'registrationFailed' | 'callReceived' | 'callStateChanged' | 'callEnded',
  cb: (data: any) => void,
): Promise<() => void> {
  if (event === 'registered' || event === 'registrationFailed') {
    const handle = await CapacitorSipNative.addListener('registration', (d: any) => {
      if (event === 'registered' && d?.status === 'registered') cb(d);
      if (event === 'registrationFailed' && d?.status === 'error') cb(d);
    });
    return () => { handle.remove().catch(() => {}); };
  }
  const handle = await CapacitorSipNative.addListener(event, cb);
  return () => { handle.remove().catch(() => {}); };
}
