import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles, Loader2, Search } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, RecordingEntry } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, EmptyState, Skeleton } from '../components/ui/Primitives';
import { useAutoSync } from '../hooks/useAutoSync';
import CallDetailScreen from './CallDetailScreen';
import { showMobileToast } from '../lib/mobileToast';
import { getCredentials } from '../lib/creds';

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';
let _recClient: ReturnType<typeof createClient> | null = null;
function recClient(token?: string | null) {
  if (!_recClient) _recClient = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  if (token) _recClient.realtime.setAuth(token);
  return _recClient;
}

export default function RecordingsScreen() {
  const { data, loading, refresh, lastSyncedAt, error } =
    useAutoSync<RecordingEntry[]>(() => mobileApi.recordings(), { intervalMs: 60_000 });
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, 'running' | 'failed' | undefined>>({});
  const [q, setQ] = useState('');

  // Realtime: refresh on any change to pbx_call_recordings for this domain.
  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    (async () => {
      const c = await getCredentials();
      if (!c?.accessToken) return;
      const client = recClient(c.accessToken);
      const domainUuid = (c as any).domainUuid || (c as any).fusionpbxDomainUuid;
      const filter = domainUuid ? `domain_uuid=eq.${domainUuid}` : undefined;
      channel = client
        .channel('rec-mobile')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_call_recordings', ...(filter ? { filter } : {}) } as any,
          () => { if (!cancelled) refresh(); })
        .subscribe();
    })();
    return () => { cancelled = true; try { channel && _recClient?.removeChannel(channel); } catch {} };
  }, []);

  const filtered = useMemo(() => {
    if (!data) return data;
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter((r) =>
      [r.customer, r.from, r.summary].filter(Boolean).some((v: any) => String(v).toLowerCase().includes(t))
    );
  }, [data, q]);

  const transcribe = async (id: string) => {
    if (busy[id] === 'running') return;
    setBusy((b) => ({ ...b, [id]: 'running' }));
    try {
      const t = await mobileApi.transcribeCall(id);
      if (t?.stub || t?.error) {
        throw new Error([t.error || t.reason || 'transcription unavailable', ...(t.fetchErrors || [])].filter(Boolean).join(' · '));
      }
      await mobileApi.analyzeCall(id);
      setBusy((b) => { const n = { ...b }; delete n[id]; return n; });
      showMobileToast('AI analysis: déjà traité et mis en cache.', 'success');
      refresh();
    } catch (e: any) {
      setBusy((b) => ({ ...b, [id]: 'failed' }));
      showMobileToast(`Transcription/scoring failed — ${e?.message || 'unknown error'}`, 'error');
    }
  };

  if (open) return <CallDetailScreen id={open} onBack={() => setOpen(null)} />;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <SectionTitle eyebrow="AI transcribed" title="Call recordings" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 10px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.7)', border: `1px solid ${colors.border}` }}>
          <Search size={14} color={colors.mutedSilver} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search recordings…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: colors.textIce }} />
        </div>
        <button onClick={refresh} disabled={loading} style={{
          padding: '8px 12px', borderRadius: 999, border: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.7)', color: colors.lemtelBlue,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer',
        }}>{loading ? '…' : '↻'}</button>
      </div>
      <div style={{ fontSize: font.xs, color: colors.mutedSilver, margin: '0 2px 10px' }}>
        {(filtered?.length ?? 0)} of {data?.length ?? 0} · live sync {lastSyncedAt ? `· ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}
      </div>

      {error && <Card accent="gold"><div style={{ fontSize: font.sm, color: colors.danger }}>{error.message}</div></Card>}

      {!data && !error && [1,2,3,4].map(i => (
        <Card key={i} style={{ marginBottom: 8 }}><Skeleton w="65%" h={14} /><div style={{ height: 6 }} /><Skeleton w="35%" h={10} /></Card>
      ))}

      {data && data.length === 0 && (
        <EmptyState icon="◉" title="No recordings yet" hint="Recorded calls will appear here with AI transcripts and summaries." />
      )}

      {filtered && filtered.map((r) => {
        const state = busy[r.id];
        return (
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
              {r.hasTranscript ? (
                <Chip tone="violet" size="xs">AI ✓</Chip>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); transcribe(r.id); }}
                  disabled={state === 'running'}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    padding: '3px 8px', borderRadius: 999, border: 'none',
                    background: state === 'failed'
                      ? 'rgba(239,68,68,0.18)'
                      : `linear-gradient(135deg, ${colors.avaViolet}, ${colors.avaCyan})`,
                    color: state === 'failed' ? colors.danger : '#fff',
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                    cursor: state === 'running' ? 'default' : 'pointer',
                    opacity: state === 'running' ? 0.7 : 1,
                  }}
                  title={state === 'failed' ? 'Tap to retry transcription' : 'Transcribe & analyze with AVA'}
                >
                  {state === 'running' ? <Loader2 size={10} className="spin" /> : <Sparkles size={10} />}
                  {state === 'running' ? 'WORKING' : state === 'failed' ? 'RETRY' : 'TRANSCRIBE'}
                </button>
              )}
            </div>
          </div>
          {r.summary && (
            <p style={{ fontSize: font.sm, color: colors.textSub, margin: '8px 0 0', lineHeight: 1.4 }}>
              {r.summary}
            </p>
          )}
        </Card>
        );
      })}

      <div style={{ height: 80 }} />
    </div>
  );
}

function fmtDuration(s: number) {
  const m = Math.floor(s / 60); const sec = s % 60;
  return `${m}m ${sec.toString().padStart(2, '0')}s`;
}
