import { useEffect, useState } from 'react';
import type { SyncEvent, SyncLogEntry } from './useRealtimeSync';
import { sipProvider, type SipStatus } from '../lib/sip/jssipProvider';

export type PbxStatus = Extract<SipStatus, 'registered' | 'connecting' | 'connected' | 'disconnected' | 'error'>;

export function useSyncStatus() {
  const [pbx, setPbx] = useState<PbxStatus>(() => {
    const current = sipProvider.getSnapshot().status;
    return current === 'idle' ? 'connecting' : current;
  });
  const [syncConnected, setSyncConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);
  const [nextRetryAt, setNextRetryAt] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [log, setLog] = useState<SyncLogEntry[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onSip = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === 'registered' || d === 'connecting' || d === 'connected' || d === 'disconnected' || d === 'error') setPbx(d);
    };
    const onSyncStatus = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.connected === 'boolean') {
        setSyncConnected(d.connected);
        if (d.connected) setLastSyncAt(d.at || Date.now());
        setNextRetryAt(d.nextRetryAt ?? null);
        setAttempt(Number(d.attempt || 0));
      }
    };
    const onSync = (e: Event) => {
      const evt = (e as CustomEvent).detail as SyncEvent;
      setLastEvent(evt);
      setLastSyncAt(evt.at);
    };
    const onSyncLog = (e: Event) => setLog((cur) => [((e as CustomEvent).detail as SyncLogEntry), ...cur].slice(0, 40));
    window.addEventListener('lemtel:sip-status', onSip as EventListener);
    window.addEventListener('lemtel:sync-status', onSyncStatus as EventListener);
    window.addEventListener('lemtel:sync', onSync as EventListener);
    window.addEventListener('lemtel:sync-log', onSyncLog as EventListener);

    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      window.removeEventListener('lemtel:sip-status', onSip as EventListener);
      window.removeEventListener('lemtel:sync-status', onSyncStatus as EventListener);
      window.removeEventListener('lemtel:sync', onSync as EventListener);
      window.removeEventListener('lemtel:sync-log', onSyncLog as EventListener);
      window.clearInterval(id);
    };
  }, []);

  const ageMs = lastEvent ? Date.now() - lastEvent.at : null;
  const fresh = ageMs != null && ageMs < 60_000;
  const healthy = pbx === 'registered' && syncConnected;
  // tick used so age label re-renders
  void tick;

  return { pbx, syncConnected, lastEvent, lastSyncAt, nextRetryAt, attempt, log, ageMs, fresh, healthy };
}

export function formatAge(ms: number | null): string {
  if (ms == null) return 'idle';
  if (ms < 5_000) return 'just now';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
