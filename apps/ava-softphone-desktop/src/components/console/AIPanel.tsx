import React, { useEffect, useMemo, useRef, useState } from 'react';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';
import { getMeContext } from '../../lib/avaApi';

const { colors: c } = theme;

const LS_KEY = 'ava-desk-chat-v1';

type ChatMessage = { id: string; role: 'user' | 'assistant' | 'system'; content: string };

const SUGGESTIONS = [
  'List active outages',
  'Show recent voicemails',
  'Verify tenant isolation for lemtel',
  'Why are calls being missed today?',
];

const USER_SUGGESTIONS = [
  'How many calls did I miss yesterday?',
  'Show my last 5 calls',
  'Summarize my day',
  'Any new voicemails for me?',
];

export default function AIPanel({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const [token, setToken] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try { const raw = localStorage.getItem(LS_KEY); if (raw) return JSON.parse(raw); } catch {}
    return [];
  });
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    try { localStorage.setItem(LS_KEY, JSON.stringify(messages.slice(-50))); } catch {}
  }, [messages]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  const [lastPrompt, setLastPrompt] = useState<string | null>(null);

  const runAttempt = async (history: ChatMessage[]) => {
    const me = await getMeContext();
    const orgId = me.organization_id ?? '71755d33-ed64-4ad5-a828-61c9d2029eb7';
    const { data, error: invokeErr } = await supabase.functions.invoke('telecom-admin-ai-agent', {
      body: {
        organization_id: orgId,
        messages: history.map((m) => ({ role: m.role, content: m.content })),
      },
    });
    const bodyMsg = (data as any)?.error || (data as any)?.message;
    if (invokeErr) throw new Error(bodyMsg || invokeErr.message || 'AI service unavailable');
    return String((data as any)?.response ?? (data as any)?.message ?? '').trim() || '(no response)';
  };

  const runWithBackoff = async (history: ChatMessage[]) => {
    setBusy(true); setError(null);
    const delays = [0, 800, 2000, 4000]; // exponential backoff
    let lastErr: any = null;
    for (let i = 0; i < delays.length; i++) {
      if (delays[i]) await new Promise((r) => setTimeout(r, delays[i]));
      try {
        const response = await runAttempt(history);
        setMessages((cur) => [...cur, { id: crypto.randomUUID(), role: 'assistant', content: response }]);
        setBusy(false);
        return;
      } catch (e: any) {
        lastErr = e;
        console.warn(`AI attempt ${i + 1} failed:`, e?.message);
      }
    }
    setError(lastErr?.message || 'AI service unavailable');
    setBusy(false);
  };

  const send = async (v: string) => {
    const t = v.trim();
    if (!t || busy || !authed) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: 'user', content: t };
    const next = [...messages, userMsg];
    setMessages(next);
    setText('');
    setLastPrompt(t);
    await runWithBackoff(next);
  };

  const retry = async () => {
    if (busy || !messages.length) return;
    // Use existing history (last user message already in messages)
    await runWithBackoff(messages);
  };

  const suggestions = useMemo(() => (isAdmin ? SUGGESTIONS : USER_SUGGESTIONS), [isAdmin]);

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
      background: c.deepPanel, borderLeft: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
      backdropFilter: 'blur(18px) saturate(160%)',
    }}>
      <header style={{
        padding: '14px 16px', borderBottom: `1px solid ${c.border}`,
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
            <div style={{ fontSize: 9.5, color: authed === false ? c.warning : c.avaCyan, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>
              {authed === null ? 'Connecting…' : !authed ? 'Sign in required' : isAdmin ? 'Admin · Live' : 'My calls'}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {messages.length > 0 && (
            <button onClick={() => { setMessages([]); setError(null); }} title="Clear" style={{
              background: 'transparent', border: 'none', color: c.mutedSilver,
              fontSize: 12, cursor: 'pointer', padding: 4,
            }}>Clear</button>
          )}
          <button onClick={onToggle} style={{
            background: 'transparent', border: 'none', color: c.mutedSilver,
            fontSize: 18, cursor: 'pointer', padding: 4, lineHeight: 1,
          }}>×</button>
        </div>
      </header>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {authed === false && (
          <Bubble role="system">Sign in to chat with AVA about your calls, voicemails, and recordings.</Bubble>
        )}
        {authed && messages.length === 0 && (
          <>
            <Bubble role="assistant">
              {isAdmin
                ? 'Bonjour. Je peux analyser vos appels, voicemails, et données telecom.'
                : 'Bonjour. Demande-moi combien d\'appels manqués, mes derniers appels, ou un résumé de la journée.'}
            </Bubble>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {suggestions.map((s) => (
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

        {messages.map((m) => <Bubble key={m.id} role={m.role}>{m.content}</Bubble>)}

        {busy && (
          <div style={{ fontSize: 11, color: c.mutedSilver, fontStyle: 'italic', padding: '4px 8px' }}>
            AVA réfléchit…
          </div>
        )}
        {error && (
          <Bubble role="system">
            <div style={{ color: c.danger, marginBottom: 6 }}>Erreur: {error}</div>
            <button onClick={retry} disabled={busy} style={{
              padding: '6px 12px', borderRadius: 8, border: `1px solid ${c.avaCyan}`,
              background: 'transparent', color: c.avaCyan, fontSize: 11, fontWeight: 700, cursor: busy ? 'not-allowed' : 'pointer',
              opacity: busy ? 0.5 : 1,
            }}>↻ Try again</button>
          </Bubble>
        )}
      </div>

      <div style={{ padding: 12, borderTop: `1px solid ${c.border}`, display: 'flex', gap: 8 }}>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(text); } }}
          placeholder={authed === false ? 'Sign in required' : 'Ask AVA anything…'}
          disabled={!authed || busy}
          style={{
            flex: 1, boxSizing: 'border-box',
            padding: '10px 12px', borderRadius: 10,
            background: c.bgCard, border: `1px solid ${c.borderAI}`,
            color: c.textIce, fontSize: 12.5, outline: 'none',
            opacity: !authed ? 0.5 : 1,
          }}
        />
        <button onClick={() => send(text)} disabled={!authed || !text.trim() || busy} style={{
          padding: '0 14px', borderRadius: 10,
          background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
          color: '#fff', border: 'none', fontWeight: 700, fontSize: 12,
          cursor: (!authed || !text.trim() || busy) ? 'not-allowed' : 'pointer',
          boxShadow: '0 4px 14px -4px rgba(124,58,237,0.45)',
          opacity: (!authed || !text.trim() || busy) ? 0.5 : 1,
        }}>Send</button>
      </div>
    </aside>
  );
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
