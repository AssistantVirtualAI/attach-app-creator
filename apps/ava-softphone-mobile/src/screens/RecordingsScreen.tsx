import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, RecordingEntry } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, EmptyState, Skeleton } from '../components/ui/Primitives';
import { useAutoSync } from '../hooks/useAutoSync';
import CallDetailScreen from './CallDetailScreen';

export default function RecordingsScreen() {
  const { data, loading, refresh, lastSyncedAt, error } =
    useAutoSync<RecordingEntry[]>(() => mobileApi.recordings(), { intervalMs: 60_000 });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'running' | 'failed' | undefined>>({});

  const transcribe = async (id: string) => {
    if (busy[id] === 'running') return;
    setBusy((b) => ({ ...b, [id]: 'running' }));
    try {
      await mobileApi.analyzeCall(id);
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
      refresh();
    } catch {
      setBusy((b) => ({ ...b, [id]: 'failed' }));
    }
  };

  if (open) return <CallDetailScreen id={open} onBack={() => setOpen(null)} />;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <SectionTitle eyebrow="AI transcribed" title="Call recordings" />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 2px 12px' }}>
        <span style={{ fontSize: font.xs, color: colors.mutedSilver }}>
          {lastSyncedAt ? `Synced ${new Date(lastSyncedAt).toLocaleTimeString()}` : 'Syncing…'}
        </span>
        <button onClick={refresh} disabled={loading} style={{
          padding: '6px 12px', borderRadius: 999, border: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.7)', color: colors.lemtelBlue,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer',
        }}>{loading ? 'Refreshing…' : '↻ Refresh'}</button>
      </div>

      {error && <Card accent="gold"><div style={{ fontSize: font.sm, color: colors.danger }}>{error.message}</div></Card>}

      {!data && !error && [1,2,3,4].map(i => (
        <Card key={i} style={{ marginBottom: 8 }}><Skeleton w="65%" h={14} /><div style={{ height: 6 }} /><Skeleton w="35%" h={10} /></Card>
      ))}

      {data && data.length === 0 && (
        <EmptyState icon="◉" title="No recordings yet" hint="Recorded calls will appear here with AI transcripts and summaries." />
      )}

      {data && data.map((r) => (
        <Card key={r.id} style={{ marginBottom: 8 }} padded={true} onPress={() => setOpen(r.id)}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.customer || r.from}
              </div>
              <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                {new Date(r.startedAt).toLocaleString()} · {fmtDuration(r.durationSec)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
              <Chip tone="gold" size="xs">REC</Chip>
              {r.hasTranscript && <Chip tone="violet" size="xs">AI</Chip>}
            </div>
          </div>
          {r.summary && (
            <p style={{ fontSize: font.sm, color: colors.textSub, margin: '8px 0 0', lineHeight: 1.4 }}>
              {r.summary}
            </p>
          )}
        </Card>
      ))}

      <div style={{ height: 80 }} />
    </div>
  );
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}
