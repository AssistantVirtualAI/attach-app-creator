import React, { useEffect, useState } from 'react';
import { colors } from '../lib/theme';
import type { CDRTransport } from '../hooks/useRealtimeCDR';

/**
 * Compact realtime-status pill. Shows live transport, last sync timestamp,
 * and (when polling/retrying) the next backoff tick. Tap to force a refresh
 * and reset the backoff.
 */
function fmtAgo(ts: number | null) {
  if (!ts) return '—';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'just now';
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  return `${Math.round(s / 3600)}h ago`;
}

export default function RealtimeStatusPill({
  transport, warning, lastSyncAt, nextRetryAt, onRefresh,
}: {
  transport: CDRTransport;
  warning?: string | null;
  lastSyncAt?: number | null;
  nextRetryAt?: number | null;
  onRefresh?: () => void;
}) {
  // Re-render once a second so the "Xs ago" label stays fresh.
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const tone =
    transport === 'realtime' ? { dot: colors.success, label: 'Live' } :
    transport === 'polling'  ? { dot: colors.signalGold, label: 'Polling' } :
                               { dot: colors.mutedSilver, label: 'Idle' };
  const retryIn = nextRetryAt ? Math.max(0, Math.round((nextRetryAt - Date.now()) / 1000)) : 0;
  const title = [
    warning,
    lastSyncAt ? `Last sync ${fmtAgo(lastSyncAt)}` : null,
    nextRetryAt && retryIn > 0 ? `Retry in ${retryIn}s` : null,
    'Tap to retry now',
  ].filter(Boolean).join(' • ');

  return (
    <button
      onClick={onRefresh}
      title={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '4px 10px', borderRadius: 999,
        background: 'rgba(255,255,255,0.06)',
        border: `1px solid ${tone.dot}55`,
        color: colors.textIce, fontSize: 10.5, fontWeight: 700, letterSpacing: 0.6,
        textTransform: 'uppercase', cursor: onRefresh ? 'pointer' : 'default',
      }}
    >
      <span style={{
        width: 7, height: 7, borderRadius: 999, background: tone.dot,
        boxShadow: `0 0 8px ${tone.dot}`,
        animation: transport === 'realtime' ? 'pulse-rt 2s ease-in-out infinite' : 'none',
      }} />
      {tone.label}
      <span style={{ opacity: 0.7, fontWeight: 600, textTransform: 'none', letterSpacing: 0 }}>
        · {fmtAgo(lastSyncAt ?? null)}
        {nextRetryAt && retryIn > 0 ? ` · retry ${retryIn}s` : ''}
      </span>
      <style>{`@keyframes pulse-rt { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
    </button>
  );
}
