import React, { useCallback, useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, getMeContext } from '../../lib/avaApi';
import { supabase } from '../../lib/supabaseClient';

const { colors: c } = theme;

const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';
const LEMTEL_DOMAIN = '2936594e-17b7-42a9-9165-95be48627923';

function ExtensionsTable() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const loadFromDb = useCallback(async (orgId: string | null) => {
    let extQ = supabase
      .from('pbx_extensions')
      .select('id, pbx_uuid, extension, effective_cid_name, enabled, voicemail_enabled')
      .order('extension');
    if (orgId) extQ = extQ.eq('organization_id', orgId);
    let spuQ = supabase.from('pbx_softphone_users').select('extension, display_name, portal_user_id, status');
    if (orgId) spuQ = spuQ.eq('organization_id', orgId);
    const [{ data: exts, error: e1 }, { data: spus, error: e2 }] = await Promise.all([extQ, spuQ]);
    if (e1 || e2) throw (e1 || e2);
    const spuMap = new Map<string, any>((spus || []).map((s: any) => [String(s.extension), s]));
    return (exts || []).map((e: any) => {
      const s = spuMap.get(String(e.extension));
      return {
        id: e.id,
        extension_uuid: e.pbx_uuid,
        extension: e.extension,
        display_name: s?.display_name || e.effective_cid_name || '—',
        portal_user_id: s?.portal_user_id || null,
        voicemail_enabled: e.voicemail_enabled,
        enabled: e.enabled !== false,
        status: s?.status || (e.enabled === false ? 'Disabled' : 'Active'),
      };
    });
  }, []);

  const reload = useCallback(async (forceSync = false) => {
    setLoading(true); setError(null);
    try {
      const me = await getMeContext();
      const orgId = me.organization_id || LEMTEL_ORG;
      // Trigger FusionPBX sync so all PBX extensions (not just registered softphones) land in the table.
      if (forceSync) {
        setSyncing(true);
        const { error: syncErr } = await supabase.functions.invoke('fusionpbx-proxy', {
          body: { action: 'sync-all', resources: ['extensions'], organization_id: orgId, domain_uuid: LEMTEL_DOMAIN },
        });
        if (syncErr) console.warn('sync-extensions failed:', syncErr.message);
        setSyncing(false);
      }
      setData(await loadFromDb(orgId));
    } catch (e: any) {
      setError(e?.message || 'Failed to load extensions');
    } finally {
      setLoading(false);
    }
  }, [loadFromDb]);

  useEffect(() => {
    // First mount: load DB, then auto-sync if list looks incomplete.
    (async () => {
      await reload(false);
    })();
  }, [reload]);

  const updateExtension = async (ext: any, changes: any) => {
    setSaving(true);
    try {
      const { error: err } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'update-extension',
          organization_id: LEMTEL_ORG,
          params: { extension_uuid: ext.extension_uuid, domain_uuid: LEMTEL_DOMAIN, ...changes },
        },
      });
      if (err) throw err;
      setData((prev) => prev.map((e) => (e.id === ext.id ? { ...e, ...changes } : e)));
      setEditing(null);
    } catch (e: any) {
      alert('Update failed: ' + (e?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const cols = ['Ext', 'Display Name', 'User', 'Voicemail', 'Status', ''];
  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: c.textIce, margin: 0 }}>Extensions <span style={{ fontSize: 12, color: c.mutedSilver, fontWeight: 500 }}>({data.length})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => reload(true)} disabled={syncing} style={{
            padding: '8px 14px', borderRadius: 9, background: 'transparent',
            border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer',
            opacity: syncing ? 0.6 : 1,
          }}>{syncing ? 'Syncing…' : '↻ Sync from PBX'}</button>
          <button onClick={() => reload(false)} style={{
            padding: '8px 14px', borderRadius: 9, background: 'transparent',
            border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>Reload</button>
        </div>
      </header>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: c.deepPanel }}>
          {cols.map((col, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{col}</span>)}
        </div>
        {data.map((e, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '11px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 12.5, color: c.textIce, alignItems: 'center' }}>
            <span>{e.extension}</span>
            <span>{e.display_name || '—'}</span>
            <span>{e.portal_user_id ? '✓' : '—'}</span>
            <span>{e.voicemail_enabled ? 'On' : 'Off'}</span>
            <span>{e.status}</span>
            <span>
              <button onClick={() => setEditing(e)} style={{
                padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce,
              }}>Edit</button>
            </span>
          </div>
        ))}
        {loading && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>Loading…</div>}
        {!loading && !error && data.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No extensions. Click “Sync from PBX”.</div>}
        {!loading && error && <div style={{ padding: 28, textAlign: 'center', color: c.danger, fontSize: 12 }}>{error}</div>}
      </div>

      {editing && (
        <EditExtensionModal
          ext={editing}
          saving={saving}
          onClose={() => setEditing(null)}
          onSave={(changes) => updateExtension(editing, changes)}
        />
      )}
    </>
  );
}

function EditExtensionModal({ ext, saving, onClose, onSave }: { ext: any; saving: boolean; onClose: () => void; onSave: (changes: any) => void }) {
  const [displayName, setDisplayName] = useState(ext.display_name === '—' ? '' : ext.display_name || '');
  const [voicemail, setVoicemail] = useState(!!ext.voicemail_enabled);
  const [enabled, setEnabled] = useState(ext.enabled !== false);
  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50,
      display: 'grid', placeItems: 'center',
    }}>
      <div onClick={(e) => e.stopPropagation()} style={{
        width: 380, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20,
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textIce, marginBottom: 12 }}>Edit Extension {ext.extension}</div>
        <Label>Display name</Label>
        <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12 }}>
            <input type="checkbox" checked={voicemail} onChange={(e) => setVoicemail(e.target.checked)} /> Voicemail
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
          </label>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({
            effective_caller_id_name: displayName,
            voicemail_enabled: voicemail ? 'true' : 'false',
            enabled: enabled ? 'true' : 'false',
          })} disabled={saving} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
            background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`, opacity: saving ? 0.6 : 1,
          }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  background: c.deepPanel, border: `1px solid ${c.border}`, color: c.textIce, fontSize: 13, outline: 'none',
};
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>;
}

type Section = 'extensions' | 'devices' | 'numbers' | 'ivrs' | 'queues' | 'ringgroups' | 'sync';

const NAV: { id: Section; label: string }[] = [
  { id: 'extensions', label: 'Extensions' },
  { id: 'devices', label: 'Devices' },
  { id: 'numbers', label: 'Phone Numbers' },
  { id: 'ivrs', label: 'Auto-Attendants' },
  { id: 'queues', label: 'Call Queues' },
  { id: 'ringgroups', label: 'Ring Groups' },
  { id: 'sync', label: 'Sync Status' },
];

export default function AdminView() {
  const [sec, setSec] = useState<Section>('extensions');
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: 200, flexShrink: 0, borderRight: `1px solid ${c.border}`, background: c.deepPanel, padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, color: c.signalGold, textTransform: 'uppercase', marginBottom: 10 }}>Admin</div>
        {NAV.map((n) => (
          <button key={n.id} onClick={() => setSec(n.id)} style={{
            display: 'block', width: '100%', textAlign: 'left',
            padding: '8px 10px', borderRadius: 8,
            background: sec === n.id ? 'rgba(255,230,0,0.10)' : 'transparent',
            border: 'none', color: sec === n.id ? c.signalGold : c.mutedSilver,
            fontSize: 12, fontWeight: sec === n.id ? 700 : 500, cursor: 'pointer',
            marginBottom: 2,
          }}>{n.label}</button>
        ))}
      </aside>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px' }}>
        {sec === 'extensions' && <ExtensionsTable />}
        {sec === 'devices' && <Table title="Devices" cols={['Vendor', 'MAC', 'Template', 'Assigned', 'Registered']} load={ava.devices} row={(d: any) => [d.vendor, d.mac, d.template, d.assignedTo || '—', d.registered ? 'Yes' : 'No']} />}
        {sec === 'numbers' && <Table title="Phone Numbers" cols={['Number', 'Assigned To', 'Type']} load={ava.phoneNumbers} row={(n: any) => [n.number, n.assignedTo, n.type]} />}
        {sec === 'ivrs' && <Table title="Auto-Attendants (IVR)" cols={['Name', 'Greeting', 'Options']} load={ava.ivrs} row={(i: any) => [i.name, i.greeting.slice(0, 60) + '…', i.options]} />}
        {sec === 'queues' && <Table title="Call Queues" cols={['Name', 'Strategy', 'Agents', 'Waiting']} load={ava.queues} row={(q: any) => [q.name, q.strategy, q.agents, q.waiting]} />}
        {sec === 'ringgroups' && <Table title="Ring Groups" cols={['Name', 'Members', 'Strategy']} load={ava.ringGroups} row={(r: any) => [r.name, r.members, r.strategy]} />}
        {sec === 'sync' && <SyncStatus />}
      </div>
    </div>
  );
}

function Table({ title, cols, load, row }: { title: string; cols: string[]; load: () => Promise<any[]>; row: (item: any) => (string | number)[] }) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = React.useCallback(() => {
    setLoading(true); setError(null);
    load()
      .then((d) => setData(Array.isArray(d) ? d : []))
      .catch((e) => setError(e?.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [load]);
  useEffect(() => { reload(); }, [reload]);
  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: c.textIce, margin: 0 }}>{title}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={reload} style={{
            padding: '8px 14px', borderRadius: 9, background: 'transparent',
            border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>↻ Refresh</button>
          <button style={{
            padding: '8px 14px', borderRadius: 9,
            background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
            border: 'none', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}>+ New</button>
        </div>
      </header>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: c.deepPanel }}>
          {cols.map((col) => <span key={col} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{col}</span>)}
        </div>
        {data.map((item, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '11px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 12.5, color: c.textIce }}>
            {row(item).map((v, j) => <span key={j} style={{ fontFamily: typeof v === 'number' ? 'JetBrains Mono, monospace' : 'inherit' }}>{v}</span>)}
          </div>
        ))}
        {loading && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>Loading…</div>}
        {!loading && !error && data.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No records yet. Click Refresh after syncing from the phone system.</div>}
        {!loading && error && <div style={{ padding: 28, textAlign: 'center', color: c.danger, fontSize: 12 }}>{error}</div>}
      </div>
    </>
  );
}

function SyncStatus() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { ava.syncStatus().then(setData); }, []);
  if (!data) return <div style={{ color: c.mutedSilver, fontSize: 12 }}>Loading…</div>;
  return (
    <>
      <h1 style={{ fontSize: 22, color: c.textIce, margin: '0 0 16px' }}>Sync Status</h1>
      <div style={{ padding: 18, borderRadius: 12, background: c.bgCard, border: `1px solid ${c.border}`, marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 11, color: c.mutedSilver, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 700 }}>Overall Status</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: data.status === 'ok' ? c.success : c.danger, marginTop: 4 }}>
              {data.status === 'ok' ? '● Healthy' : '● Degraded'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, color: c.mutedSilver }}>Last sync</div>
            <div style={{ fontSize: 12, color: c.textIce, fontFamily: 'JetBrains Mono, monospace' }}>{new Date(data.lastSync).toLocaleString()}</div>
          </div>
        </div>
      </div>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {data.jobs.map((j: any, i: number) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 16px', borderBottom: `1px solid ${c.border}`, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <span style={{ color: j.ok ? c.success : c.danger, fontSize: 10 }}>●</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.textIce, textTransform: 'capitalize' }}>{j.kind}</span>
            </div>
            <span style={{ fontSize: 11, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>{new Date(j.finishedAt).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    </>
  );
}
