import React, { useEffect, useMemo, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, ContactItem } from '../../lib/avaApi';

const { colors: c } = theme;

type Filter = 'all' | 'favorites' | 'vip' | 'at-risk';

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ContactsView() {
  const [items, setItems] = useState<ContactItem[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [sel, setSel] = useState<ContactItem | null>(null);

  useEffect(() => { ava.contacts().then(setItems); }, []);

  const filtered = useMemo(() => items.filter((k) => {
    if (filter === 'favorites' && !k.favorite) return false;
    if (filter === 'vip' && !k.tags.includes('vip')) return false;
    if (filter === 'at-risk' && !k.tags.includes('at-risk')) return false;
    if (search) {
      const t = search.toLowerCase();
      const hay = `${k.name} ${k.company || ''} ${k.phone} ${k.email || ''} ${k.tags.join(' ')}`.toLowerCase();
      if (!hay.includes(t)) return false;
    }
    return true;
  }), [items, filter, search]);

  const sentColor = (x: ContactItem['sentiment']) =>
    x === 'positive' ? c.success : x === 'negative' ? c.danger : c.mutedSilver;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, minWidth: 0, padding: '24px 28px', overflowY: 'auto' }}>
        <header style={{ marginBottom: 14 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: c.textIce, margin: '0 0 4px' }}>Contacts</h1>
          <p style={{ fontSize: 12, color: c.mutedSilver, margin: 0 }}>
            Unified directory with call history, sentiment, and AVA relationship notes.
          </p>
        </header>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, company, phone, email…"
          style={{
            width: '100%', padding: '10px 12px', borderRadius: 10,
            background: c.bgCard, border: `1px solid ${c.border}`,
            color: c.textIce, fontSize: 13, marginBottom: 10, outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
          {(['all', 'favorites', 'vip', 'at-risk'] as Filter[]).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={chip(filter === f)}>{f.toUpperCase()}</button>
          ))}
        </div>

        <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {filtered.map((k) => (
            <button key={k.id} onClick={() => setSel(k)} style={{
              display: 'grid', gridTemplateColumns: '32px 1fr 70px 70px 70px',
              alignItems: 'center', gap: 12, width: '100%',
              padding: '12px 14px',
              background: sel?.id === k.id ? 'rgba(122,76,255,0.06)' : 'transparent',
              border: 'none', borderBottom: `1px solid ${c.border}`,
              color: c.textIce, cursor: 'pointer', textAlign: 'left',
            }}>
              <span style={{
                width: 32, height: 32, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7A4CFF, #23D6FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, color: c.midnight,
              }}>{initials(k.name)}</span>
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {k.name}{k.favorite && <span style={{ color: c.signalGold, marginLeft: 6 }}>★</span>}
                </span>
                <span style={{ fontSize: 10.5, color: c.mutedSilver, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {k.company || k.phone}
                </span>
              </span>
              <span style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace', textAlign: 'right' }}>{k.totalCalls} calls</span>
              <span style={{ fontSize: 11, color: c.mutedSilver, textAlign: 'right' }}>{fmtDate(k.lastInteraction)}</span>
              <span style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                <span style={dot(sentColor(k.sentiment))}>●</span>
              </span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No contacts match.</div>
          )}
        </div>
      </div>

      <aside style={{ width: 360, flexShrink: 0, borderLeft: `1px solid ${c.border}`, background: c.deepPanel, padding: '24px 22px', overflowY: 'auto' }}>
        {!sel && (
          <div style={{ color: c.mutedSilver, fontSize: 12, paddingTop: 80, textAlign: 'center' }}>
            Select a contact to view AVA relationship insights and history.
          </div>
        )}
        {sel && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <span style={{
                width: 48, height: 48, borderRadius: '50%',
                background: 'linear-gradient(135deg, #7A4CFF, #23D6FF)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 16, fontWeight: 700, color: c.midnight,
              }}>{initials(sel.name)}</span>
              <div style={{ minWidth: 0 }}>
                <h2 style={{ fontSize: 17, color: c.textIce, margin: 0 }}>{sel.name}</h2>
                <div style={{ fontSize: 11, color: c.mutedSilver }}>{sel.company || 'Individual'}</div>
              </div>
            </div>

            <Panel title="Contact" accent={c.avaCyan}>
              <div style={{ fontSize: 12, color: c.textIce, lineHeight: 1.7 }}>
                <div>{sel.phone}</div>
                {sel.email && <div style={{ color: c.mutedSilver }}>{sel.email}</div>}
              </div>
            </Panel>

            <Panel title="Activity" accent={c.signalGold}>
              <div style={{ display: 'flex', gap: 16 }}>
                <Stat label="Calls" value={sel.totalCalls} />
                <Stat label="Messages" value={sel.totalMessages} />
                <Stat label="Sentiment" value={sel.sentiment} color={sentColor(sel.sentiment)} />
              </div>
            </Panel>

            <Panel title="AVA Relationship Note" accent={c.avaViolet}>
              <p style={{ fontSize: 12, lineHeight: 1.55, color: c.textIce, margin: 0 }}>{sel.aiNote}</p>
            </Panel>

            <Panel title="Tags" accent={c.mutedSilver}>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {sel.tags.map((t) => <span key={t} style={tag(c.signalGold)}>#{t}</span>)}
              </div>
            </Panel>

            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button style={btnPrimary}>Call</button>
              <button style={btnGhost}>Message</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: color || c.textIce, fontFamily: typeof value === 'number' ? 'JetBrains Mono, monospace' : undefined }}>{value}</div>
    </div>
  );
}

function initials(name: string) {
  return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
}

const chip = (active: boolean): React.CSSProperties => ({
  padding: '6px 11px', borderRadius: 999,
  background: active ? 'rgba(122,76,255,0.14)' : 'transparent',
  border: `1px solid ${active ? c.avaViolet + '66' : c.border}`,
  color: active ? c.avaViolet : c.mutedSilver,
  fontSize: 10, fontWeight: 700, letterSpacing: 1, cursor: 'pointer',
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
