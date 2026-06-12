import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';

const { colors: c } = theme;

const FN_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co/functions/v1/ava-admin-command';
const LS_KEY = 'ava-desk-chat-v1';

const SUGGESTIONS = [
  'List active outages',
  'Show recent voicemails',
  'Verify tenant isolation for lemtel',
  'Why are calls being missed today?',
];

export default function AIPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load token + role
  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;
      setToken(session?.access_token ?? null);
      if (!session?.user) { setAuthed(false); return; }
      setAuthed(true);
      const [{ data: isSuper }, { data: isLemtel }] = await Promise.all([
        supabase.rpc('is_super_admin', { _user_id: session.user.id }),
        supabase.rpc('is_lemtel_admin', { _user_id: session.user.id }),
      ]);
      if (mounted) setIsAdmin(Boolean(isSuper || isLemtel));
    })();
    return () => { mounted = false; };
  }, []);

  // Persisted initial messages
  const initial = useMemo(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return [];
  }, []);

  const transport = useMemo(() => new DefaultChatTransport({
    api: FN_URL,
    headers: () => ({
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    }),
  }), [token]);

  const { messages, sendMessage, status, error, stop } = useChat({
    id: 'ava-desk',
    messages: initial,
    transport,
  });

  // Persist
  useEffect(() => {
    if (!messages?.length) return;
    try { localStorage.setItem(LS_KEY, JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  // Autoscroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, status]);

  const [text, setText] = useState('');
  const isBusy = status === 'submitted' || status === 'streaming';

  const send = (v: string) => {
    const t = v.trim();
    if (!t || isBusy || !token || !eligible) return;
    sendMessage({ text: t });
    setText('');
  };

  if (!open) {
    return (
      <button
        onClick={onToggle}
        title="Open AVA panel (⌘J)"
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
      width: 360, flexShrink: 0, height: '100%',
      background: c.deepPanel,
      borderLeft: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(18px) saturate(160%)',
    }}>
      <header style={{
        padding: '14px 16px',
        borderBottom: `1px solid ${c.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, rgba(122,76,255,0.10), rgba(35,214,255,0.05))`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
            display: 'grid', placeItems: 'center', color: '#fff',
            fontWeight: 800, fontSize: 11,
            boxShadow: '0 0 18px -4px rgba(122,76,255,0.55)',
          }}>AI</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: c.textIce }}>AVA Assistant</div>
            <div style={{ fontSize: 9.5, color: eligible === false ? c.warning : c.avaCyan, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
              {eligible === null ? 'Connecting…' : eligible ? 'Admin · Live' : 'Read-only'}
            </div>
          </div>
        </div>
        <button onClick={onToggle} style={{
          background: 'transparent', border: 'none', color: c.mutedSilver,
          fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
        }}>×</button>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {eligible === false && (
          <Bubble role="system">
            AVA admin commands are restricted to platform & Lemtel admins. You can still browse your softphone, voicemails and SMS.
          </Bubble>
        )}
        {eligible && messages.length === 0 && (
          <>
            <Bubble role="assistant">
              Bonjour. Je peux analyser les outages, voicemails, isolation tenant et exécuter des actions admin sécurisées. Demande-moi quoi que ce soit.
            </Bubble>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} style={{
                  textAlign: 'left', padding: '8px 10px',
                  background: 'rgba(124,58,237,0.06)',
                  border: `1px solid ${c.borderAI}`, borderRadius: 10,
                  color: c.textIce, fontSize: 12, cursor: 'pointer',
                }}>→ {s}</button>
              ))}
            </div>
          </>
        )}

        {messages.map((m) => <MessageView key={m.id} msg={m} />)}

        {isBusy && (
          <div style={{ fontSize: 11, color: c.mutedSilver, fontStyle: 'italic', padding: '4px 8px' }}>
            AVA réfléchit…
          </div>
        )}
        {error && (
          <Bubble role="system">
            <span style={{ color: c.danger }}>Erreur: {error.message}</span>
          </Bubble>
        )}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${c.border}`, display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
          placeholder={eligible === false ? 'Admin access required' : 'Ask AVA anything…'}
          disabled={!eligible || isBusy}
          style={{
            flex: 1, boxSizing: 'border-box',
            padding: '10px 12px', borderRadius: 10,
            background: c.bgCard, border: `1px solid ${c.borderAI}`,
            color: c.textIce, fontSize: 12.5, outline: 'none',
            opacity: !eligible ? 0.5 : 1,
          }}
        />
        {isBusy ? (
          <button onClick={() => stop()} style={btnStyle(c.danger)}>Stop</button>
        ) : (
          <button onClick={() => send(text)} disabled={!eligible || !text.trim()} style={{
            ...btnStyle(c.avaViolet),
            opacity: (!eligible || !text.trim()) ? 0.5 : 1,
            cursor: (!eligible || !text.trim()) ? 'not-allowed' : 'pointer',
          }}>Send</button>
        )}
      </div>
    </aside>
  );
}

function btnStyle(bg: string): React.CSSProperties {
  return {
    padding: '0 14px', borderRadius: 10,
    background: `linear-gradient(135deg, ${bg}, ${theme.colors.avaCyan})`,
    color: '#fff', border: 'none', fontWeight: 700, fontSize: 12,
    cursor: 'pointer', boxShadow: '0 4px 14px -4px rgba(124,58,237,0.45)',
  };
}

function Bubble({ role, children }: { role: 'user' | 'assistant' | 'system'; children: React.ReactNode }) {
  const isUser = role === 'user';
  const isSystem = role === 'system';
  return (
    <div style={{
      alignSelf: isUser ? 'flex-end' : 'flex-start',
      maxWidth: '92%',
      padding: isSystem ? '8px 10px' : '10px 12px',
      borderRadius: 12,
      background: isUser
        ? `linear-gradient(135deg, ${c.avaViolet}, ${c.lemtelBlue})`
        : isSystem
          ? 'rgba(217,119,6,0.10)'
          : 'rgba(255,255,255,0.55)',
      border: isUser ? 'none' : `1px solid ${isSystem ? 'rgba(217,119,6,0.30)' : c.border}`,
      color: isUser ? '#fff' : c.textIce,
      fontSize: 12.5, lineHeight: 1.5,
      whiteSpace: 'pre-wrap', wordBreak: 'break-word',
      boxShadow: isUser ? '0 4px 14px -4px rgba(124,58,237,0.45)' : 'none',
    }}>
      {children}
    </div>
  );
}

function MessageView({ msg }: { msg: any }) {
  const role = msg.role as 'user' | 'assistant';
  const parts: any[] = msg.parts ?? (msg.content ? [{ type: 'text', text: msg.content }] : []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {parts.map((p, i) => {
        if (p.type === 'text') {
          return <Bubble key={i} role={role}>{p.text}</Bubble>;
        }
        // tool-* parts (AI SDK v5 emits tool-{name})
        if (typeof p.type === 'string' && p.type.startsWith('tool-')) {
          const name = p.type.replace(/^tool-/, '');
          const state = p.state || 'output-available';
          return (
            <div key={i} style={{
              alignSelf: 'flex-start', maxWidth: '95%',
              padding: '8px 10px', borderRadius: 10,
              background: 'rgba(11,181,214,0.08)',
              border: `1px solid ${c.borderAI}`,
              fontSize: 11.5, color: c.textIce,
            }}>
              <div style={{ fontSize: 9.5, letterSpacing: 1, fontWeight: 700, color: c.avaViolet, textTransform: 'uppercase', marginBottom: 4 }}>
                Tool · {name} · {state}
              </div>
              {p.output != null && (
                <pre style={{ margin: 0, fontSize: 10.5, maxHeight: 180, overflow: 'auto', fontFamily: 'ui-monospace,monospace' }}>
                  {typeof p.output === 'string' ? p.output : JSON.stringify(p.output, null, 2)}
                </pre>
              )}
              {p.errorText && <div style={{ color: c.danger, fontSize: 11 }}>{p.errorText}</div>}
            </div>
          );
        }
        return null;
      })}
    </div>
  );
}
