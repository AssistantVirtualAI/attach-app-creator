import { useEffect, useState } from 'react';
import type { SyncEvent } from './useRealtimeSync';
import { sipProvider, type SipStatus } from '../lib/sip/jssipProvider';

export type PbxStatus = Extract<SipStatus, 'registered' | 'connecting' | 'connected' | 'disconnected' | 'error'>;

export function useSyncStatus() {
  const [pbx, setPbx] = useState<PbxStatus>(() => {
    const current = sipProvider.getSnapshot().status;
    return current === 'idle' ? 'connecting' : current;
  });
  const [syncConnected, setSyncConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState<SyncEvent | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onSip = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d === 'registered' || d === 'connecting' || d === 'connected' || d === 'disconnected' || d === 'error') setPbx(d);
    };
    const onSyncStatus = (e: Event) => {
      const d = (e as CustomEvent).detail;
      if (d && typeof d.connected === 'boolean') setSyncConnected(d.connected);
    };
    const onSync = (e: Event) => setLastEvent((e as CustomEvent).detail as SyncEvent);
    window.addEventListener('lemtel:sip-status', onSip as EventListener);
    window.addEventListener('lemtel:sync-status', onSyncStatus as EventListener);
    window.addEventListener('lemtel:sync', onSync as EventListener);

    const id = window.setInterval(() => setTick((t) => t + 1), 15_000);
    return () => {
      window.removeEventListener('lemtel:sip-status', onSip as EventListener);
      window.removeEventListener('lemtel:sync-status', onSyncStatus as EventListener);
      window.removeEventListener('lemtel:sync', onSync as EventListener);
      window.clearInterval(id);
    };
  }, []);

  const ageMs = lastEvent ? Date.now() - lastEvent.at : null;
  const fresh = ageMs != null && ageMs < 60_000;
  const healthy = pbx === 'registered' && syncConnected;
  // tick used so age label re-renders
  void tick;

  return { pbx, syncConnected, lastEvent, ageMs, fresh, healthy };
}

export function formatAge(ms: number | null): string {
  if (ms == null) return 'idle';
  if (ms < 5_000) return 'just now';
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
