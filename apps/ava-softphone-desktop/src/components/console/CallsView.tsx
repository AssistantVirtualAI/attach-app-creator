import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, CallRecord } from '../../lib/avaApi';
import { useTenant } from '../../hooks/useTenant';
import { useRealtimeRefresh } from '../../lib/useRealtimeRefresh';
import PageHeader, { ListSkeleton, EmptyState } from './PageHeader';

const { colors: c } = theme;

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (!iso || Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtDur(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

function relative(iso: string | null) {
  if (!iso) return 'No CDR yet';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'No CDR yet';
  const mins = Math.max(0, Math.round((Date.now() - t) / 60000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs}h ago` : fmtDate(iso);
}

export default function CallsView() {
  const { orgId, extension } = useTenant();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'missed' | 'in' | 'out' | 'recorded'>('all');
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState<CallRecord | null>(null);
  const [insight, setInsight] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null); setSyncing(true);
    try {
      const scopedCalls = await ava.calls(150);
      setCalls(scopedCalls);
      setSel((current) => current ? scopedCalls.find((cr) => cr.id === current.id) || current : current);
    } catch (err: any) {
      setError(err?.message || 'Unable to load live call records for your extension.');
      if (!silent) setCalls([]);
    } finally {
      if (!silent) setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    (window as any).__lemtelRefreshCalls = () => load(true);
    load(false);
    const refreshTimer = window.setInterval(() => load(true), 60_000);
    const onComplete = () => load(true);
    const onRecordings = () => load(true);
    window.addEventListener('lemtel:phone-sync-complete', onComplete);
    window.addEventListener('lemtel:recordings-updated', onRecordings);
    return () => {
      delete (window as any).__lemtelRefreshCalls;
      window.clearInterval(refreshTimer);
      window.removeEventListener('lemtel:phone-sync-complete', onComplete);
      window.removeEventListener('lemtel:recordings-updated', onRecordings);
    };
  }, [load]);

  useRealtimeRefresh(
    {
      table: 'pbx_call_records',
      organizationId: orgId,
      events: ['INSERT', 'UPDATE'],
      debounceMs: 1800,
      throttleMs: 10_000,
      shouldRefresh: (payload: any) => {
        const row = payload?.new || payload?.old || {};
        return !extension || row.extension === extension;
      },
    },
    () => load(true),
  );

  useEffect(() => {
    if (sel) { setInsight(null); ava.callDetail(sel.id).then(setInsight).catch(() => setInsight({ summary: 'No AI insight has been generated for this call yet.', topics: [], actionItems: [], qualityScore: 0 })); }
  }, [sel]);

  useEffect(() => {
    let cancelled = false;
    const previous = audioUrl;
    setAudioUrl(null); setAudioError(null);
    if (!sel?.hasRecording) return () => { if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous); };
    setAudioLoading(true);
    (async () => {
      try {
        const signed = await ava.getRecordingSignedUrl(sel, 300);
        const url = signed?.url || await ava.getRecordingAudioUrl(sel);
        if (!cancelled) {
          if (!url) setAudioError('Recording audio is not available yet. Try Sync Now in a few seconds.');
          setAudioUrl(url || null);
        }
      } catch (err: any) {
        if (!cancelled) setAudioError(err?.message || 'Unable to load the recording stream.');
      } finally {
        if (!cancelled) setAudioLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel?.id]);

  const retry = useCallback(() => load(false), [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return calls.filter((cr) => {
      const matchesFilter = filter === 'all' ? true :
        filter === 'missed' ? cr.status === 'missed' :
        filter === 'recorded' ? cr.hasRecording :
        cr.direction === filter;
      if (!matchesFilter) return false;
      if (!q) return true;
      const haystack = [cr.customer, cr.from, cr.to, cr.transcript_text, cr.status, cr.direction].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [calls, filter, query]);

  const totalRecorded = calls.filter((cr) => cr.hasRecording).length;
  const latestCallAt = calls[0]?.startedAt || null;
  const liveFresh = latestCallAt && (Date.now() - new Date(latestCallAt).getTime()) < 15 * 60_000;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <PageHeader
          eyebrow="Phone log"
          title="Calls & Recordings"
          subtitle="Realtime CDR history with audio playback, transcripts, and AVA insights."
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.92z"/></svg>}
          right={<button onClick={retry} disabled={syncing} style={chip(false)}>{syncing ? 'SYNCING…' : 'SYNC NOW'}</button>}
        />

        {error && <ErrorBanner message={error} onRetry={retry} />}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(120px, 1fr))', gap: 10, marginBottom: 14 }}>
          <MiniMetric label="Total CDRs" value={calls.length} accent={c.avaCyan} hint={`Latest ${relative(latestCallAt)}`} />
          <MiniMetric label="Recorded" value={totalRecorded} accent={c.signalGold} hint={`${calls.length ? Math.round((totalRecorded / calls.length) * 100) : 0}% coverage`} />
          <MiniMetric label="Missed" value={calls.filter((cr) => cr.status === 'missed').length} accent={c.danger} hint="Needs callback" />
          <MiniMetric label="Live Sync" value={liveFresh ? 'Live' : 'Ready'} accent={liveFresh ? c.success : c.mutedSilver} hint={orgId ? `Ext ${extension || 'scoped'}` : 'Resolving tenant'} />
        </section>

        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['all', 'missed', 'in', 'out', 'recorded'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>{f.toUpperCase()}</button>
          ))}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, number, transcript…"
            style={{ flex: 1, minWidth: 220, padding: '8px 11px', borderRadius: 999, border: `1px solid ${c.border}`, background: c.bgCard, color: c.textIce, fontSize: 12, outline: 'none' }}
          />
        </div>

        {loading && <ListSkeleton rows={8} />}
        {!loading && <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((cr) => (
            <button key={cr.id} onClick={() => setSel(cr)} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr 80px 90px 86px',
              alignItems: 'center', gap: 12, width: '100%',
              padding: '11px 14px', background: sel?.id === cr.id ? 'rgba(255,230,0,0.06)' : 'transparent',
              border: 'none', borderBottom: `1px solid ${c.border}`,
              color: c.textIce, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ color: cr.status === 'missed' ? c.danger : cr.direction === 'in' ? c.success : c.avaCyan, fontSize: 14 }}>
                {cr.status === 'missed' ? '↙' : cr.direction === 'in' ? '↘' : '↗'}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {cr.customer || (cr.direction === 'in' ? (cr.from || '') : (cr.to || '')) || 'Unknown caller'}
                </span>
                <span style={{ fontSize: 10.5, color: c.mutedSilver }}>
                  {cr.direction === 'in' ? (cr.from || '') : (cr.to || '')} {cr.transcript_text ? '· transcript ready' : ''}
                </span>
              </span>
              <span style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDur(cr.durationSec)}</span>
              <span style={{ fontSize: 11, color: c.mutedSilver }}>{fmtDate(cr.startedAt)}</span>
              <span style={{ display: 'flex', gap: 5, justifyContent: 'flex-end', alignItems: 'center' }}>
                {cr.hasRecording && <span title="Recording" style={badge(c.signalGold)}>REC</span>}
                {cr.hasTranscript && <span title="Transcript" style={badge(c.avaViolet)}>TXT</span>}
                {cr.sentiment === 'positive' && <span style={dot(c.success)}>●</span>}
                {cr.sentiment === 'negative' && <span style={dot(c.danger)}>●</span>}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <EmptyState icon="TEL" title="No calls match this filter" hint="Adjust filters or place a new call to start your live log." accent={c.signalGold} />
          )}
        </div>}
      </div>

      <aside style={{ width: 390, flexShrink: 0, borderLeft: `1px solid ${c.border}`, background: c.deepPanel, padding: '24px 22px', overflowY: 'auto' }}>
        {!sel && (
          <EmptyState
            icon="CDR"
            title="Pick a call"
            hint="Select a call to view recording playback, transcript, and AVA insights."
            accent={c.avaCyan}
          />
        )}
        {sel && (
          <>
            <div style={{ fontSize: 11, color: c.signalGold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Call Detail
            </div>
            <h2 style={{ fontSize: 18, color: c.textIce, margin: '0 0 4px' }}>{sel.customer || sel.from || sel.to || 'Unknown caller'}</h2>
            <div style={{ fontSize: 11, color: c.mutedSilver, marginBottom: 18 }}>
              {sel.direction === 'in' ? 'Inbound' : 'Outbound'} · {fmtDur(sel.durationSec)} · {fmtDate(sel.startedAt)} · {sel.status}
            </div>

            {sel.hasRecording && (
              <Panel title="Secure Recording" accent={c.signalGold}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 28, marginBottom: 10 }}>
                  {Array.from({ length: 42 }).map((_, i) => (
                    <span key={i} style={{
                      flex: 1, height: `${20 + Math.abs(Math.sin(i * 0.7)) * 70}%`,
                      background: c.signalGold, opacity: 0.55, borderRadius: 1,
                    }} />
                  ))}
                </div>
                {audioLoading && <div style={{ fontSize: 12, color: c.mutedSilver }}>Preparing secure PBX stream…</div>}
                {audioError && <div style={{ fontSize: 12, color: c.danger }}>{audioError}</div>}
                {audioUrl && <audio controls src={audioUrl} style={{ width: '100%' }} />}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>0:00</span><span>{audioUrl ? 'Ready' : 'PBX proxy'}</span><span>{fmtDur(sel.durationSec)}</span>
                </div>
              </Panel>
            )}

            {sel.transcript_text && (
              <Panel title="Transcript Preview" accent={c.avaCyan}>
                <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0 }}>{sel.transcript_text.slice(0, 700)}{sel.transcript_text.length > 700 ? '…' : ''}</p>
              </Panel>
            )}

            {!insight && <div style={{ fontSize: 12, color: c.mutedSilver }}>Loading AVA insight…</div>}
            {insight && (
              <>
                <Panel title="AI Summary" accent={c.avaViolet}>
                  <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0 }}>{insight.summary}</p>
                </Panel>
                <Panel title="Quality" accent={c.signalGold}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: c.signalGold, fontFamily: 'JetBrains Mono, monospace' }}>{insight.qualityScore}<span style={{ fontSize: 11, color: c.mutedSilver }}> /100</span></div>
                </Panel>
                <Panel title="Topics" accent={c.avaCyan}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {(insight.topics || []).map((t: string) => <span key={t} style={tag(c.avaCyan)}>{t}</span>)}
                    {(!insight.topics || insight.topics.length === 0) && <span style={{ fontSize: 12, color: c.mutedSilver }}>No topics yet.</span>}
                  </div>
                </Panel>
                <Panel title="Action Items" accent={c.success}>
                  {(insight.actionItems || []).map((a: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: c.textIce, padding: '6px 0', borderBottom: `1px solid ${c.border}` }}>→ {a}</div>
                  ))}
                  {(!insight.actionItems || insight.actionItems.length === 0) && <span style={{ fontSize: 12, color: c.mutedSilver }}>No action items detected.</span>}
                </Panel>
              </>
            )}
          </>
        )}
      </aside>
    </div>
  );
}

function MiniMetric({ label, value, accent, hint }: { label: string; value: string | number; accent: string; hint: string }) {
  return (
    <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, padding: '11px 12px', borderTop: `2px solid ${accent}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 1, color: c.mutedSilver, textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: c.textIce, fontFamily: 'JetBrains Mono, monospace' }}>{value}</div>
      <div style={{ fontSize: 10.5, color: c.textSub }}>{hint}</div>
    </div>
  );
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 11px', borderRadius: 999,
  background: active ? 'rgba(255,230,0,0.12)' : 'transparent',
  border: `1px solid ${active ? c.borderGold : c.border}`,
  color: active ? c.signalGold : c.mutedSilver,
  fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
});
const dot = (col: string): React.CSSProperties => ({ color: col, fontSize: 8 });
const badge = (col: string): React.CSSProperties => ({ fontSize: 9, padding: '2px 5px', borderRadius: 999, color: col, background: `${col}16`, border: `1px solid ${col}44`, fontWeight: 800 });
const tag = (col: string): React.CSSProperties => ({
  fontSize: 10, padding: '3px 8px', borderRadius: 999,
  background: 'rgba(255,255,255,0.04)', color: col,
  border: `1px solid ${col}33`, fontWeight: 600,
});

function Panel({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: accent, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px' }}>{children}</div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div style={{ marginBottom: 12, padding: 12, borderRadius: 10, background: 'rgba(239,68,68,0.10)', border: `1px solid ${c.danger}55`, color: c.textIce, display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span style={{ fontSize: 12 }}>{message}</span>
      <button onClick={onRetry} style={{ ...chip(false), color: c.danger, borderColor: `${c.danger}66` }}>Retry</button>
    </div>
  );
}
