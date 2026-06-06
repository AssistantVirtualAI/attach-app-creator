import React, { useEffect, useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, VoicemailItem } from '../../lib/avaApi';

const { colors: c } = theme;

type Filter = 'all' | 'new' | 'high' | 'negative';

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
function fmtDur(s: number) {
  const m = Math.floor(s / 60), sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export default function VoicemailView() {
  const [items, setItems] = useState<VoicemailItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [sel, setSel] = useState<VoicemailItem | null>(null);

  useEffect(() => { ava.voicemails().then(setItems); }, []);

  const filtered = useMemo(() => items.filter((v) =>
    filter === 'all' ? true :
    filter === 'new' ? v.isNew :
    filter === 'high' ? v.priority === 'high' :
    v.sentiment === 'negative'
  ), [items, filter]);

  const markRead = (v: VoicemailItem) => {
    if (!v.isNew) return;
    ava.markVoicemailRead(v.id);
    setItems((all) => all.map((x) => x.id === v.id ? { ...x, isNew: false } : x));
  };

  const sentimentColor = (s: VoicemailItem['sentiment']) =>
    s === 'positive' ? c.success : s === 'negative' ? c.danger : c.mutedSilver;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <header style={{ marginBottom: 18 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: c.textIce, margin: '0 0 4px' }}>Voicemail</h1>
          <p style={{ fontSize: 12, color: c.mutedSilver, margin: 0 }}>
            Playback, AVA transcription, priority detection, and callback shortcuts.
          </p>
        </header>

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['all', 'new', 'high', 'negative'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>
              {f.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((v) => (
            <button key={v.id} onClick={() => { setSel(v); markRead(v); }} style={{
              display: 'grid', gridTemplateColumns: '10px 1fr 60px 80px 70px',
              alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 14px',
              background: sel?.id === v.id ? 'rgba(255,230,0,0.06)' : 'transparent',
              border: 'none', borderBottom: `1px solid ${c.border}`,
              color: c.textIce, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: v.isNew ? c.signalGold : 'transparent',
                boxShadow: v.isNew ? `0 0 8px ${c.signalGold}` : 'none',
              }} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: v.isNew ? 700 : 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.customer || v.from}
                </span>
                <span style={{ fontSize: 10.5, color: c.mutedSilver, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.summary}
                </span>
              </span>
              <span style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{fmtDur(v.durationSec)}</span>
              <span style={{ fontSize: 11, color: c.mutedSilver }}>{fmtDate(v.receivedAt)}</span>
              <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                {v.priority === 'high' && <span style={tag(c.danger)}>HIGH</span>}
                <span style={{ ...dot(sentimentColor(v.sentiment)) }}>●</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No voicemails match this filter.</div>
          )}
        </div>
      </div>

      <aside style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${c.border}`, background: c.deepPanel, padding: '24px 22px', overflowY: 'auto' }}>
        {!sel && (
          <div style={{ color: c.mutedSilver, fontSize: 12, paddingTop: 80, textAlign: 'center' }}>
            Select a voicemail to view transcript, AVA summary, and callback actions.
          </div>
        )}
        {sel && (
          <>
            <div style={{ fontSize: 11, color: c.signalGold, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Voicemail</div>
            <h2 style={{ fontSize: 18, color: c.textIce, margin: '0 0 4px' }}>{sel.customer || sel.from}</h2>
            <div style={{ fontSize: 11, color: c.mutedSilver, marginBottom: 18 }}>
              {sel.from} · {fmtDur(sel.durationSec)} · {new Date(sel.receivedAt).toLocaleString()}
            </div>

            <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, padding: 12, marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 2, alignItems: 'center', height: 28 }}>
                {Array.from({ length: 40 }).map((_, i) => (
                  <span key={i} style={{
                    flex: 1, height: `${20 + Math.abs(Math.sin(i * 0.9)) * 70}%`,
                    background: c.avaCyan, opacity: 0.55, borderRadius: 1,
                  }} />
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
                <span>0:00</span><span>▶ Play</span><span>{fmtDur(sel.durationSec)}</span>
              </div>
            </div>

            <Panel title="AVA Summary" accent={c.avaViolet}>
              <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0 }}>{sel.summary}</p>
            </Panel>
            <Panel title="Transcript" accent={c.avaCyan}>
              <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0, whiteSpace: 'pre-wrap' }}>{sel.transcript}</p>
            </Panel>
            <Panel title="Signals" accent={c.signalGold}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <span style={tag(sentimentColor(sel.sentiment))}>{sel.sentiment.toUpperCase()}</span>
                <span style={tag(sel.priority === 'high' ? c.danger : c.mutedSilver)}>PRIORITY · {sel.priority.toUpperCase()}</span>
              </div>
            </Panel>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button style={btnPrimary}>Call back</button>
              <button style={btnGhost}>Reply SMS</button>
            </div>
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
const dot = (col: string): React.CSSProperties => ({ color: col, fontSize: 9 });
const tag = (col: string): React.CSSProperties => ({
  fontSize: 9.5, padding: '3px 7px', borderRadius: 999,
  background: 'rgba(255,255,255,0.04)', color: col,
  border: `1px solid ${col}33`, fontWeight: 700, letterSpacing: 0.6,
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
