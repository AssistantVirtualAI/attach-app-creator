/**
 * Global call bus — lets SoftphonePane / SIP layer broadcast call lifecycle
 * events, and any view in the console subscribe (incoming popup, dock, AI panel).
 *
 * State is mirrored to sessionStorage so navigating between console views (and
 * accidental reloads) restores the active call + dock state seamlessly.
 *
 * OS-level notifications are emitted for the lifecycle of incoming calls and
 * automatically cleared when the call is answered, declined, or ended.
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

const STORAGE_KEY = 'lemtel.activeCall.v1';
const NOTIF_TAG = 'lemtel-incoming-call';

const LISTENERS = new Set<(c: ActiveCall | null) => void>();

function restore(): ActiveCall | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ActiveCall;
    // Drop stale ended calls.
    if (parsed?.status === 'ended' || parsed?.status === 'idle') return null;
    return parsed;
  } catch { return null; }
}

let current: ActiveCall | null = restore();

function persist(c: ActiveCall | null) {
  try {
    if (c && c.status !== 'ended' && c.status !== 'idle') {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(c));
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch { /* noop */ }
}

function clearIncomingNotification() {
  window.electronAPI?.clearNotification?.(NOTIF_TAG);
}

function showIncomingNotification(c: ActiveCall) {
  window.electronAPI?.showNotification?.(
    'Incoming call',
    c.displayName ? `${c.displayName} · ${c.number}` : c.number,
    { tag: NOTIF_TAG, urgent: true },
  );
}

export const callBus = {
  get: () => current,
  set(next: ActiveCall | null) {
    const prev = current;
    current = next;
    persist(next);
    // OS notification side-effects.
    if (next?.status === 'incoming' && prev?.id !== next.id) {
      showIncomingNotification(next);
    }
    if (!next || next.status !== 'incoming') {
      clearIncomingNotification();
    }
    LISTENERS.forEach((cb) => cb(next));
  },
  patch(patch: Partial<ActiveCall>) {
    if (!current) return;
    callBus.set({ ...current, ...patch });
  },
  simulateIncoming(number: string, displayName?: string) {
    callBus.set({
      id: 'call_' + Date.now(),
      number, displayName,
      direction: 'in', status: 'incoming', muted: false,
    });
  },
  answer() {
    clearIncomingNotification();
    callBus.patch({ status: 'active', startedAt: Date.now() });
  },
  hangup() {
    clearIncomingNotification();
    callBus.patch({ status: 'ended' });
    setTimeout(() => callBus.set(null), 400);
  },
  mute(v: boolean) { callBus.patch({ muted: v }); },
  hold(v: boolean) { callBus.patch({ status: v ? 'held' : 'active' }); },
};

// Wire main-process notification clicks to focus + answer.
if (typeof window !== 'undefined') {
  window.electronAPI?.onNotificationClicked?.(({ tag }) => {
    if (tag === NOTIF_TAG && current?.status === 'incoming') {
      callBus.answer();
    }
  });
}

export function useCallBus() {
  const [call, setCall] = useState<ActiveCall | null>(current);
  useEffect(() => {
    const cb = (c: ActiveCall | null) => setCall(c);
    LISTENERS.add(cb);
    // Sync in case state changed before mount.
    setCall(current);
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
