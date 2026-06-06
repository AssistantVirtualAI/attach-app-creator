/**
 * Global call bus — lets SoftphonePane / SIP layer broadcast call lifecycle
 * events, and any view in the console subscribe (incoming popup, dock, AI panel).
 *
 * In Phase 4 the underlying SIP integration is still mocked: we expose a
 * `simulate` helper used by Dev menus & the dock toggle. Once JsSIP is fully
 * wired in SoftphonePane, dispatch the same events from session listeners.
 */
import { useEffect, useState, useCallback } from 'react';

export type CallStatus =
  | 'idle' | 'incoming' | 'outgoing' | 'active' | 'held' | 'ended';

export interface ActiveCall {
  id: string;
  number: string;
  displayName?: string;
  direction: 'in' | 'out';
  status: CallStatus;
  muted: boolean;
  startedAt?: number;
}

const LISTENERS = new Set<(c: ActiveCall | null) => void>();
let current: ActiveCall | null = null;

export const callBus = {
  get: () => current,
  set(next: ActiveCall | null) {
    current = next;
    LISTENERS.forEach((cb) => cb(next));
  },
  patch(patch: Partial<ActiveCall>) {
    if (!current) return;
    current = { ...current, ...patch };
    LISTENERS.forEach((cb) => cb(current));
  },
  simulateIncoming(number: string, displayName?: string) {
    callBus.set({
      id: 'call_' + Date.now(),
      number, displayName,
      direction: 'in', status: 'incoming', muted: false,
    });
  },
  answer() { callBus.patch({ status: 'active', startedAt: Date.now() }); },
  hangup() { callBus.patch({ status: 'ended' }); setTimeout(() => callBus.set(null), 400); },
  mute(v: boolean) { callBus.patch({ muted: v }); },
  hold(v: boolean) { callBus.patch({ status: v ? 'held' : 'active' }); },
};

export function useCallBus() {
  const [call, setCall] = useState<ActiveCall | null>(current);
  useEffect(() => {
    const cb = (c: ActiveCall | null) => setCall(c);
    LISTENERS.add(cb);
    return () => { LISTENERS.delete(cb); };
  }, []);
  return {
    call,
    answer: useCallback(() => callBus.answer(), []),
    hangup: useCallback(() => callBus.hangup(), []),
    mute: useCallback((v: boolean) => callBus.mute(v), []),
    hold: useCallback((v: boolean) => callBus.hold(v), []),
  };
}
