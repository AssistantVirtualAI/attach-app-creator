import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Phone, Search, Users } from 'lucide-react';
import { colors, font, radius } from '../lib/theme';
import { EmptyState, SectionTitle, Skeleton } from '../components/ui/Primitives';
import { useMobileCredentials } from '../hooks/useMobileCredentials';
import { authedRealtime, restGet } from '../lib/mobileSupabase';

type Contact = { id: string; user_id: string | null; extension: string; display_name: string | null; sip_domain: string | null; status: string | null; last_seen_at: string | null };
type Presence = { user_id: string; status: string; call_state?: string | null; last_seen_at: string | null };

const safe = (v: string) => encodeURIComponent(v);

export default function ContactsScreen({ sp }: { sp: any }) {
  const mobile = useMobileCredentials();
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [presence, setPresence] = useState<Record<string, Presence>>({});
  const [error, setError] = useState<string | null>(null);

  const loadPresence = useCallback(async (rows: Contact[] | null) => {
    if (!mobile.accessToken || !rows?.length) { setPresence({}); return; }
    const ids = rows.map((c) => c.user_id).filter(Boolean) as string[];
    if (!ids.length) { setPresence({}); return; }
    const pres = await restGet<Presence[]>(`/rest/v1/user_presence?select=user_id,status,call_state,last_seen_at&user_id=in.(${ids.map((id) => `"${id}"`).join(',')})`, mobile.accessToken);
    const map: Record<string, Presence> = {};
    (pres || []).forEach((p) => { map[p.user_id] = p; });
    setPresence(map);
  }, [mobile.accessToken]);

  const loadContacts = useCallback(async () => {
    if (!mobile.accessToken || !mobile.domainUuid) return;
    const rows = await restGet<any[]>(`/rest/v1/pbx_softphone_users_safe?select=id,portal_user_id,extension,display_name,sip_domain,status,last_seen_at&domain_uuid=eq.${safe(mobile.domainUuid)}&order=extension.asc`, mobile.accessToken);
    const mapped = (rows || []).map((r) => ({ id: r.id, user_id: r.portal_user_id, extension: r.extension, display_name: r.display_name, sip_domain: r.sip_domain, status: r.status, last_seen_at: r.last_seen_at }));
    setContacts(mapped);
    await loadPresence(mapped);
  }, [loadPresence, mobile.accessToken, mobile.domainUuid]);

  useEffect(() => {
    if (mobile.loading) return;
    if (!mobile.accessToken || !mobile.domainUuid) { setContacts([]); return; }
    let cancelled = false;
    loadContacts().then(() => !cancelled && setError(null)).catch((e) => {
      if (!cancelled) { setContacts([]); setError(e?.message || 'Contacts failed'); }
    });
    return () => { cancelled = true; };
  }, [loadContacts, mobile.loading, mobile.accessToken, mobile.domainUuid]);

  useEffect(() => {
    if (!mobile.accessToken || !mobile.domainUuid) return;
    const client = authedRealtime(mobile.accessToken);
    const softphoneChannel = client.channel(`contacts-domain-${mobile.domainUuid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_softphone_users', filter: `domain_uuid=eq.${mobile.domainUuid}` } as any, () => loadContacts().catch(() => {}))
      .subscribe();
    const presenceChannel = client.channel(`presence-domain-${mobile.organizationId || mobile.domainUuid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence', ...(mobile.organizationId ? { filter: `organization_id=eq.${mobile.organizationId}` } : {}) } as any, () => loadPresence(contacts).catch(() => {}))
      .subscribe();
    return () => { client.removeChannel(softphoneChannel); client.removeChannel(presenceChannel); };
  }, [loadContacts, loadPresence, mobile.accessToken, mobile.domainUuid, mobile.organizationId, contacts]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return contacts || [];
    return (contacts || []).filter((c) => (c.display_name || '').toLowerCase().includes(term) || c.extension.includes(term));
  }, [contacts, q]);

  const loading = mobile.loading || contacts === null;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '14px 14px 24px' }}>
      <SectionTitle eyebrow={mobile.sipDomain || 'Directory'} title="Contacts" />
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} color={colors.mutedSilver} style={{ position: 'absolute', left: 12, top: 13 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or extension" style={{ width: '100%', height: 42, boxSizing: 'border-box', padding: '0 14px 0 36px', borderRadius: radius.lg, background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.textIce, fontSize: 14, outline: 'none' }} />
      </div>
      {error && <div style={{ color: colors.danger, fontSize: font.xs, marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} w="100%" h={56} />)}</div>}
      {!loading && filtered.length === 0 && <EmptyState icon={<Users size={28} />} title="No contacts" hint="Team extensions from your SIP domain will appear here." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((c) => {
          const pres = c.user_id ? presence[c.user_id] : null;
          const status = statusFor(pres, c);
          const dot = STATUS_COLOR[status] || STATUS_COLOR.offline;
          const name = c.display_name || `Ext ${c.extension}`;
          const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
          return (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: radius.lg, background: 'rgba(255,255,255,0.04)', border: `1px solid ${colors.border}` }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', background: `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.avaCyan})`, color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14 }}>{initials}</div>
                <span style={{ position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%', background: dot, border: '2px solid #0d1426', boxShadow: `0 0 6px ${dot}aa` }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.sm, fontWeight: 800, color: colors.textIce, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
                <div style={{ fontSize: 11, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>Ext {c.extension} · {status.replace('_', ' ')}</div>
              </div>
              <button onClick={() => sp?.call?.(c.extension)} aria-label={`Call ${name}`} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, #22c55e, #16a34a)`, color: '#fff', display: 'grid', placeItems: 'center' }}><Phone size={18} /></button>
            </div>
          );
        })}
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}

function statusFor(pres: Presence | null, c: Contact) {
  if (pres?.call_state && pres.call_state !== 'idle') return 'on_call';
  const last = pres?.last_seen_at || c.last_seen_at;
  const stale = !last || Date.now() - new Date(last).getTime() > 5 * 60 * 1000;
  if (stale) return pres?.status === 'available' ? 'away' : (pres?.status || c.status || 'offline');
  return pres?.status || c.status || 'available';
}

const STATUS_COLOR: Record<string, string> = { available: '#22c55e', online: '#22c55e', busy: '#f59e0b', dnd: '#ef4444', on_call: '#3b82f6', away: '#94a3b8', offline: '#64748b', meeting: '#a855f7', lunch: '#eab308', break: '#f97316', out_of_office: '#64748b' };