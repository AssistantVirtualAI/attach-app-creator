// Admin-facing audit trail panel for PBX create-flow events. Reads
// `audit_logs` filtered by the `pbx.create_*` family so admins can trace
// duplicate detections, conflict resolutions, idempotent replays, denials,
// and successes — with timestamps, resource type, and identifier.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { theme } from '../../../lib/theme';
import { supabase } from '../../../lib/supabaseClient';
import { getMeContext } from '../../../lib/avaApi';

const { colors: c } = theme;
const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

const ACTIONS: { value: string; label: string; tone: string }[] = [
  { value: '',                                   label: 'All events',        tone: c.mutedSilver },
  { value: 'pbx.create_denied_non_admin',        label: 'Denied (non-admin)', tone: c.danger },
  { value: 'pbx.create_duplicate_detected',      label: 'Duplicate detected', tone: c.signalGold },
  { value: 'pbx.create_conflict_resolved',       label: 'Conflict resolved',  tone: c.avaCyan },
  { value: 'pbx.create_idempotent_replay',       label: 'Idempotent replay',  tone: c.avaViolet },
  { value: 'pbx.create_succeeded',               label: 'Succeeded',          tone: c.success },
];

const KINDS = [
  { value: '',         label: 'All resources' },
  { value: 'extension', label: 'Extensions' },
  { value: 'ivr',       label: 'Auto-Attendants' },
  { value: 'queue',     label: 'Call Queues' },
];

export default function AuditTrail() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');
  const [idQuery, setIdQuery] = useState('');

  const reload = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const me = await getMeContext().catch(() => null);
      const orgId = me?.organization_id || LEMTEL_ORG;
      let q = supabase
        .from('audit_logs')
        .select('id, created_at, action, resource_type, resource_id, metadata, user_id')
        .eq('organization_id', orgId)
        .like('action', 'pbx.create_%')
        .order('created_at', { ascending: false })
        .limit(200);
      if (actionFilter) q = q.eq('action', actionFilter);
      const { data, error: e } = await q;
      if (e) throw e;
      setRows(data || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  }, [actionFilter]);

  useEffect(() => { reload(); }, [reload]);

  const filtered = useMemo(() => rows.filter((r) => {
    if (kindFilter && (r.metadata?.resource ?? '') !== kindFilter) return false;
    if (idQuery && !String(r.metadata?.identifier ?? '').toLowerCase().includes(idQuery.toLowerCase())) return false;
    return true;
  }), [rows, kindFilter, idQuery]);

  const sel: React.CSSProperties = {
    padding: '7px 10px', borderRadius: 8, background: c.deepPanel,
    border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, outline: 'none',
  };

  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, color: c.textIce, margin: 0 }}>
          PBX Audit Trail <span style={{ fontSize: 12, color: c.mutedSilver, fontWeight: 500 }}>({filtered.length})</span>
        </h1>
        <button onClick={reload} style={{
          padding: '8px 14px', borderRadius: 9, background: 'transparent',
          border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>↻ Refresh</button>
      </header>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={sel}>
          {ACTIONS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)} style={sel}>
          {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
        </select>
        <input
          value={idQuery} onChange={(e) => setIdQuery(e.target.value)}
          placeholder="Filter by identifier (e.g. 1001 or queue name)"
          style={{ ...sel, minWidth: 280, flex: 1 }}
        />
      </div>

      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr 110px 1fr 1fr', padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: c.deepPanel }}>
          {['When', 'Event', 'Resource', 'Identifier', 'Details'].map((h) => (
            <span key={h} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{h}</span>
          ))}
        </div>
        {loading && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>Loading…</div>}
        {!loading && error && <div style={{ padding: 28, textAlign: 'center', color: c.danger, fontSize: 12 }}>{error}</div>}
        {!loading && !error && filtered.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No matching audit events.</div>}
        {!loading && !error && filtered.map((r) => {
          const tone = ACTIONS.find((a) => a.value === r.action)?.tone || c.textIce;
          const m = r.metadata || {};
          const detail = [
            m.resolution && `resolution=${m.resolution}`,
            m.remote_id && `remote=${String(m.remote_id).slice(0, 8)}…`,
            m.idempotency_key && `idem=${String(m.idempotency_key).slice(0, 8)}…`,
            m.remote_version && `v=${String(m.remote_version).slice(0, 19)}`,
          ].filter(Boolean).join(' · ');
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '170px 1fr 110px 1fr 1fr', padding: '10px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 12, color: c.textIce, alignItems: 'center' }}>
              <span style={{ fontFamily: 'JetBrains Mono, monospace', color: c.mutedSilver, fontSize: 11 }}>
                {new Date(r.created_at).toLocaleString()}
              </span>
              <span style={{ color: tone, fontWeight: 600 }}>{r.action.replace('pbx.create_', '')}</span>
              <span style={{ color: c.mutedSilver }}>{m.resource || '—'}</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.identifier || '—'}</span>
              <span style={{ color: c.mutedSilver, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{detail || '—'}</span>
            </div>
          );
        })}
      </div>
    </>
  );
}
