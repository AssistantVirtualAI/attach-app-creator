// Team chat for mobile: list members of same PBX domain, DMs, group channels, presence live.
// Reuses the desktop `org-chat` edge function so all platforms share the same data.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Users, MessageCircle, Plus, ArrowLeft, Circle, Search } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { colors, radius, font } from '../lib/theme';
import { MOBILE_DEFAULT_PORTAL } from '../lib/mobileApi';

const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';
let _chatRT: ReturnType<typeof createClient> | null = null;
function chatRT(token?: string | null) {
  if (!_chatRT) _chatRT = createClient(MOBILE_DEFAULT_PORTAL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  if (token) _chatRT.realtime.setAuth(token);
  return _chatRT;
}

type Channel = { id: string; name: string; channel_type: string; members: string[] | null };
type Message = { id: string; channel_id: string; sender_id: string; sender_name: string | null; content: string; created_at: string };
type Member = { user_id: string; full_name: string | null; email: string | null; extension: string | null; status: string; is_self?: boolean };

const STATUS_COLOR: Record<string, string> = {
  online: '#22d39a', available: '#22d39a',
  busy: '#ff5a5f', dnd: '#ff5a5f', on_call: '#ff8a3d',
  away: '#f4c248', offline: '#6b7280',
};

async function chatCall(action: string, payload: Record<string, unknown> = {}, token: string | null) {
  if (!token) throw new Error('Not authenticated');
  const res = await fetch(`${MOBILE_DEFAULT_PORTAL}/functions/v1/org-chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!res.ok) {
    let d: any = null;
    try { d = await res.json(); } catch {}
    throw new Error(d?.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export default function TeamChatScreen({ accessToken, userId }: { accessToken: string | null; userId?: string }) {
  const [view, setView] = useState<'channels' | 'members' | 'chat'>('channels');
  const [channels, setChannels] = useState<Channel[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupPicks, setGroupPicks] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<number | null>(null);
  const [channelQuery, setChannelQuery] = useState('');
  const [msgQuery, setMsgQuery] = useState('');
  const [showMsgSearch, setShowMsgSearch] = useState(false);

  // Load channels + members + heartbeat presence
  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true); setError(null);
        const [chRes, memRes] = await Promise.all([
          chatCall('list_channels', {}, accessToken),
          chatCall('list_directory', {}, accessToken),
        ]);
        if (cancelled) return;
        setChannels(chRes.channels || []);
        setMembers(memRes.members || []);
      } catch (e: any) {
        if (!cancelled) setError(e.message || 'Failed to load team chat');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const heartbeat = () => chatCall('heartbeat', { status: 'available', platform: 'mobile', call_state: 'idle' }, accessToken).catch(() => {});
    heartbeat();
    const id = window.setInterval(heartbeat, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [accessToken]);

  // Refresh members presence every 20s
  useEffect(() => {
    if (!accessToken) return;
    const id = window.setInterval(() => {
      chatCall('list_directory', {}, accessToken).then((r) => setMembers(r.members || [])).catch(() => {});
    }, 20000);
    return () => clearInterval(id);
  }, [accessToken]);

  // Load messages on channel change + poll
  useEffect(() => {
    if (!activeChannel || !accessToken) return;
    let cancelled = false;
    const fetchMsgs = async () => {
      try {
        const r = await chatCall('list_messages', { channel_id: activeChannel.id, limit: 60 }, accessToken);
        if (!cancelled) {
          setMessages(r.messages || []);
          requestAnimationFrame(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          });
        }
      } catch {}
    };
    fetchMsgs();
    pollRef.current = window.setInterval(fetchMsgs, 4000) as unknown as number;
    return () => { cancelled = true; if (pollRef.current) clearInterval(pollRef.current); };
  }, [activeChannel, accessToken]);

  const openDm = async (m: Member) => {
    if (!accessToken) return;
    try {
      const r = await chatCall('ensure_dm_channel', { user_id: m.user_id }, accessToken);
      if (r.channel) {
        setActiveChannel(r.channel);
        setView('chat');
        // refresh list
        const ch = await chatCall('list_channels', {}, accessToken);
        setChannels(ch.channels || []);
      }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || !activeChannel || !accessToken) return;
    setInput('');
    try {
      const r = await chatCall('send_message', { channel_id: activeChannel.id, content: text }, accessToken);
      if (r.message) setMessages((prev) => [...prev, r.message]);
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const createGroup = async () => {
    if (!accessToken || groupPicks.size === 0) return;
    try {
      const r = await chatCall('create_group', { name: groupName || 'group', member_ids: Array.from(groupPicks) }, accessToken);
      setGroupOpen(false); setGroupName(''); setGroupPicks(new Set());
      const ch = await chatCall('list_channels', {}, accessToken);
      setChannels(ch.channels || []);
      if (r.channel) { setActiveChannel(r.channel); setView('chat'); }
    } catch (e: any) {
      setError(e.message);
    }
  };

  const channelDisplay = useMemo(() => (ch: Channel) => {
    if (ch.channel_type === 'dm' || ch.name.startsWith('dm:')) {
      const other = (ch.members || []).find((m) => m !== userId);
      const mem = members.find((m) => m.user_id === other);
      return mem ? (mem.full_name || mem.email || `Ext ${mem.extension || ''}`) : 'Direct message';
    }
    return `#${ch.name}`;
  }, [members, userId]);

  if (!accessToken) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: colors.mutedSilver }}>
        Sign in to use team chat.
      </div>
    );
  }

  // ── CHAT VIEW ──
  if (view === 'chat' && activeChannel) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <header style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={() => { setView('channels'); setActiveChannel(null); }}
            style={{ background: 'none', border: 'none', color: colors.textIce, cursor: 'pointer' }}>
            <ArrowLeft size={20} />
          </button>
          <div style={{ flex: 1, fontWeight: 700, color: colors.textIce, fontSize: 15 }}>
            {channelDisplay(activeChannel)}
          </div>
        </header>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {messages.map((m) => {
            const mine = m.sender_id === userId;
            return (
              <div key={m.id} style={{ alignSelf: mine ? 'flex-end' : 'flex-start', maxWidth: '78%' }}>
                {!mine && <div style={{ fontSize: 10, color: colors.mutedSilver, marginBottom: 2, paddingLeft: 6 }}>{m.sender_name || '—'}</div>}
                <div style={{
                  padding: '8px 12px', borderRadius: 14,
                  background: mine ? 'linear-gradient(135deg, #0023e6, #21d4fd)' : 'rgba(255,255,255,0.06)',
                  color: mine ? '#fff' : colors.textIce,
                  fontSize: 14, lineHeight: 1.4, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                }}>{m.content}</div>
              </div>
            );
          })}
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: colors.mutedSilver, fontSize: 12, padding: 32 }}>
              No messages yet. Say hello 👋
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8, padding: '10px 12px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') sendMessage(); }}
            placeholder="Message…"
            style={{
              flex: 1, padding: '10px 14px', borderRadius: 20,
              background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
              color: colors.textIce, fontSize: 14, outline: 'none',
            }}
          />
          <button onClick={sendMessage} disabled={!input.trim()}
            style={{
              width: 40, height: 40, borderRadius: 20, border: 'none',
              background: input.trim() ? 'linear-gradient(135deg, #0023e6, #21d4fd)' : 'rgba(255,255,255,0.08)',
              color: '#fff', cursor: input.trim() ? 'pointer' : 'not-allowed',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
            <Send size={16} />
          </button>
        </div>
      </div>
    );
  }

  // ── CHANNELS / MEMBERS LIST ──
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ padding: '14px 16px 8px' }}>
        <div style={{ fontSize: 11, color: colors.mutedSilver, textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 700 }}>Team</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textIce, marginTop: 2 }}>Chat</div>
      </header>

      <div style={{ display: 'flex', gap: 6, padding: '0 14px 10px' }}>
        {(['channels', 'members'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              flex: 1, padding: '8px', borderRadius: radius.md,
              background: view === v ? 'rgba(0,35,230,0.25)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${view === v ? '#0023e6' : 'rgba(255,255,255,0.06)'}`,
              color: view === v ? colors.textIce : colors.mutedSilver,
              fontSize: 12, fontWeight: 700, letterSpacing: 0.4, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}>
            {v === 'channels' ? <MessageCircle size={14} /> : <Users size={14} />}
            {v === 'channels' ? 'Channels' : `Team (${members.length})`}
          </button>
        ))}
      </div>

      {error && <div style={{ padding: '0 14px 8px', color: '#ff8a3d', fontSize: 12 }}>{error}</div>}
      {loading && <div style={{ padding: 24, textAlign: 'center', color: colors.mutedSilver, fontSize: 13 }}>Loading…</div>}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 12px 16px' }}>
        {view === 'channels' && (
          <>
            <button onClick={() => setGroupOpen(true)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                padding: '12px 14px', marginBottom: 8, borderRadius: radius.md,
                background: 'rgba(0,35,230,0.10)', border: '1px solid rgba(0,35,230,0.30)',
                color: colors.textIce, cursor: 'pointer', fontSize: 13, fontWeight: 600,
              }}>
              <Plus size={16} /> New group chat
            </button>
            {channels.map((ch) => (
              <button key={ch.id} onClick={() => { setActiveChannel(ch); setView('chat'); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '12px 14px', marginBottom: 6, borderRadius: radius.md,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  color: colors.textIce, cursor: 'pointer', textAlign: 'left',
                }}>
                <MessageCircle size={16} style={{ color: colors.mutedSilver }} />
                <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{channelDisplay(ch)}</span>
              </button>
            ))}
            {channels.length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: colors.mutedSilver, fontSize: 12 }}>
                No channels yet. Start a DM from the Team tab.
              </div>
            )}
          </>
        )}

        {view === 'members' && (
          <>
            {members.filter((m) => !m.is_self).map((m) => (
              <button key={m.user_id} onClick={() => openDm(m)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 14px', marginBottom: 6, borderRadius: radius.md,
                  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
                  color: colors.textIce, cursor: 'pointer', textAlign: 'left',
                }}>
                <div style={{ position: 'relative', width: 36, height: 36, borderRadius: 18, background: 'rgba(0,35,230,0.20)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: colors.textIce }}>
                  {(m.full_name || m.email || '?').slice(0, 2).toUpperCase()}
                  <span style={{
                    position: 'absolute', right: -2, bottom: -2, width: 11, height: 11, borderRadius: 6,
                    background: STATUS_COLOR[m.status] || STATUS_COLOR.offline, border: '2px solid #0d1426',
                  }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {m.full_name || m.email || `Ext ${m.extension}`}
                  </div>
                  <div style={{ fontSize: 11, color: colors.mutedSilver, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Circle size={6} fill={STATUS_COLOR[m.status]} color={STATUS_COLOR[m.status]} />
                    {m.status}{m.extension ? ` · Ext ${m.extension}` : ''}
                  </div>
                </div>
              </button>
            ))}
            {members.filter((m) => !m.is_self).length === 0 && !loading && (
              <div style={{ padding: 24, textAlign: 'center', color: colors.mutedSilver, fontSize: 12 }}>
                No teammates found in your domain yet.
              </div>
            )}
          </>
        )}
      </div>

      {groupOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'flex-end', zIndex: 100,
        }} onClick={() => setGroupOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxHeight: '80vh', background: '#0d1426',
            borderRadius: '20px 20px 0 0', padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: colors.textIce }}>New group chat</div>
            <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name"
              style={{
                padding: '10px 14px', borderRadius: 10, background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.08)', color: colors.textIce, fontSize: 14, outline: 'none',
              }} />
            <div style={{ fontSize: 11, color: colors.mutedSilver, textTransform: 'uppercase', letterSpacing: 1, marginTop: 4 }}>
              Add members ({groupPicks.size})
            </div>
            <div style={{ flex: 1, overflowY: 'auto', maxHeight: '40vh' }}>
              {members.filter((m) => !m.is_self).map((m) => {
                const picked = groupPicks.has(m.user_id);
                return (
                  <button key={m.user_id} onClick={() => {
                    const next = new Set(groupPicks);
                    if (picked) next.delete(m.user_id); else next.add(m.user_id);
                    setGroupPicks(next);
                  }}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', marginBottom: 4, borderRadius: 10,
                      background: picked ? 'rgba(0,35,230,0.20)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${picked ? '#0023e6' : 'rgba(255,255,255,0.06)'}`,
                      color: colors.textIce, cursor: 'pointer', textAlign: 'left', fontSize: 13,
                    }}>
                    <span style={{ flex: 1 }}>{m.full_name || m.email || `Ext ${m.extension}`}</span>
                    {picked && <span style={{ fontSize: 11, color: '#21d4fd' }}>✓</span>}
                  </button>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setGroupOpen(false)}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'rgba(255,255,255,0.06)', border: 'none', color: colors.textIce, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                Cancel
              </button>
              <button onClick={createGroup} disabled={groupPicks.size === 0}
                style={{ flex: 1, padding: '10px', borderRadius: 10, background: 'linear-gradient(135deg, #0023e6, #21d4fd)', border: 'none', color: '#fff', cursor: groupPicks.size ? 'pointer' : 'not-allowed', fontSize: 13, fontWeight: 700, opacity: groupPicks.size ? 1 : 0.5 }}>
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
