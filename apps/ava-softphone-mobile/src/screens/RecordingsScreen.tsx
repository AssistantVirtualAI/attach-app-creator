import React, { useEffect, useState } from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, RecordingEntry } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, EmptyState, Skeleton } from '../components/ui/Primitives';
import { useAutoSync } from '../hooks/useAutoSync';
import CallDetailScreen from './CallDetailScreen';
import { createClient } from '@supabase/supabase-js';
import { getCredentials } from '../lib/creds';

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

export default function RecordingsScreen() {
  const { data, loading, refresh, lastSyncedAt, error } =
    useAutoSync<RecordingEntry[]>(() => mobileApi.recordings(), { intervalMs: 60_000 });
  const [open, setOpen] = useState<string | null>(null);

  // Live refresh: when a new recording arrives for this org/extension, pull again.
  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    (async () => {
      const creds = await getCredentials();
      if (!creds?.accessToken || cancelled) return;
      const sb = createClient(SUPABASE_URL, ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        realtime: { params: { eventsPerSecond: 2 } },
      });
      sb.realtime.setAuth(creds.accessToken);
      const filter = creds.organizationId
        ? `organization_id=eq.${creds.organizationId}`
        : `extension=eq.${creds.extension}`;
      channel = sb
        .channel(`recordings-${creds.extension}`)
        .on('postgres_changes',
          { event: '*', schema: 'public', table: 'pbx_call_records', filter },
          (payload: any) => {
            const row: any = payload.new || payload.old;
            if (!row?.has_recording) return;
            if (row.extension && row.extension !== creds.extension &&
                row.caller_number !== creds.extension &&
                row.destination_number !== creds.extension) return;
            refresh();
          })
        .subscribe();
    })();
    return () => { cancelled = true; try { channel?.unsubscribe(); } catch {} };
  }, [refresh]);


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
