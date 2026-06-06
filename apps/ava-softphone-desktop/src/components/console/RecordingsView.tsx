import React, { useEffect, useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, RecordingItem, Feedback } from '../../lib/avaApi';
import PageHeader, { EmptyState, ListSkeleton } from './PageHeader';

const { colors: c } = theme;

type Quality = 'all' | 'high' | 'medium' | 'low';
type Sent = 'all' | 'positive' | 'neutral' | 'negative';
type Sort = 'recent' | 'oldest' | 'longest' | 'quality_desc' | 'quality_asc';
type Range = 'all' | '24h' | '7d' | '30d' | '90d';

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
function rangeCutoff(r: Range): number {
  const ms = { '24h': 864e5, '7d': 7 * 864e5, '30d': 30 * 864e5, '90d': 90 * 864e5 } as const;
  return r === 'all' ? 0 : Date.now() - (ms as any)[r];
}

export default function RecordingsView() {
  const [items, setItems] = useState<RecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState<Quality>('all');
  const [s, setS] = useState<Sent>('all');
  const [range, setRange] = useState<Range>('all');
  const [sort, setSort] = useState<Sort>('recent');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<RecordingItem | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);

  useEffect(() => { ava.recordings().then((d) => { setItems(d); setLoading(false); }); }, []);

  const filtered = useMemo(() => {
    const cutoff = rangeCutoff(range);
    const list = items.filter((r) => {
      if (q === 'high' && r.qualityScore < 80) return false;
      if (q === 'medium' && (r.qualityScore < 50 || r.qualityScore >= 80)) return false;
      if (q === 'low' && r.qualityScore >= 50) return false;
      if (s !== 'all' && r.sentiment !== s) return false;
      if (cutoff && new Date(r.recordedAt).getTime() < cutoff) return false;
      if (search) {
        const t = search.toLowerCase();
        const hay = `${r.customer || ''} ${r.from} ${r.to} ${r.summary} ${r.topics.join(' ')} ${r.tags.join(' ')}`.toLowerCase();
        if (!hay.includes(t)) return false;
      }
      return true;
    });
    list.sort((a, b) => {
      switch (sort) {
        case 'oldest': return +new Date(a.recordedAt) - +new Date(b.recordedAt);
        case 'longest': return b.durationSec - a.durationSec;
        case 'quality_desc': return b.qualityScore - a.qualityScore;
        case 'quality_asc': return a.qualityScore - b.qualityScore;
        default: return +new Date(b.recordedAt) - +new Date(a.recordedAt);
      }
    });
    return list;
  }, [items, q, s, range, sort, search]);

  const qualityColor = (score: number) =>
    score >= 80 ? c.success : score >= 50 ? c.warning : c.danger;
  const sentColor = (x: RecordingItem['sentiment']) =>
    x === 'positive' ? c.success : x === 'negative' ? c.danger : c.mutedSilver;

  const updateItem = (id: string, patch: Partial<RecordingItem>) => {
    setItems((all) => all.map((x) => x.id === id ? { ...x, ...patch } : x));
    if (sel?.id === id) setSel({ ...sel, ...patch });
  };

  const toggleSel = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const toggleAll = () => {
    const allIds = filtered.map((r) => r.id);
    const allSelected = allIds.every((id) => selectedIds.has(id));
    setSelectedIds(allSelected ? new Set() : new Set(allIds));
  };
  const exportSelected = async () => {
    if (selectedIds.size === 0) return;
    setExporting(true); setExportNote(null);
    try {
      const res = await ava.exportRecordings(Array.from(selectedIds));
      setExportNote(`Exported ${res.count} recording${res.count === 1 ? '' : 's'} · ${res.url}`);
    } finally { setExporting(false); }
  };

  const regen = async () => {
    if (!sel) return;
    setRegenLoading(true);
    try {
      const { summary } = await ava.regenerateSummary('recording', sel.id, sel.summary);
      updateItem(sel.id, { summary, feedback: null });
    } finally { setRegenLoading(false); }
  };
  const feedback = (f: Feedback) => {
    if (!sel) return;
    const next: Feedback = sel.feedback === f ? null : f;
    ava.submitSummaryFeedback('recording', sel.id, next);
    updateItem(sel.id, { feedback: next });
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <PageHeader
          eyebrow="Archive"
          title="Recordings"
          subtitle="Searchable archive with AVA quality, sentiment, date range, and bulk export."
          accent={c.avaCyan}
          icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/></svg>}
        />

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
          <FilterGroup label="Range" value={range} onChange={(v) => setRange(v as Range)} options={['all', '24h', '7d', '30d', '90d']} />
          <div>
            <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 5 }}>Sort</div>
            <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} style={{
              padding: '5px 8px', borderRadius: 8, background: c.bgCard,
              border: `1px solid ${c.border}`, color: c.textIce, fontSize: 11, fontWeight: 600,
            }}>
              <option value="recent">Most recent</option>
              <option value="oldest">Oldest first</option>
              <option value="longest">Longest first</option>
              <option value="quality_desc">Quality ↓</option>
              <option value="quality_asc">Quality ↑</option>
            </select>
          </div>
        </div>

        {/* Bulk bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 12px', marginBottom: 10, borderRadius: 10,
          background: selectedIds.size ? 'rgba(255,230,0,0.07)' : c.bgCard,
          border: `1px solid ${selectedIds.size ? c.borderGold : c.border}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={toggleAll} style={miniBtn}>
              {filtered.length && filtered.every((r) => selectedIds.has(r.id)) ? 'Clear' : 'Select all'}
            </button>
            <span style={{ fontSize: 11, color: c.mutedSilver }}>
              {selectedIds.size} selected · {filtered.length} shown
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {exportNote && <span style={{ fontSize: 10, color: c.success }}>{exportNote}</span>}
            <button onClick={exportSelected} disabled={!selectedIds.size || exporting} style={{
              ...miniBtn, background: selectedIds.size ? c.signalGold : 'transparent',
              color: selectedIds.size ? c.midnight : c.mutedSilver, fontWeight: 700,
              borderColor: selectedIds.size ? c.signalGold : c.border, opacity: exporting ? 0.6 : 1,
            }}>{exporting ? 'Exporting…' : '⬇ Export ZIP'}</button>
          </div>
        </div>

        <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((r) => (
            <div key={r.id} onClick={() => setSel(r)} style={{
              display: 'grid', gridTemplateColumns: '22px 1fr 60px 80px 80px 70px',
              alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 14px',
              background: sel?.id === r.id ? 'rgba(35,214,255,0.06)' : 'transparent',
              borderBottom: `1px solid ${c.border}`, color: c.textIce, cursor: 'pointer',
            }}>
              <input
                type="checkbox" checked={selectedIds.has(r.id)}
                onChange={() => {}} onClick={(e) => toggleSel(r.id, e)}
                style={{ accentColor: c.signalGold, cursor: 'pointer' }}
              />
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
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No recordings match these filters.</div>
          )}
        </div>
      </div>

      <aside style={{ width: 380, flexShrink: 0, borderLeft: `1px solid ${c.border}`, background: c.deepPanel, padding: '24px 22px', overflowY: 'auto' }}>
        {!sel && (
          <EmptyState
            icon="◉"
            title="Pick a recording"
            hint="Select a recording to view waveform, AVA summary, and topics."
            accent={c.avaCyan}
          />
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

            <Panel
              title="AVA Summary"
              accent={c.avaViolet}
              right={
                <div style={{ display: 'flex', gap: 6 }}>
                  <button onClick={regen} disabled={regenLoading} style={miniBtn}>{regenLoading ? '…' : '↻ Regenerate'}</button>
                  <button onClick={() => feedback('up')} style={{ ...miniBtn, color: sel.feedback === 'up' ? c.success : c.mutedSilver }}>👍</button>
                  <button onClick={() => feedback('down')} style={{ ...miniBtn, color: sel.feedback === 'down' ? c.danger : c.mutedSilver }}>👎</button>
                </div>
              }
            >
              <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0 }}>{sel.summary}</p>
              {sel.feedback && (
                <div style={{ fontSize: 10, color: c.mutedSilver, marginTop: 6 }}>
                  Feedback recorded — AVA will adapt future summaries.
                </div>
              )}
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
const miniBtn: React.CSSProperties = {
  padding: '5px 10px', borderRadius: 8,
  background: 'transparent', border: `1px solid ${c.border}`,
  color: c.textIce, fontSize: 11, fontWeight: 600, cursor: 'pointer',
};
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

function Panel({ title, accent, children, right }: { title: string; accent: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, color: accent, textTransform: 'uppercase' }}>{title}</div>
        {right}
      </div>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: '10px 12px' }}>{children}</div>
    </div>
  );
}
