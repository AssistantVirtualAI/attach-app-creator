import React, { useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, CallRecord } from '../../lib/avaApi';
import { supabase } from '../../lib/supabaseClient';
import PageHeader, { ListSkeleton, EmptyState } from './PageHeader';

const { colors: c } = theme;

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtDur(s: number) {
  if (!s) return '—';
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function CallsView() {
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'missed' | 'in' | 'out' | 'recorded'>('all');
  const [sel, setSel] = useState<CallRecord | null>(null);
  const [insight, setInsight] = useState<any>(null);

  useEffect(() => {
    const mapRow = (r: any): CallRecord => ({
      id: r.id,
      direction: r.direction === 'outbound' ? 'out' : 'in',
      status: r.hangup_cause === 'NO_ANSWER' ? 'missed' : (r.billsec > 0 ? 'answered' : 'missed'),
      from: r.caller_number || '',
      to: r.destination_number || '',
      customer: r.caller_name || null,
      startedAt: r.start_at,
      durationSec: r.billsec || r.duration_seconds || 0,
      hasRecording: r.has_recording || !!r.recording_path,
      hasTranscript: false,
      sentiment: null,
    } as any);

    const load = async () => {
      const { data, error } = await supabase
        .from('pbx_call_records')
        .select('*')
        .order('start_at', { ascending: false })
        .limit(100);
      if (error) console.error('CDR load error:', error);
      setCalls((data || []).map(mapRow));
      setLoading(false);
    };
    load();

    const channel = supabase
      .channel('cdr-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_call_records' }, (payload) => {
        setCalls((prev) => [mapRow(payload.new), ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);
  useEffect(() => {
    if (sel) { setInsight(null); ava.callDetail(sel.id).then(setInsight); }
  }, [sel]);

  const filtered = calls.filter((cr) =>
    filter === 'all' ? true :
    filter === 'missed' ? cr.status === 'missed' :
    filter === 'recorded' ? cr.hasRecording :
    cr.direction === filter
  );

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* List */}
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <PageHeader
          eyebrow="Phone log"
          title="Calls & Recordings"
          subtitle="Searchable history with audio, transcripts, and AVA insights."
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.92z"/></svg>}
        />

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['all', 'missed', 'in', 'out', 'recorded'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>{f.toUpperCase()}</button>
          ))}
        </div>

        {loading && <ListSkeleton rows={8} />}
        {!loading && <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((cr) => (
            <button key={cr.id} onClick={() => setSel(cr)} style={{
              display: 'grid', gridTemplateColumns: '24px 1fr 80px 90px 70px',
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
                  {cr.customer || (cr.direction === 'in' ? cr.from : cr.to)}
                </span>
                <span style={{ fontSize: 10.5, color: c.mutedSilver }}>
                  {cr.direction === 'in' ? cr.from : cr.to}
                </span>
              </span>
              <span style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDur(cr.durationSec)}</span>
              <span style={{ fontSize: 11, color: c.mutedSilver }}>{fmtDate(cr.startedAt)}</span>
              <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {cr.hasRecording && <span title="Recording" style={dot(c.signalGold)}>●</span>}
                {cr.hasTranscript && <span title="Transcript" style={dot(c.avaViolet)}>●</span>}
                {cr.sentiment === 'positive' && <span style={dot(c.success)}>●</span>}
                {cr.sentiment === 'negative' && <span style={dot(c.danger)}>●</span>}
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <EmptyState icon="📞" title="No calls match this filter" hint="Adjust the filter chips above or place a new call to start your log." accent={c.signalGold} />
          )}
        </div>}
      </div>

      {/* Detail */}
      <aside style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${c.border}`, background: c.deepPanel, padding: '24px 22px', overflowY: 'auto' }}>
        {!sel && (
          <EmptyState
            icon="◔"
            title="Pick a call"
            hint="Select a call to view recording, transcript, and AVA insights."
            accent={c.avaCyan}
          />
        )}
        {sel && (
          <>
            <div style={{ fontSize: 11, color: c.signalGold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>
              Call Detail
            </div>
            <h2 style={{ fontSize: 18, color: c.textIce, margin: '0 0 4px' }}>{sel.customer || sel.from}</h2>
            <div style={{ fontSize: 11, color: c.mutedSilver, marginBottom: 18 }}>
              {sel.direction === 'in' ? 'Inbound' : 'Outbound'} · {fmtDur(sel.durationSec)} · {new Date(sel.startedAt).toLocaleString()}
            </div>

            {/* Waveform placeholder */}
            {sel.hasRecording && (
              <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
                <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 32 }}>
                  {Array.from({ length: 50 }).map((_, i) => (
                    <span key={i} style={{
                      flex: 1, height: `${20 + Math.abs(Math.sin(i * 0.7)) * 70}%`,
                      background: c.signalGold, opacity: 0.6, borderRadius: 1,
                    }} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
                  <span>0:00</span><span>▶ Play</span><span>{fmtDur(sel.durationSec)}</span>
                </div>
              </div>
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
                    {insight.topics.map((t: string) => <span key={t} style={tag(c.avaCyan)}>{t}</span>)}
                  </div>
                </Panel>
                <Panel title="Action Items" accent={c.success}>
                  {insight.actionItems.map((a: string, i: number) => (
                    <div key={i} style={{ fontSize: 12, color: c.textIce, padding: '6px 0', borderBottom: `1px solid ${c.border}` }}>→ {a}</div>
                  ))}
                </Panel>
              </>
            )}
          </>
        )}
      </aside>
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
