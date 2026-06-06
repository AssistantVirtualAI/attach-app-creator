import React, { useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, SmsThread } from '../../lib/avaApi';

const { colors: c } = theme;

interface Msg { id: string; from: 'me' | 'them'; body: string; at: string; }

const MOCK_MSGS: Record<string, Msg[]> = {
  t1: [
    { id: 'm1', from: 'them', body: 'Hi, did you get the updated quote?', at: '10:14' },
    { id: 'm2', from: 'me', body: 'Yes, sending the revised version this afternoon.', at: '10:16' },
    { id: 'm3', from: 'them', body: 'Perfect, I\'ll review the quote tonight.', at: '10:42' },
  ],
  t2: [
    { id: 'm4', from: 'them', body: 'Can we reschedule to Thursday?', at: '09:30' },
    { id: 'm5', from: 'them', body: 'Same time works for us.', at: '09:31' },
  ],
  t3: [{ id: 'm6', from: 'them', body: 'Thanks for the call earlier.', at: 'Yesterday' }],
};

export default function MessagesView() {
  const [threads, setThreads] = useState<SmsThread[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [draft, setDraft] = useState('');
  const [aiBusy, setAiBusy] = useState(false);

  useEffect(() => {
    ava.threads().then((t) => { setThreads(t); if (t[0]) setActiveId(t[0].id); });
  }, []);
  useEffect(() => { if (activeId) setMsgs(MOCK_MSGS[activeId] || []); }, [activeId]);

  const active = threads.find((t) => t.id === activeId);

  const send = async () => {
    if (!draft.trim() || !activeId) return;
    const m: Msg = { id: 'm' + Date.now(), from: 'me', body: draft, at: 'now' };
    setMsgs((p) => [...p, m]);
    setDraft('');
    await ava.sendMessage(activeId, m.body);
  };

  const aiAction = async (action: 'professional' | 'shorten' | 'translate' | 'rewrite') => {
    if (!draft.trim()) return;
    setAiBusy(true);
    const r = await ava.aiRewrite(draft, action);
    setDraft(r.text);
    setAiBusy(false);
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Thread list */}
      <div style={{ width: 280, flexShrink: 0, borderRight: `1px solid ${c.border}`, background: c.deepPanel, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 18px 12px' }}>
          <h2 style={{ fontSize: 16, color: c.textIce, margin: 0 }}>Messages</h2>
          <div style={{ fontSize: 10.5, color: c.mutedSilver, marginTop: 3 }}>{threads.length} threads</div>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {threads.map((t) => (
            <button key={t.id} onClick={() => setActiveId(t.id)} style={{
              display: 'flex', flexDirection: 'column', gap: 4, width: '100%',
              padding: '11px 16px', background: activeId === t.id ? 'rgba(255,230,0,0.06)' : 'transparent',
              border: 'none', borderBottom: `1px solid ${c.border}`,
              borderLeft: activeId === t.id ? `2px solid ${c.signalGold}` : '2px solid transparent',
              color: c.textIce, cursor: 'pointer', textAlign: 'left',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{t.contact}</span>
                {t.unread > 0 && <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 6px', borderRadius: 999, background: c.signalGold, color: '#000' }}>{t.unread}</span>}
              </div>
              <span style={{ fontSize: 11, color: c.mutedSilver, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.lastMessage}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Conversation */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {active && (
          <header style={{ padding: '16px 24px', borderBottom: `1px solid ${c.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: c.textIce }}>{active.contact}</div>
              <div style={{ fontSize: 10.5, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>via {active.number}</div>
            </div>
            <button style={{ padding: '6px 12px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 11, cursor: 'pointer' }}>Assign</button>
          </header>
        )}

        <div style={{ flex: 1, overflowY: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {msgs.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.from === 'me' ? 'flex-end' : 'flex-start',
              maxWidth: '72%',
              padding: '10px 13px', borderRadius: 14,
              background: m.from === 'me' ? `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})` : c.bgCard,
              border: m.from === 'me' ? 'none' : `1px solid ${c.border}`,
              color: c.textIce, fontSize: 13, lineHeight: 1.5,
              borderBottomRightRadius: m.from === 'me' ? 4 : 14,
              borderBottomLeftRadius: m.from === 'me' ? 14 : 4,
            }}>
              {m.body}
              <div style={{ fontSize: 9, color: m.from === 'me' ? 'rgba(255,255,255,0.6)' : c.mutedSilver, marginTop: 4, textAlign: 'right' }}>{m.at}</div>
            </div>
          ))}
        </div>

        {active && (
          <div style={{ padding: 16, borderTop: `1px solid ${c.border}`, background: c.deepPanel }}>
            <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
              <button onClick={() => aiAction('rewrite')} disabled={aiBusy} style={aiBtn(c.avaViolet)}>✨ Rewrite with AVA</button>
              <button onClick={() => aiAction('professional')} disabled={aiBusy} style={aiBtn(c.avaCyan)}>Make professional</button>
              <button onClick={() => aiAction('shorten')} disabled={aiBusy} style={aiBtn(c.signalGold)}>Shorten</button>
              <button onClick={() => aiAction('translate')} disabled={aiBusy} style={aiBtn(c.mutedSilver)}>Translate FR</button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Type a message…"
                rows={2}
                style={{
                  flex: 1, padding: 10, borderRadius: 10,
                  background: c.bgCard, border: `1px solid ${c.border}`,
                  color: c.textIce, fontSize: 13, resize: 'none', outline: 'none',
                  fontFamily: 'inherit',
                }}
              />
              <button onClick={send} disabled={!draft.trim()} style={{
                padding: '0 18px', borderRadius: 10,
                background: draft.trim() ? `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})` : 'rgba(255,255,255,0.05)',
                border: 'none', color: '#fff', fontSize: 12, fontWeight: 700,
                cursor: draft.trim() ? 'pointer' : 'not-allowed',
              }}>Send</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const aiBtn = (col: string): React.CSSProperties => ({
  padding: '5px 10px', borderRadius: 999,
  background: 'rgba(255,255,255,0.03)',
  border: `1px solid ${col}55`,
  color: col, fontSize: 10.5, fontWeight: 700, cursor: 'pointer',
});
