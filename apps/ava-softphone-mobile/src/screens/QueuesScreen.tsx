import React from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, QueueRow } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, EmptyState, Skeleton } from '../components/ui/Primitives';
import { useAutoSync } from '../hooks/useAutoSync';

export default function QueuesScreen() {
  const { data, loading, error, refresh, lastSyncedAt } = useAutoSync<QueueRow[]>(
    () => mobileApi.queues(),
    { intervalMs: 30_000 },
  );

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <SectionTitle eyebrow="Live PBX" title="Call queues" />

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

      {error && <Card accent="gold" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: font.sm, color: colors.danger, fontWeight: 700 }}>Couldn't load queues</div>
        <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 4 }}>{error.message}</div>
      </Card>}

      {!data && !error && <>
        {[1,2,3].map(i => (
          <Card key={i} style={{ marginBottom: 8 }}>
            <Skeleton w="60%" h={14} />
            <div style={{ height: 6 }} />
            <Skeleton w="40%" h={10} />
          </Card>
        ))}
      </>}

      {data && data.length === 0 && (
        <EmptyState icon="⇉" title="No queues configured" hint="Once your administrator adds call queues they'll appear here." />
      )}

      {data && data.map((q) => <QueueCard key={q.id} q={q} />)}

      <p style={{ fontSize: font.xs, color: colors.mutedSilver, textAlign: 'center', marginTop: 14 }}>
        Read-only view. Manage queues from the AVA portal.
      </p>
      <div style={{ height: 80 }} />
    </div>
  );
}

function QueueCard({ q }: { q: QueueRow }) {
  const slaTone = q.slaPct >= 85 ? colors.success : q.slaPct >= 70 ? colors.warning : colors.danger;
  return (
    <Card style={{ marginBottom: 8 }} padded={true}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce }}>{q.name}</div>
          <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
            Ext {q.extension || '—'} · {q.strategy || 'default'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: slaTone, fontFamily: 'JetBrains Mono, monospace' }}>{q.slaPct}%</div>
          <div style={{ fontSize: 9.5, color: colors.mutedSilver, letterSpacing: 1 }}>SLA TODAY</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <Chip tone="cyan">{q.waiting} waiting</Chip>
        <Chip tone="gold">{q.agentsOnline} agents online</Chip>
        <Chip tone="violet">{q.callsToday} calls today</Chip>
        {q.avgWaitSec > 0 && <Chip>Wait {Math.round(q.avgWaitSec)}s</Chip>}
      </div>
    </Card>
  );
}
