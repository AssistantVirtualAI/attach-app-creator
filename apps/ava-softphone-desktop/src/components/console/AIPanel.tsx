import React, { useState, useRef, useEffect } from 'react';
import { theme } from '../../lib/theme';
import { supabase, SB_URL, SB_KEY } from '../../lib/supabaseClient';

const { colors: c } = theme;

interface Msg { role: 'user' | 'assistant' | 'system'; content: string; tools?: { name: string }[] }

export default function AIPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', content: 'Bonjour 👋 I can manage your phone system. Try "list my extensions" or "show recent calls".' },
  ]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setInput('');
    setBusy(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const res = await fetch(`${SB_URL}/functions/v1/pbx-chat-agent`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, apikey: SB_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
      setMessages([...next, { role: 'assistant', content: data.text || '(empty)', tools: data.toolCalls }]);
    } catch (e: any) {
      setMessages([...next, { role: 'assistant', content: `⚠ ${e?.message || 'Request failed'}` }]);
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={onToggle}
        title="Open AVA panel"
        style={{
          position: 'absolute', top: 70, right: 0, zIndex: 5,
          width: 28, height: 64, borderRadius: '10px 0 0 10px',
          background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
          border: 'none', cursor: 'pointer', color: '#fff',
          fontSize: 11, fontWeight: 800, letterSpacing: 1,
          writingMode: 'vertical-rl' as any,
          boxShadow: '0 4px 18px -4px rgba(122,76,255,0.55)',
        }}
      >AVA</button>
    );
  }

  return (
    <aside style={{
      width: 340, flexShrink: 0, height: '100%',
      background: c.deepPanel, borderLeft: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
    }}>
      <header style={{
        padding: '14px 16px', borderBottom: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, rgba(122,76,255,0.10), rgba(35,214,255,0.05))`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
            display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 11,
          }}>AI</div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: c.textIce }}>AVA Assistant</div>
            <div style={{ fontSize: 9.5, color: c.avaCyan, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
              {busy ? 'Thinking…' : 'Ready'}
            </div>
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: 'transparent', border: 'none', color: c.mutedSilver,
          fontSize: 16, cursor: 'pointer', padding: 4,
        }}>×</button>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '85%',
            padding: '8px 12px', borderRadius: 12,
            background: m.role === 'user'
              ? `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`
              : 'rgba(255,255,255,0.04)',
            color: m.role === 'user' ? '#fff' : c.textIce,
            fontSize: 12.5, lineHeight: 1.5,
            border: m.role === 'user' ? 'none' : `1px solid ${c.border}`,
            whiteSpace: 'pre-wrap',
          }}>
            {m.content}
            {m.tools && m.tools.length > 0 && (
              <div style={{ marginTop: 6, fontSize: 10, color: c.avaCyan, opacity: 0.85 }}>
                ✓ {m.tools.map((t) => t.name).join(' · ')}
              </div>
            )}
          </div>
        ))}
        {busy && (
          <div style={{ alignSelf: 'flex-start', padding: '8px 12px', fontSize: 12, color: c.mutedSilver }}>
            <span className="ava-dots">●●●</span>
          </div>
        )}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${c.border}` }}>
        <form onSubmit={(e) => { e.preventDefault(); send(); }} style={{ display: 'flex', gap: 6 }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask AVA anything…"
            disabled={busy}
            style={{
              flex: 1, boxSizing: 'border-box',
              padding: '10px 12px', borderRadius: 10,
              background: c.bgCard, border: `1px solid ${c.borderAI}`,
              color: c.textIce, fontSize: 12, outline: 'none',
            }}
          />
          <button type="submit" disabled={busy || !input.trim()} style={{
            padding: '0 14px', borderRadius: 10, border: 'none',
            background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
            color: '#fff', fontSize: 12, fontWeight: 700, cursor: busy ? 'wait' : 'pointer',
            opacity: busy || !input.trim() ? 0.5 : 1,
          }}>Send</button>
        </form>
      </div>
    </aside>
  );
}
