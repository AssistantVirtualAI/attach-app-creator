import React, { useEffect, useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, RecordingItem } from '../../lib/avaApi';

const { colors: c } = theme;

type Quality = 'all' | 'high' | 'medium' | 'low';
type Sent = 'all' | 'positive' | 'neutral' | 'negative';

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtDur(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
function fmtSize(kb: number) {
  return kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`;
}

export default function RecordingsView() {
  const [items, setItems] = useState<RecordingItem[]>([]);
  const [q, setQ] = useState<Quality>('all');
  const [s, setS] = useState<Sent>('all');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<RecordingItem | null>(null);

  useEffect(() => { ava.recordings().then(setItems); }, []);

  const filtered = useMemo(() => items.filter((r) => {
    if (q === 'high' && r.qualityScore < 80) return false;
    if (q === 'medium' && (r.qualityScore < 50 || r.qualityScore >= 80)) return false;
    if (q === 'low' && r.qualityScore >= 50) return false;
    if (s !== 'all' && r.sentiment !== s) return false;
    if (search) {
      const t = search.toLowerCase();
      const hay = `${r.customer || ''} ${r.from} ${r.to} ${r.summary} ${r.topics.join(' ')} ${r.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  }), [items, q, s, search]);

  const qualityColor = (score: number) =>
    score >= 80 ? c.success : score >= 50 ? c.warning : c.danger;
  const sentColor = (x: RecordingItem['sentiment']) =>
    x === 'positive' ? c.success : x === 'negative' ? c.danger : c.mutedSilver;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: c.textIce, margin: '0 0 4px' }}>Recordings</h1>
          <p style={{ fontSize: 12, color: c.mutedSilver, margin: 0 }}>
            Searchable archive of call audio with AVA quality scores, summaries, and topics.
          </p>
        </header>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search recordings, customers, topics…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: c.bgCard, border: `1px solid ${c.border}`,
            color: c.textIce, fontSize: 13, marginBottom: 10, outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, flexWrap: 'wrap' }}>
          <FilterGroup label="Quality" value={q} onChange={(v) => setQ(v as Quality)} options={['all', 'high', 'medium', 'low']} />
          <FilterGroup label="Sentiment" value={s} onChange={(v) => setS(v as Sent)} options={['all', 'positive', 'neutral', 'negative']} />
        </div>

        <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((r) => (
            <button key={r.id} onClick={() => setSel(r)} style={{
              display: 'grid', gridTemplateColumns: '1fr 60px 80px 80px 70px',
              alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 14px',
              background: sel?.id === r.id ? 'rgba(35,214,255,0.06)' : 'transparent',
              border: 'none', borderBottom: `1px solid ${c.border}`,
              color: c.textIce, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.customer || `${r.from} → ${r.to}`}
                </span>
                <span style={{ fontSize: 10.5, color: c.mutedSilver, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {r.summary}
                </span>
              </span>
              <span style={{ fontSize: 11, color: qualityColor(r.qualityScore), fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{r.qualityScore}</span>
              <span style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDur(r.durationSec)}</span>
              <span style={{ fontSize: 11, color: c.mutedSilver }}>{fmtDate(r.recordedAt)}</span>
              <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <span style={dot(sentColor(r.sentiment))}>●</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No recordings match these filters.</div>
          )}
        </div>
      </div>

      <aside style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${c.border}`, background: c.deepPanel, padding: '24px 22px', overflowY: 'auto' }}>
        {!sel && (
          <div style={{ color: c.mutedSilver, fontSize: 12, paddingTop: 80, textAlign: 'center' }}>
            Select a recording to view waveform, AVA summary, and topics.
          </div>
        )}
        {sel && (
          <>
            <div style={{ fontSize: 11, color: c.signalGold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Recording</div>
            <h2 style={{ fontSize: 18, color: c.textIce, margin: '0 0 4px' }}>{sel.customer || `${sel.from} → ${sel.to}`}</h2>
            <div style={{ fontSize: 11, color: c.mutedSilver, marginBottom: 18 }}>
              {fmtDate(sel.recordedAt)} · {fmtDur(sel.durationSec)} · {fmtSize(sel.sizeKb)}
            </div>

            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 36 }}>
                {Array.from({ length: 60 }).map((_, i) => (
                  <span key={i} style={{
                    flex: 1, height: `${15 + Math.abs(Math.sin(i * 0.5)) * 80}%`,
                    background: c.signalGold, opacity: 0.6, borderRadius: 1,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
                <span>0:00</span><span>▶ Play</span><span>{fmtDur(sel.durationSec)}</span>
              </div>
            </div>

            <Panel title="Quality Score" accent={c.signalGold}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 26, fontWeight: 700, color: qualityColor(sel.qualityScore), fontFamily: 'JetBrains Mono, monospace' }}>{sel.qualityScore}</span>
                <span style={{ fontSize: 11, color: c.mutedSilver }}>/100</span>
              </div>
            </Panel>
            <Panel title="AVA Summary" accent={c.avaViolet}>
              <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0 }}>{sel.summary}</p>
            </Panel>
            <Panel title="Topics" accent={c.avaCyan}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sel.topics.map((t) => <span key={t} style={tag(c.avaCyan)}>{t}</span>)}
              </div>
            </Panel>
            <Panel title="Tags" accent={c.mutedSilver}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sel.tags.map((t) => <span key={t} style={tag(c.signalGold)}>#{t}</span>)}
              </div>
            </Panel>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button style={btnPrimary}>Download</button>
              <button style={btnGhost}>Share</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function FilterGroup({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 5 }}>
        {options.map((o) => (
          <button key={o} onClick={() => onChange(o)} style={chip(value === o)}>{o.toUpperCase()}</button>
        ))}
      </div>
    </div>
  );
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 999,
  background: active ? 'rgba(35,214,255,0.10)' : 'transparent',
  border: `1px solid ${active ? c.avaCyan + '55' : c.border}`,
  color: active ? c.avaCyan : c.mutedSilver,
  fontSize: 10, fontWeight: 700, letterSpacing: 0.8, cursor: 'pointer',
});
const dot = (col: string): React.CSSProperties => ({ color: col, fontSize: 9 });
const tag = (col: string): React.CSSProperties => ({
  fontSize: 10, padding: '3px 8px', borderRadius: 999,
  background: 'rgba(255,255,255,0.04)', color: col,
  border: `1px solid ${col}33`, fontWeight: 600,
});
const btnPrimary: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 10,
  background: c.signalGold, color: c.midnight, border: 'none',
  fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
const btnGhost: React.CSSProperties = {
  flex: 1, padding: '10px 12px', borderRadius: 10,
  background: 'transparent', color: c.textIce,
  border: `1px solid ${c.border}`, fontSize: 12, fontWeight: 600, cursor: 'pointer',
};

function Panel({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: accent, textTransform: 'uppercase', marginBottom: 6 }}>{title}</div>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px' }}>{children}</div>
    </div>
  );
}
