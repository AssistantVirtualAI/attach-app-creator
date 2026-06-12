import React, { useEffect, useMemo, useRef, useState } from 'react';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';
import { useTranslation } from '../../lib/i18n';

const { colors: c } = theme;

type Channel = { id: string; name: string; channel_type: string; organization_id: string; archived_at: string | null };
type Message = { id: string; channel_id: string; sender_id: string; sender_name: string | null; content: string; created_at: string };

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
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load me + org + channels
  useEffect(() => {
    (async () => {
      try {
        const { data: u } = await supabase.auth.getUser();
        if (!u.user) { setErrMsg('Sign in required to use Team Chat.'); return; }
        const name = (u.user.user_metadata as any)?.full_name ?? u.user.email ?? 'You';
        setMe({ id: u.user.id, name });

        // Try multiple sources to resolve the user's organization.
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
          const { data: om2 } = await supabase.from('org_members')
            .select('org_id').eq('user_id', u.user.id).limit(1).maybeSingle();
          org = (om2 as any)?.org_id ?? null;
        }
        if (!org) {
          const { data: ur } = await supabase.from('user_roles')
            .select('organization_id').eq('user_id', u.user.id).limit(1).maybeSingle();
          org = ur?.organization_id ?? null;
        }
        if (!org) { setErrMsg('No organization linked to your account yet — ask an admin to add you.'); return; }
        setOrgId(org);

        await supabase.rpc('ensure_general_channel', { _org_id: org, _user_id: u.user.id });

        const { data: chs, error: chErr } = await supabase.from('org_chat_channels')
          .select('id,name,channel_type,organization_id,archived_at')
          .eq('organization_id', org).is('archived_at', null)
          .order('name');
        if (chErr) { setErrMsg(`Channels error: ${chErr.message}`); return; }
        setChannels(chs ?? []);
        if (chs?.length) setActiveId(chs[0].id);

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

  // Load messages for active channel + realtime
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
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'org_chat_messages',
        filter: `channel_id=eq.${activeId}`,
      }, (payload) => {
        setMessages((m) => [...m, payload.new as Message]);
      })
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [activeId]);

  // Auto-scroll + mark read
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
    await supabase.from('org_chat_messages').insert({
      organization_id: orgId, channel_id: activeId,
      sender_id: me.id, sender_name: me.name, content: text,
    });
  };

  const filtered = useMemo(() => {
    if (!search.trim()) return messages;
    const q = search.toLowerCase();
    return messages.filter((m) => m.content.toLowerCase().includes(q));
  }, [messages, search]);

  const unreadCount = (chId: string) => {
    const last = reads[chId];
    if (!last && chId === activeId) return 0;
    if (chId === activeId) return 0;
    return 0; // placeholder; full count requires aggregate query
  };

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Channel sidebar */}
      <aside style={{ width: 220, borderRight: `1px solid ${c.border}`, background: c.deepPanel, padding: 14, overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: c.signalGold, textTransform: 'uppercase', marginBottom: 10 }}>
          {t('orgchat.channels')}
        </div>
        {channels.length === 0 && <div style={{ fontSize: 12, color: c.mutedSilver }}>{t('orgchat.noChannels')}</div>}
        {channels.map((ch) => {
          const active = ch.id === activeId;
          const unread = unreadCount(ch.id);
          return (
            <button key={ch.id} onClick={() => setActiveId(ch.id)} style={{
              display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 10px', marginBottom: 2, borderRadius: 8, border: 'none', cursor: 'pointer',
              background: active ? 'rgba(122,76,255,0.18)' : 'transparent',
              color: active ? c.textIce : c.mutedSilver,
              fontSize: 12.5, fontWeight: active ? 700 : 500, textAlign: 'left',
            }}>
              <span># {ch.name}</span>
              {unread > 0 && <span style={{ background: c.danger, color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 6px' }}>{unread}</span>}
            </button>
          );
        })}
        {errMsg && <div style={{ fontSize: 11, color: c.danger, marginTop: 8 }}>{errMsg}</div>}
      </aside>

      {/* Messages */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <header style={{ padding: '12px 18px', borderBottom: `1px solid ${c.border}`, display: 'flex', gap: 12, alignItems: 'center' }}>
          <h2 style={{ margin: 0, fontSize: 15, color: c.textIce }}># {channels.find((c) => c.id === activeId)?.name ?? '—'}</h2>
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
    </div>
  );
}
