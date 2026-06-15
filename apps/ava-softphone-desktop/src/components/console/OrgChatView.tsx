import React, { useEffect, useMemo, useRef, useState } from 'react';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from '../../lib/i18n';

const { colors: c } = theme;

type Channel = { id: string; name: string; channel_type: string; organization_id: string; members: string[] | null; archived_at: string | null };
type Message = { id: string; channel_id: string; sender_id: string; sender_name: string | null; content: string; created_at: string };
type Member = { user_id: string; display_name: string; extension: string | null; status: string; call_state: string | null };

const STATUS_COLOR: Record<string, string> = {
  online: '#22d39a', available: '#22d39a',
  busy: '#ff5a5f', dnd: '#ff5a5f', on_call: '#ff8a3d',
  away: '#f4c248', idle: '#f4c248',
  offline: '#6b7280',
};

const isDmChannel = (ch: Channel) => ch.channel_type === 'dm' || ch.name.startsWith('dm:');

export default function OrgChatView() {
  const { t } = useTranslation();
  const [channels, setChannels] = useState<Channel[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [me, setMe] = useState<{ id: string; name: string } | null>(null);
  const [reads, setReads] = useState<Record<string, string>>({});
  const [orgId, setOrgId] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [showGroup, setShowGroup] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadChannels = async (org: string) => {
    const edge = await supabase.functions.invoke('org-chat', { body: { action: 'list_channels' } }).catch(() => ({ data: null, error: null } as any));
    if (Array.isArray((edge.data as any)?.channels)) {
      const channels = (edge.data as any).channels as Channel[];
      setChannels(channels);
      return channels;
    }
    const { data, error } = await supabase.from('org_chat_channels')
      .select('id,name,channel_type,organization_id,members,archived_at')
      .eq('organization_id', org).is('archived_at', null)
      .order('name');
    if (error) { setErrMsg(`Channels error: ${error.message}`); return [] as Channel[]; }
    setChannels(data ?? []);
    return (data ?? []) as Channel[];
  };

  const loadMembers = async (org: string) => {
    const { data: dir } = await supabase.functions.invoke('org-chat', { body: { action: 'list_directory' } }).catch(() => ({ data: null } as any));
    if (Array.isArray((dir as any)?.members)) {
      setMembers((dir as any).members.map((m: any) => ({
        user_id: m.user_id,
        display_name: m.full_name || m.email || `Ext ${m.extension || ''}`,
        extension: m.extension,
        status: m.status || 'offline',
        call_state: m.call_state || null,
      })));
      return;
    }
    const { data: spus } = await supabase.from('pbx_softphone_users')
      .select('portal_user_id, display_name, extension')
      .eq('organization_id', org)
      .not('portal_user_id', 'is', null);
    const ids = (spus ?? []).map((s: any) => s.portal_user_id);
    let presence: Record<string, any> = {};
    if (ids.length) {
      const { data: pres } = await supabase.from('user_presence')
        .select('user_id,status,call_state').in('user_id', ids);
      (pres ?? []).forEach((p: any) => { presence[p.user_id] = p; });
    }
    setMembers((spus ?? []).map((s: any) => ({
      user_id: s.portal_user_id,
      display_name: s.display_name || `Ext ${s.extension}`,
      extension: s.extension,
      status: presence[s.portal_user_id]?.status || 'offline',
      call_state: presence[s.portal_user_id]?.call_state || null,
    })));
  };

  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) { setErrMsg('Sign in required to use Team Chat.'); return; }
        const name = (u.user.user_metadata as any)?.full_name ?? u.user.email ?? 'You';
        setMe({ id: u.user.id, name });

        let org: string | null = null;
        const { data: spu } = await supabase.from('pbx_softphone_users')
          .select('organization_id').eq('portal_user_id', u.user.id).maybeSingle();
        org = spu?.organization_id ?? null;
        if (!org) {
          const { data: om } = await supabase.from('organization_members')
            .select('organization_id').eq('user_id', u.user.id).limit(1).maybeSingle();
          org = om?.organization_id ?? null;
        }
        if (!org) {
          const { data: ur } = await supabase.from('user_roles')
            .select('organization_id').eq('user_id', u.user.id).limit(1).maybeSingle();
          org = ur?.organization_id ?? null;
        }
        if (!org) { setErrMsg('No organization linked to your account yet — ask an admin to add you.'); return; }
        setOrgId(org);

        await supabase.rpc('ensure_general_channel', { _org_id: org, _user_id: u.user.id });

        const chs = await loadChannels(org);
        const first = chs.find((c) => !isDmChannel(c));
        if (first) setActiveId(first.id);

        await loadMembers(org);

        const { data: r } = await supabase.from('org_chat_reads')
          .select('channel_id,last_read_at').eq('user_id', u.user.id);
        const map: Record<string, string> = {};
        (r ?? []).forEach((x: any) => { map[x.channel_id] = x.last_read_at; });
        setReads(map);
      } catch (e: any) {
        setErrMsg(e?.message || 'Failed to load team chat.');
      }
    })();
  }, []);

  // Realtime presence
  useEffect(() => {
    if (!orgId) return;
    const ch = supabase.channel(`presence:${orgId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence' }, () => {
        loadMembers(orgId);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [orgId]);

  // Messages
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('org_chat_messages')
        .select('id,channel_id,sender_id,sender_name,content,created_at')
        .eq('channel_id', activeId).is('deleted_at', null)
        .order('created_at', { ascending: true }).limit(200);
      if (!cancelled) setMessages(data ?? []);
    })();

    const ch = supabase.channel(`chat:${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'org_chat_messages', filter: `channel_id=eq.${activeId}` },
        (payload) => setMessages((m) => [...m, payload.new as Message]))
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    if (activeId && me) {
      const now = new Date().toISOString();
      supabase.from('org_chat_reads').upsert({ user_id: me.id, channel_id: activeId, last_read_at: now }).then(() => {
        setReads((r) => ({ ...r, [activeId]: now }));
      });
    }
  }, [messages, activeId, me]);

  const send = async () => {
    if (!input.trim() || !activeId || !me || !orgId) return;
    const text = input.trim();
    setInput('');
    const { error, data } = await supabase.functions.invoke('org-chat', {
      body: { action: 'send_message', payload: { channel_id: activeId, content: text } },
    });
    if (error || (data as any)?.error) setErrMsg(`Message error: ${((error as any)?.message || (data as any)?.error)}`);
  };

  const openDM = async (otherId: string, otherName: string) => {
    if (!me || !orgId || otherId === me.id) return;
    const key = [me.id, otherId].sort().join(':');
    const dmName = `dm:${key}`;
    let dm = channels.find((c) => isDmChannel(c) && (c.name === dmName || (c.members?.includes(me.id) && c.members?.includes(otherId))));
    if (!dm) {
      const { data, error } = await supabase.functions.invoke('org-chat', { body: { action: 'ensure_dm_channel', payload: { user_id: otherId } } });
      if (error || !(data as any)?.channel) { alert('DM error: ' + ((error as any)?.message || (data as any)?.error || 'Unable to open chat')); return; }
      dm = (data as any).channel as Channel;
      setChannels((cs) => [...cs, dm!]);
    }
    setActiveId(dm.id);
  };

  const createGroup = async (name: string, memberIds: string[]) => {
    if (!me || !orgId || !name.trim()) return;
    const { data, error } = await supabase.from('org_chat_channels').insert({
      organization_id: orgId, name: name.trim(), description: null,
      channel_type: 'private', created_by: me.id, members: [...new Set([me.id, ...memberIds])],
    }).select('*').single();
    if (error) { alert('Group error: ' + error.message); return; }
    setChannels((cs) => [...cs, data as Channel]);
    setActiveId((data as Channel).id);
    setShowGroup(false);
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const q = search.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, search]);

  const dmNameFor = (ch: Channel) => {
    if (!me || !isDmChannel(ch) || !ch.members) return ch.name;
    const other = ch.members.find((id) => id !== me.id);
    return members.find((m) => m.user_id === other)?.display_name || 'Direct message';
  };

  const visibleChannels = channels.filter((c) => !isDmChannel(c));
  const activeChannel = channels.find((ch) => ch.id === activeId);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Sidebar */}
      <aside style={{ width: 240, borderRight: `1px solid ${c.border}`, background: c.deepPanel, padding: 14, overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: c.signalGold, textTransform: 'uppercase' }}>
            {t('orgchat.channels')}
          </div>
          <button onClick={() => setShowGroup(true)} title="New group chat" style={{
            background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce,
            fontSize: 11, padding: '2px 8px', borderRadius: 6, cursor: 'pointer',
          }}>+ Group</button>
        </div>
        {visibleChannels.length === 0 && <div style={{ fontSize: 12, color: c.mutedSilver }}>{t('orgchat.noChannels')}</div>}
        {visibleChannels.map((ch) => {
          const active = ch.id === activeId;
          return (
            <button key={ch.id} onClick={() => setActiveId(ch.id)} style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', marginBottom: 2, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: active ? 'rgba(122,76,255,0.18)' : 'transparent',
              color: active ? c.textIce : c.mutedSilver,
              fontSize: 12.5, fontWeight: active ? 700 : 500, textAlign: 'left',
            }}>
              <span>{ch.channel_type === 'private' ? '🔒' : '#'} {ch.name}</span>
            </button>
          );
        })}

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: c.signalGold, textTransform: 'uppercase', margin: '18px 0 8px' }}>
          Team ({members.length})
        </div>
        {members.length === 0 && <div style={{ fontSize: 11, color: c.mutedSilver }}>No teammates yet.</div>}
        {members.filter((m) => m.user_id !== me?.id).map((m) => {
          const color = STATUS_COLOR[m.status] || STATUS_COLOR.offline;
          return (
            <button key={m.user_id} onClick={() => openDM(m.user_id, m.display_name)} style={{
              display: 'flex', width: '100%', alignItems: 'center', gap: 8,
              padding: '6px 8px', marginBottom: 1, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: c.textIce, fontSize: 12, textAlign: 'left',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.display_name}</span>
              {m.extension && <span style={{ fontSize: 10, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{m.extension}</span>}
            </button>
          );
        })}
        {errMsg && <div style={{ fontSize: 11, color: c.danger, marginTop: 8 }}>{errMsg}</div>}
      </aside>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ padding: '12px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 15, color: c.textIce }}>
            {activeChannel ? (isDmChannel(activeChannel) ? '@ ' + dmNameFor(activeChannel) : (activeChannel.channel_type === 'private' ? '🔒 ' : '# ') + activeChannel.name) : '—'}
          </h2>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('orgchat.searchPlaceholder')}
            style={{ marginLeft: 'auto', padding: '6px 10px', borderRadius: 8, border: `1px solid ${c.border}`, background: 'rgba(140,180,255,0.06)', color: c.textIce, fontSize: 12, minWidth: 200 }} />
        </header>

        <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
          {filtered.length === 0 && (
            <div style={{ color: c.mutedSilver, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
              {messages.length === 0 ? t('orgchat.sayHi') : t('orgchat.noMatches')}
            </div>
          )}
          {filtered.map((m) => (
            <div key={m.id} style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
                <strong style={{ color: c.textIce, fontSize: 12.5 }}>{m.sender_name ?? 'User'}</strong>
                <span style={{ color: c.mutedSilver, fontSize: 10, fontFamily: 'JetBrains Mono, monospace' }}>
                  {new Date(m.created_at).toLocaleString()}
                </span>
              </div>
              <div style={{ color: c.textIce, fontSize: 13, lineHeight: 1.5, marginTop: 2, whiteSpace: 'pre-wrap' }}>{m.content}</div>
            </div>
          ))}
        </div>

        <div style={{ padding: 12, borderTop: `1px solid ${c.border}`, display: 'flex', gap: 8 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder={activeId ? t('orgchat.messagePlaceholder') : t('orgchat.selectChannel')} disabled={!activeId}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1px solid ${c.border}`, background: 'rgba(140,180,255,0.06)', color: c.textIce, fontSize: 13 }} />
          <button onClick={send} disabled={!input.trim() || !activeId} style={{
            padding: '10px 18px', borderRadius: 9, border: 'none', cursor: 'pointer',
            background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
            color: '#fff', fontWeight: 700, fontSize: 12,
            opacity: !input.trim() || !activeId ? 0.5 : 1,
          }}>{t('common.send')}</button>
        </div>
      </div>

      {showGroup && me && (
        <NewGroupModal
          members={members.filter((m) => m.user_id !== me.id)}
          onClose={() => setShowGroup(false)}
          onCreate={createGroup}
        />
      )}
    </div>
  );
}

function NewGroupModal({ members, onClose, onCreate }: { members: Member[]; onClose: () => void; onCreate: (name: string, ids: string[]) => void }) {
  const [name, setName] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 420, maxHeight: '85vh', display: 'flex', flexDirection: 'column', background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textIce, marginBottom: 12 }}>New group chat</div>
        <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name" style={{
          width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
          background: c.deepPanel, border: `1px solid ${c.border}`, color: c.textIce, fontSize: 13, outline: 'none', marginBottom: 12,
        }} />
        <div style={{ fontSize: 10, fontWeight: 700, color: c.mutedSilver, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>Members ({selected.size})</div>
        <div style={{ flex: 1, overflowY: 'auto', border: `1px solid ${c.border}`, borderRadius: 8 }}>
          {members.length === 0 && <div style={{ padding: 12, color: c.mutedSilver, fontSize: 12 }}>No teammates available.</div>}
          {members.map((m) => (
            <label key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: `1px solid ${c.border}`, fontSize: 12, color: c.textIce, cursor: 'pointer' }}>
              <input type="checkbox" checked={selected.has(m.user_id)} onChange={() => toggle(m.user_id)} />
              <span style={{ flex: 1 }}>{m.display_name}</span>
              {m.extension && <span style={{ fontSize: 10, color: c.mutedSilver }}>{m.extension}</span>}
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onCreate(name, Array.from(selected))} disabled={!name.trim() || selected.size === 0} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
            background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
            opacity: !name.trim() || selected.size === 0 ? 0.5 : 1,
          }}>Create</button>
        </div>
      </div>
    </div>
  );
}
