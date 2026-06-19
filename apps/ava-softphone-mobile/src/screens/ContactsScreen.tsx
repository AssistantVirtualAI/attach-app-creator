import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Search, Star, Users, UserCircle2 } from 'lucide-react';
import { colors, font, radius } from '../lib/theme';
import { Card, EmptyState, SectionTitle, Skeleton } from '../components/ui/Primitives';
import { getCredentials } from '../lib/creds';

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const SUPABASE_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

type Internal = {
  user_id: string;
  extension: string;
  display_name: string | null;
  sip_domain: string | null;
  status?: string;
  last_seen_at?: string | null;
  source: 'internal';
};
type External = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  company?: string | null;
  favorite?: boolean;
  source: 'external';
};
type Contact = Internal | External;

async function rest(path: string, token: string) {
  const r = await fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
  });
  if (!r.ok) return [];
  return r.json().catch(() => []);
}

export default function ContactsScreen({ sp }: { sp: any }) {
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState<'all' | 'internal' | 'external'>('all');
  const [internals, setInternals] = useState<Internal[] | null>(null);
  const [externals, setExternals] = useState<External[] | null>(null);
  const [presence, setPresence] = useState<Record<string, { status: string; last_seen_at: string | null }>>({});

  useEffect(() => {
    (async () => {
      const creds = await getCredentials();
      const token = creds?.accessToken;
      const orgId = creds?.organizationId;
      const domainUuid = (creds as any)?.domainUuid || creds?.fusionpbxDomainUuid;
      if (!token || !orgId) { setInternals([]); setExternals([]); return; }

      // Internal extensions for the same domain/org
      let intQuery = `/rest/v1/pbx_softphone_users?select=portal_user_id,extension,display_name,sip_domain,status,last_seen_at&organization_id=eq.${orgId}&order=extension.asc`;
      if (domainUuid) intQuery += `&domain_uuid=eq.${domainUuid}`;
      const intRows = await rest(intQuery, token);
      const internal: Internal[] = (intRows || [])
        .filter((r: any) => r.extension && r.extension !== creds?.extension)
        .map((r: any) => ({
          user_id: r.portal_user_id,
          extension: r.extension,
          display_name: r.display_name,
          sip_domain: r.sip_domain,
          status: r.status,
          last_seen_at: r.last_seen_at,
          source: 'internal' as const,
        }));
      setInternals(internal);

      // External contacts
      const extRows = await rest(
        `/rest/v1/org_contacts?select=id,name,phone,email,company,favorite&organization_id=eq.${orgId}&order=favorite.desc,name.asc`,
        token,
      );
      setExternals((extRows || []).map((r: any) => ({ ...r, source: 'external' as const })));

      // Presence
      const userIds = internal.map((i) => i.user_id).filter(Boolean);
      if (userIds.length) {
        const inList = userIds.map((u) => `"${u}"`).join(',');
        const pres = await rest(
          `/rest/v1/user_presence?select=user_id,status,last_seen_at&user_id=in.(${inList})`,
          token,
        );
        const map: Record<string, any> = {};
        (pres || []).forEach((p: any) => { map[p.user_id] = { status: p.status, last_seen_at: p.last_seen_at }; });
        setPresence(map);
      }
    })().catch(() => { setInternals([]); setExternals([]); });
  }, []);

  // Realtime presence updates
  useEffect(() => {
    let es: EventSource | null = null;
    let cancelled = false;
    (async () => {
      const creds = await getCredentials();
      const token = creds?.accessToken;
      if (!token) return;
      // Lightweight polling fallback every 30s (Realtime requires the SDK)
      const tick = async () => {
        if (cancelled || !internals?.length) return;
        const ids = internals.map((i) => i.user_id).filter(Boolean);
        if (!ids.length) return;
        const inList = ids.map((u) => `"${u}"`).join(',');
        const pres = await rest(
          `/rest/v1/user_presence?select=user_id,status,last_seen_at&user_id=in.(${inList})`,
          token,
        );
        const map: Record<string, any> = {};
        (pres || []).forEach((p: any) => { map[p.user_id] = { status: p.status, last_seen_at: p.last_seen_at }; });
        if (!cancelled) setPresence(map);
      };
      const iv = setInterval(tick, 30000);
      return () => clearInterval(iv);
    })();
    return () => { cancelled = true; es?.close(); };
  }, [internals]);

  const all: Contact[] = useMemo(() => {
    const a: Contact[] = [];
    if (filter !== 'external') a.push(...(internals || []));
    if (filter !== 'internal') a.push(...(externals || []));
    if (!q.trim()) return a;
    const k = q.toLowerCase();
    return a.filter((c) => {
      const name = c.source === 'internal' ? (c.display_name || c.extension) : c.name;
      const number = c.source === 'internal' ? c.extension : c.phone;
      return name?.toLowerCase().includes(k) || number?.includes(k);
    });
  }, [internals, externals, q, filter]);

  const loading = internals === null || externals === null;

  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '14px 14px 24px' }}>
      <SectionTitle eyebrow="Directory" title="Contacts" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <Search size={16} color={colors.mutedSilver} style={{ position: 'absolute', marginLeft: 12 }} />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search name or number"
          style={{
            flex: 1, height: 42, padding: '0 14px 0 36px', borderRadius: radius.lg,
            background: 'rgba(255,255,255,0.06)', border: `1px solid ${colors.border}`,
            color: colors.textIce, fontSize: 14, outline: 'none',
          }}
        />
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {(['all', 'internal', 'external'] as const).map((f) => {
          const on = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} style={{
              flex: 1, padding: '8px 10px', borderRadius: radius.lg, border: `1px solid ${on ? colors.lemtelBlue : colors.border}`,
              background: on ? `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.avaCyan})` : 'rgba(255,255,255,0.04)',
              color: on ? '#fff' : colors.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer', textTransform: 'capitalize',
            }}>{f === 'all' ? 'All' : f === 'internal' ? 'Team' : 'External'}</button>
          );
        })}
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} w="100%" h={56} />)}
        </div>
      )}

      {!loading && all.length === 0 && (
        <EmptyState icon={<Users size={28} />} title="No contacts" hint="Internal teammates and external contacts will appear here." />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {all.map((c) => {
          const isInternal = c.source === 'internal';
          const name = isInternal ? (c.display_name || `Ext ${c.extension}`) : c.name;
          const number = isInternal ? c.extension : c.phone;
          const sub = isInternal ? `Ext ${c.extension}${c.sip_domain ? ' · ' + c.sip_domain : ''}` : (c.company || c.email || '');
          const pres = isInternal ? presence[c.user_id] : null;
          const status = pres?.status || c.status || 'offline';
          const dotColor = STATUS_COLOR[status] || '#94a3b8';
          const initials = (name || '?').split(/\s+/).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
          return (
            <div key={(isInternal ? 'i' : 'e') + (isInternal ? c.user_id || c.extension : c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                borderRadius: radius.lg, background: 'rgba(255,255,255,0.04)',
                border: `1px solid ${colors.border}`,
              }}>
              <div style={{ position: 'relative' }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: isInternal
                    ? `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.avaCyan})`
                    : 'linear-gradient(135deg, #f59e0b, #ef4444)',
                  color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 14,
                }}>{initials}</div>
                {isInternal && (
                  <span style={{
                    position: 'absolute', bottom: -2, right: -2, width: 12, height: 12, borderRadius: '50%',
                    background: dotColor, border: '2px solid #0d1426', boxShadow: `0 0 6px ${dotColor}aa`,
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: font.sm, fontWeight: 700, color: colors.textIce }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                  {!isInternal && c.favorite && <Star size={12} color={colors.signalGold} fill={colors.signalGold} />}
                </div>
                <div style={{ fontSize: 11, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
                  {sub || number}
                </div>
              </div>
              <button
                onClick={() => sp.call(number)}
                aria-label={`Call ${name}`}
                style={{
                  width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: `linear-gradient(135deg, #22c55e, #16a34a)`, color: '#fff',
                  display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px -8px #16a34a',
                }}>
                <Phone size={18} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const STATUS_COLOR: Record<string, string> = {
  available: '#22c55e',
  online: '#22c55e',
  busy: '#f59e0b',
  dnd: '#ef4444',
  on_call: '#3b82f6',
  away: '#94a3b8',
  offline: '#64748b',
};
