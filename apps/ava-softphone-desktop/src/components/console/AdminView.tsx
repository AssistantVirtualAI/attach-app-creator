import React, { useCallback, useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava, getMeContext } from '../../lib/avaApi';
import { supabase } from '../../lib/supabaseClient';
import PbxResourceSection from './admin/PbxResourceSection';

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
        {sec === 'ivrs' && <IvrsTable />}
        {sec === 'queues' && <QueuesTable />}
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

// ============================================================
// IVRs (Auto-Attendants)
// ============================================================
function IvrsTable() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (forceSync = false) => {
    setLoading(true); setError(null);
    try {
      const me = await getMeContext();
      const orgId = me.organization_id || LEMTEL_ORG;
      if (forceSync) {
        setSyncing(true);
        await supabase.functions.invoke('fusionpbx-proxy', {
          body: { action: 'sync-all', resources: ['ivrs'], organization_id: orgId, domain_uuid: LEMTEL_DOMAIN },
        });
        setSyncing(false);
      }
      const { data: rows, error: e1 } = await supabase
        .from('pbx_ivrs')
        .select('id, pbx_uuid, name, extension, greet_long, greet_short, timeout_ms, exit_action, enabled')
        .eq('organization_id', orgId).order('name');
      if (e1) throw e1;
      setData(rows || []);
    } catch (e: any) {
      setError(e?.message || 'Failed to load IVRs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(false); }, [reload]);

  const save = async (ivr: any, changes: any) => {
    setSaving(true);
    try {
      const { error: err } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'update-ivr',
          organization_id: LEMTEL_ORG,
          params: { ivr_menu_uuid: ivr.pbx_uuid, domain_uuid: LEMTEL_DOMAIN, ...changes },
        },
      });
      if (err) throw err;
      setData((prev) => prev.map((x) => (x.id === ivr.id
        ? { ...x, name: changes.ivr_menu_name ?? x.name, extension: changes.ivr_menu_extension ?? x.extension, greet_long: changes.ivr_menu_greet_long ?? x.greet_long, timeout_ms: changes.ivr_menu_timeout ?? x.timeout_ms, enabled: changes.ivr_menu_enabled !== undefined ? changes.ivr_menu_enabled === 'true' : x.enabled }
        : x)));
      setEditing(null);
    } catch (e: any) {
      alert('Update failed: ' + (e?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const cols = ['Name', 'Ext', 'Greeting', 'Timeout', 'Status', ''];
  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: c.textIce, margin: 0 }}>Auto-Attendants <span style={{ fontSize: 12, color: c.mutedSilver, fontWeight: 500 }}>({data.length})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => reload(true)} disabled={syncing} style={{ padding: '8px 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}>{syncing ? 'Syncing…' : '↻ Sync from PBX'}</button>
          <button onClick={() => reload(false)} style={{ padding: '8px 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      </header>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: c.deepPanel }}>
          {cols.map((col, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{col}</span>)}
        </div>
        {data.map((i, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '11px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 12.5, color: c.textIce, alignItems: 'center' }}>
            <span>{i.name}</span>
            <span>{i.extension || '—'}</span>
            <span style={{ color: c.mutedSilver, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(i.greet_long || '').slice(0, 50) || '—'}</span>
            <span>{i.timeout_ms ? `${i.timeout_ms}ms` : '—'}</span>
            <span style={{ color: i.enabled ? c.success : c.mutedSilver }}>{i.enabled ? 'Enabled' : 'Disabled'}</span>
            <span><button onClick={() => setEditing(i)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce }}>Edit</button></span>
          </div>
        ))}
        {loading && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>Loading…</div>}
        {!loading && !error && data.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No IVRs. Click "Sync from PBX".</div>}
        {!loading && error && <div style={{ padding: 28, textAlign: 'center', color: c.danger, fontSize: 12 }}>{error}</div>}
      </div>
      {editing && <EditIvrModal ivr={editing} saving={saving} onClose={() => setEditing(null)} onSave={(changes) => save(editing, changes)} />}
    </>
  );
}

function EditIvrModal({ ivr, saving, onClose, onSave }: { ivr: any; saving: boolean; onClose: () => void; onSave: (changes: any) => void }) {
  const [name, setName] = useState(ivr.name || '');
  const [extension, setExtension] = useState(ivr.extension || '');
  const [greet, setGreet] = useState(ivr.greet_long || '');
  const [timeout, setTimeoutMs] = useState(ivr.timeout_ms || 3000);
  const [enabled, setEnabled] = useState(ivr.enabled !== false);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textIce, marginBottom: 12 }}>Edit IVR · {ivr.name}</div>
        <Label>Name</Label><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <div style={{ height: 10 }} />
        <Label>Extension</Label><input value={extension} onChange={(e) => setExtension(e.target.value)} style={inputStyle} />
        <div style={{ height: 10 }} />
        <Label>Greeting (long)</Label><textarea value={greet} onChange={(e) => setGreet(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
        <div style={{ height: 10 }} />
        <Label>Timeout (ms)</Label><input type="number" value={timeout} onChange={(e) => setTimeoutMs(Number(e.target.value))} style={inputStyle} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12, marginTop: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({
            ivr_menu_name: name,
            ivr_menu_extension: extension,
            ivr_menu_greet_long: greet,
            ivr_menu_timeout: timeout,
            ivr_menu_enabled: enabled ? 'true' : 'false',
          })} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Call Queues
// ============================================================
const STRATEGIES = ['ring-all', 'longest-idle-agent', 'round-robin', 'top-down', 'agent-with-least-talk-time', 'agent-with-fewest-calls', 'sequentially-by-agent-order', 'random'];

function QueuesTable() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const reload = useCallback(async (forceSync = false) => {
    setLoading(true); setError(null);
    try {
      const me = await getMeContext();
      const orgId = me.organization_id || LEMTEL_ORG;
      if (forceSync) {
        setSyncing(true);
        await supabase.functions.invoke('fusionpbx-proxy', {
          body: { action: 'sync-all', resources: ['queues'], organization_id: orgId, domain_uuid: LEMTEL_DOMAIN },
        });
        setSyncing(false);
      }
      const { data: rows, error: e1 } = await supabase
        .from('pbx_call_queues')
        .select('id, pbx_uuid, name, extension, strategy, max_wait_time, enabled')
        .eq('organization_id', orgId).order('name');
      if (e1) throw e1;
      // Agent counts
      const ids = (rows || []).map((r: any) => r.id);
      const agentCounts: Record<string, number> = {};
      if (ids.length) {
        const { data: agents } = await supabase.from('pbx_queue_agents').select('queue_id').in('queue_id', ids);
        (agents || []).forEach((a: any) => { agentCounts[a.queue_id] = (agentCounts[a.queue_id] || 0) + 1; });
      }
      setData((rows || []).map((r: any) => ({ ...r, agent_count: agentCounts[r.id] || 0 })));
    } catch (e: any) {
      setError(e?.message || 'Failed to load queues');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { reload(false); }, [reload]);

  const save = async (q: any, changes: any) => {
    setSaving(true);
    try {
      const { error: err } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'update-queue',
          organization_id: LEMTEL_ORG,
          params: { call_center_queue_uuid: q.pbx_uuid, domain_uuid: LEMTEL_DOMAIN, ...changes },
        },
      });
      if (err) throw err;
      setData((prev) => prev.map((x) => (x.id === q.id ? { ...x, name: changes.queue_name ?? x.name, strategy: changes.queue_strategy ?? x.strategy, max_wait_time: changes.queue_max_wait_time !== undefined ? Number(changes.queue_max_wait_time) : x.max_wait_time, enabled: changes.queue_enabled !== undefined ? changes.queue_enabled === 'true' : x.enabled } : x)));
      setEditing(null);
    } catch (e: any) {
      alert('Update failed: ' + (e?.message || 'unknown'));
    } finally {
      setSaving(false);
    }
  };

  const cols = ['Name', 'Ext', 'Strategy', 'Agents', 'Max wait', 'Status', ''];
  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, color: c.textIce, margin: 0 }}>Call Queues <span style={{ fontSize: 12, color: c.mutedSilver, fontWeight: 500 }}>({data.length})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => reload(true)} disabled={syncing} style={{ padding: '8px 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer', opacity: syncing ? 0.6 : 1 }}>{syncing ? 'Syncing…' : '↻ Sync from PBX'}</button>
          <button onClick={() => reload(false)} style={{ padding: '8px 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reload</button>
        </div>
      </header>
      <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '10px 14px', borderBottom: `1px solid ${c.border}`, background: c.deepPanel }}>
          {cols.map((col, i) => <span key={i} style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: c.mutedSilver }}>{col}</span>)}
        </div>
        {data.map((q, idx) => (
          <div key={idx} style={{ display: 'grid', gridTemplateColumns: `repeat(${cols.length}, 1fr)`, padding: '11px 14px', borderBottom: `1px solid ${c.border}`, fontSize: 12.5, color: c.textIce, alignItems: 'center' }}>
            <span>{q.name}</span>
            <span>{q.extension || '—'}</span>
            <span style={{ color: c.avaCyan }}>{q.strategy || '—'}</span>
            <span>{q.agent_count}</span>
            <span>{q.max_wait_time ? `${q.max_wait_time}s` : '—'}</span>
            <span style={{ color: q.enabled ? c.success : c.mutedSilver }}>{q.enabled ? 'Enabled' : 'Disabled'}</span>
            <span><button onClick={() => setEditing(q)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, cursor: 'pointer', background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce }}>Edit</button></span>
          </div>
        ))}
        {loading && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>Loading…</div>}
        {!loading && !error && data.length === 0 && <div style={{ padding: 28, textAlign: 'center', color: c.mutedSilver, fontSize: 12 }}>No queues. Click "Sync from PBX".</div>}
        {!loading && error && <div style={{ padding: 28, textAlign: 'center', color: c.danger, fontSize: 12 }}>{error}</div>}
      </div>
      {editing && <EditQueueModal queue={editing} saving={saving} onClose={() => setEditing(null)} onSave={(changes) => save(editing, changes)} />}
    </>
  );
}

function EditQueueModal({ queue, saving, onClose, onSave }: { queue: any; saving: boolean; onClose: () => void; onSave: (changes: any) => void }) {
  const [name, setName] = useState(queue.name || '');
  const [strategy, setStrategy] = useState(queue.strategy || 'ring-all');
  const [maxWait, setMaxWait] = useState(queue.max_wait_time || 60);
  const [enabled, setEnabled] = useState(queue.enabled !== false);
  const [agents, setAgents] = useState<any[] | null>(null);

  useEffect(() => {
    (async () => {
      const { data: rows } = await supabase
        .from('pbx_queue_agents')
        .select('id, agent_name, agent_id, tier_level, status, extension_id, pbx_extensions(extension)')
        .eq('queue_id', queue.id);
      setAgents(rows || []);
    })();
  }, [queue.id]);

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 50, display: 'grid', placeItems: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 520, maxHeight: '90vh', overflowY: 'auto', background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 14, padding: 20 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: c.textIce, marginBottom: 12 }}>Edit Queue · {queue.name}</div>
        <Label>Name</Label><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        <div style={{ height: 10 }} />
        <Label>Strategy</Label>
        <select value={strategy} onChange={(e) => setStrategy(e.target.value)} style={inputStyle}>
          {STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <div style={{ height: 10 }} />
        <Label>Max wait time (seconds)</Label><input type="number" value={maxWait} onChange={(e) => setMaxWait(Number(e.target.value))} style={inputStyle} />
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12, marginTop: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>

        <div style={{ marginTop: 18 }}>
          <Label>Agents ({agents?.length ?? '…'})</Label>
          <div style={{ border: `1px solid ${c.border}`, borderRadius: 8, maxHeight: 180, overflowY: 'auto' }}>
            {agents === null && <div style={{ padding: 12, color: c.mutedSilver, fontSize: 12 }}>Loading…</div>}
            {agents && agents.length === 0 && <div style={{ padding: 12, color: c.mutedSilver, fontSize: 12 }}>No agents in this queue.</div>}
            {agents && agents.map((a: any) => (
              <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderBottom: `1px solid ${c.border}`, fontSize: 12, color: c.textIce }}>
                <span>{a.agent_name || a.agent_id || `Ext ${a.pbx_extensions?.extension ?? '?'}`}</span>
                <span style={{ color: c.mutedSilver }}>Tier {a.tier_level} · {a.status}</span>
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 18, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
          <button onClick={() => onSave({
            queue_name: name,
            queue_strategy: strategy,
            queue_max_wait_time: String(maxWait),
            queue_enabled: enabled ? 'true' : 'false',
          })} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
}
