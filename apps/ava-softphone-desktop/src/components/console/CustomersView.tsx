import { useCallback, useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava } from '../../lib/avaApi';
import { supabase } from '../../lib/supabaseClient';
import PageHeader, { ListSkeleton, EmptyState } from './PageHeader';

const { colors: c } = theme;

type Row = {
  domain_uuid: string;
  domain_name: string;
  domain_description?: string;
  domain_enabled?: string | boolean;
  org_id?: string | null;
  org_name?: string | null;
  extensions: number;
  numbers: number;
  queues: number;
};

export default function CustomersView() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const domains = await ava.domains();
      // Pull org map + counts in one round-trip
      const [{ data: orgs }, { data: exts }, { data: nums }, { data: queues }] = await Promise.all([
        supabase.from('organizations').select('id,name,fusionpbx_domain_uuid'),
        supabase.from('pbx_extensions').select('organization_id'),
        supabase.from('pbx_phone_number_assignments').select('organization_id'),
        supabase.from('pbx_call_queues').select('organization_id'),
      ]);
      const orgByDomain = new Map<string, { id: string; name: string }>();
      for (const o of (orgs || [])) {
        if (o.fusionpbx_domain_uuid) orgByDomain.set(o.fusionpbx_domain_uuid, { id: o.id, name: o.name });
      }
      const countBy = (arr: any[] | null, orgId?: string | null) =>
        orgId ? (arr || []).filter((r) => r.organization_id === orgId).length : 0;

      const mapped: Row[] = (domains || []).map((d: any) => {
        const org = orgByDomain.get(d.domain_uuid);
        return {
          domain_uuid: d.domain_uuid,
          domain_name: d.domain_name,
          domain_description: d.domain_description || '',
          domain_enabled: d.domain_enabled,
          org_id: org?.id || null,
          org_name: org?.name || null,
          extensions: countBy(exts, org?.id),
          numbers: countBy(nums, org?.id),
          queues: countBy(queues, org?.id),
        };
      });
      mapped.sort((a, b) => a.domain_name.localeCompare(b.domain_name));
      setRows(mapped);
    } catch (e: any) {
      setError(e?.message || 'Failed to load customers');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const syncDomain = async (r: Row) => {
    if (!r.org_id) { alert('No organization linked to this PBX domain yet.'); return; }
    setSyncing(r.domain_uuid);
    try {
      await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'sync-all', resources: ['extensions','queues','ivrs','ring_groups','cdrs'], organization_id: r.org_id, domain_uuid: r.domain_uuid },
      });
      await load();
    } catch (e: any) { alert('Sync failed: ' + (e?.message || 'unknown')); }
    finally { setSyncing(null); }
  };

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      <PageHeader
        eyebrow="PBX"
        title="Customers"
        subtitle="Every FusionPBX domain on this server. Each domain is a customer / tenant."
        accent={c.signalGold}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 7h18M3 12h18M3 17h18"/></svg>}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {error && <div style={{ padding: 14, color: c.danger, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, marginBottom: 12 }}>{error}</div>}
      {loading && <ListSkeleton rows={6} />}
      {!loading && rows.length === 0 && (
        <EmptyState icon="◉" title="No PBX domains" hint="FusionPBX returned no domains. Check your FUSIONPBX_API_URL credentials." accent={c.signalGold} />
      )}
      {!loading && rows.length > 0 && (
        <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 80px 80px 90px 120px', padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: c.deepPanel }}>
            {['Domain','Customer','Ext','Numbers','Queues','Status',''].map((col) => (
              <span key={col} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{col}</span>
            ))}
          </div>
          {rows.map((r) => (
            <div key={r.domain_uuid} style={{ display: 'grid', gridTemplateColumns: '2fr 2fr 80px 80px 80px 90px 120px', padding: '12px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 12.5, color: c.textIce, alignItems: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r.domain_name}</span>
              <span style={{ color: r.org_name ? c.textIce : c.mutedSilver }}>{r.org_name || '— not linked —'}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r.extensions}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r.numbers}</span>
              <span style={{ fontFamily: 'JetBrains Mono, monospace' }}>{r.queues}</span>
              <span style={{ color: r.domain_enabled === 'true' || r.domain_enabled === true ? c.success : c.mutedSilver, fontSize: 11 }}>
                ● {r.domain_enabled === 'true' || r.domain_enabled === true ? 'Enabled' : 'Disabled'}
              </span>
              <span>
                <button
                  onClick={() => syncDomain(r)}
                  disabled={syncing === r.domain_uuid}
                  style={{ padding: '5px 10px', borderRadius: 7, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 11, cursor: 'pointer', opacity: syncing === r.domain_uuid ? 0.6 : 1 }}
                >{syncing === r.domain_uuid ? 'Syncing…' : '↻ Sync'}</button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
