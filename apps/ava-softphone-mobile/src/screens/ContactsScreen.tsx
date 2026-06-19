import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Phone, Search, Users, X } from 'lucide-react';
import { colors, font, radius } from '../lib/theme';
import { EmptyState, SectionTitle, Skeleton } from '../components/ui/Primitives';
import { useMobileCredentials } from '../hooks/useMobileCredentials';
import { authedRealtime, restGet, restPost } from '../lib/mobileSupabase';
import { loadCachedContacts, syncDeviceContacts } from '../lib/contacts';

type Kind = 'domain' | 'manual' | 'mobile';
type Contact = { id: string; kind: Kind; user_id: string | null; extension: string; phone?: string | null; email?: string | null; display_name: string | null; sip_domain: string | null; status: string | null; last_seen_at: string | null };
type Presence = { user_id: string; status: string; call_state?: string | null; last_seen_at: string | null };

const safe = (v: string) => encodeURIComponent(v);

export default function ContactsScreen({ sp }: { sp: any }) {
  const mobile = useMobileCredentials();
  const [q, setQ] = useState('');
  const [contacts, setContacts] = useState<Contact[] | null>(null);
  const [selectedKind, setSelectedKind] = useState<'all' | Kind>('all');
  const [addOpen, setAddOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', phone: '', email: '', company: '' });
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
    const [domainRows, manualRows] = await Promise.all([
      restGet<any[]>(`/rest/v1/pbx_softphone_users_safe?select=id,portal_user_id,extension,display_name,sip_domain,status,last_seen_at&domain_uuid=eq.${safe(mobile.domainUuid)}&order=extension.asc`, mobile.accessToken).catch(() => []),
      mobile.organizationId ? restGet<any[]>(`/rest/v1/org_contacts?select=id,name,phone,email,company,source,owner_user_id&organization_id=eq.${safe(mobile.organizationId)}&order=name.asc`, mobile.accessToken).catch(() => []) : Promise.resolve([]),
    ]);
    const domain = (domainRows || []).map((r) => ({ id: r.id, kind: 'domain' as const, user_id: r.portal_user_id, extension: r.extension, phone: r.extension, display_name: r.display_name, sip_domain: r.sip_domain, status: r.status, last_seen_at: r.last_seen_at }));
    const manual = (manualRows || []).map((r) => ({ id: r.id, kind: 'manual' as const, user_id: null, extension: r.phone || '', phone: r.phone, email: r.email, display_name: r.name, sip_domain: null, status: null, last_seen_at: null }));
    const device = loadCachedContacts().map((c) => ({ id: `mobile-${c.id}`, kind: 'mobile' as const, user_id: null, extension: c.numbers[0] || '', phone: c.numbers[0], email: c.emails?.[0], display_name: c.name, sip_domain: null, status: null, last_seen_at: null }));
    const mapped = [...domain, ...manual, ...device];
    setContacts(mapped);
    await loadPresence(domain);
  }, [loadPresence, mobile.accessToken, mobile.domainUuid, mobile.organizationId]);

  const addContact = useCallback(async () => {
    const name = newContact.name.trim();
    const phone = newContact.phone.trim();
    if (!name || !phone || !mobile.accessToken || !mobile.organizationId) return;
    try {
      await restPost('/rest/v1/org_contacts', mobile.accessToken, {
        organization_id: mobile.organizationId,
        owner_user_id: mobile.userId,
        name,
        phone,
        email: newContact.email.trim() || null,
        company: newContact.company.trim() || null,
        source: 'manual_mobile',
      });
      setNewContact({ name: '', phone: '', email: '', company: '' });
      setAddOpen(false);
      await loadContacts();
    } catch (e: any) { setError(e?.message || 'Contact add failed'); }
  }, [loadContacts, mobile.accessToken, mobile.organizationId, mobile.userId, newContact]);

  useEffect(() => {
    if (mobile.loading) return;
    if (!mobile.accessToken || !mobile.domainUuid) { setContacts([]); return; }
    let cancelled = false;
    syncDeviceContacts().then(() => loadContacts()).catch(() => {});
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
    const orgContactsChannel = mobile.organizationId ? client.channel(`org-contacts-${mobile.organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'org_contacts', filter: `organization_id=eq.${mobile.organizationId}` } as any, () => loadContacts().catch(() => {}))
      .subscribe() : null;
    return () => { client.removeChannel(softphoneChannel); client.removeChannel(presenceChannel); if (orgContactsChannel) client.removeChannel(orgContactsChannel); };
  }, [loadContacts, loadPresence, mobile.accessToken, mobile.domainUuid, mobile.organizationId, contacts]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    const byKind = selectedKind === 'all' ? contacts || [] : (contacts || []).filter((c) => c.kind === selectedKind);
    if (!term) return byKind;
    return byKind.filter((c) => (c.display_name || '').toLowerCase().includes(term) || (c.extension || '').includes(term) || (c.phone || '').includes(term) || (c.email || '').toLowerCase().includes(term));
  }, [contacts, q, selectedKind]);

  const loading = mobile.loading || contacts === null;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '14px 14px 24px' }}>
      <SectionTitle eyebrow={mobile.sipDomain || 'Directory'} title="People" right={<button onClick={() => setAddOpen(true)} style={{ width: 34, height: 34, borderRadius: 17, border: `1px solid ${colors.border}`, background: 'rgba(255,255,255,0.06)', color: colors.textIce, display: 'grid', placeItems: 'center' }}><Plus size={16} /></button>} />
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <Search size={16} color={colors.mutedSilver} style={{ position: 'absolute', left: 12, top: 13 }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name or extension" style={{ width: '100%', height: 42, boxSizing: 'border-box', padding: '0 14px 0 36px', borderRadius: radius.lg, background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`, color: colors.textIce, fontSize: 14, outline: 'none' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, overflowX: 'auto', paddingBottom: 2 }}>
        {(['all', 'domain', 'mobile', 'manual'] as const).map((k) => <button key={k} onClick={() => setSelectedKind(k)} style={{ flexShrink: 0, padding: '7px 10px', borderRadius: 999, border: `1px solid ${selectedKind === k ? colors.lemtelBlue : colors.border}`, background: selectedKind === k ? 'rgba(0,35,230,0.22)' : 'rgba(255,255,255,0.04)', color: selectedKind === k ? colors.textIce : colors.mutedSilver, fontSize: 12, fontWeight: 800, textTransform: 'capitalize' }}>{k === 'domain' ? 'My domain' : k}</button>)}
      </div>
      {error && <div style={{ color: colors.danger, fontSize: font.xs, marginBottom: 10 }}>{error}</div>}
      {loading && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} w="100%" h={56} />)}</div>}
      {!loading && filtered.length === 0 && <EmptyState icon={<Users size={28} />} title="No contacts" hint="Team extensions from your SIP domain will appear here." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {filtered.map((c) => {
          const pres = c.user_id ? presence[c.user_id] : null;
          const status = c.kind === 'domain' ? statusFor(pres, c) : c.kind;
          const dot = c.kind === 'domain' ? (STATUS_COLOR[status] || STATUS_COLOR.offline) : (c.kind === 'manual' ? colors.avaCyan : colors.signalGold);
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
                <div style={{ fontSize: 11, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>{c.kind === 'domain' ? `Ext ${c.extension} · ${status.replace('_', ' ')}` : `${c.kind === 'manual' ? 'New contact' : 'Mobile contact'} · ${c.phone || c.email || ''}`}</div>
              </div>
              <button onClick={() => sp?.call?.(c.phone || c.extension)} aria-label={`Call ${name}`} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, #22c55e, #16a34a)`, color: '#fff', display: 'grid', placeItems: 'center' }}><Phone size={18} /></button>
            </div>
          );
        })}
      </div>
      {addOpen && <AddContactSheet value={newContact} setValue={setNewContact} onClose={() => setAddOpen(false)} onSave={addContact} />}
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