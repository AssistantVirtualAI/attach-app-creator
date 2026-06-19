import React from 'react';
import { colors, font } from '../lib/theme';
import type { CDRTransport } from '../hooks/useRealtimeCDR';

/**
 * Compact realtime-status pill shown in the app header.
 *  - 🟢 Live       — Realtime channel SUBSCRIBED
 *  - 🟡 Polling    — fell back to 15s polling
 *  - ⚪ Idle       — no creds yet
 *
 * Tap to trigger a forced refresh.
 */
export default function RealtimeStatusPill({
  transport, warning, onRefresh,
}: { transport: CDRTransport; warning?: string | null; onRefresh?: () => void }) {
  const tone =
    transport === 'realtime' ? { dot: colors.success, label: 'Live', text: 'Realtime CDR sync is healthy.' } :
    transport === 'polling'  ? { dot: colors.signalGold, label: 'Polling', text: warning || 'Polling every 15s.' } :
                               { dot: colors.mutedSilver, label: 'Idle', text: 'Connecting…' };

  return (
    <button
      onClick={onRefresh}
      title={tone.text}
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
      <style>{`@keyframes pulse-rt { 0%,100%{opacity:1} 50%{opacity:.45} }`}</style>
    </button>
  );
}
