import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { theme } from '../../lib/theme';
import { ava, getMeContext } from '../../lib/avaApi';
import { supabase } from '../../lib/supabaseClient';
import PbxResourceSection from './admin/PbxResourceSection';

const { colors: c } = theme;

const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';
const LEMTEL_DOMAIN = '2936594e-17b7-42a9-9165-95be48627923';

/**
 * Shared modal shell — rendered via portal so ancestor `transform`, `filter`,
 * `overflow:hidden`, or backdrop-filter ancestors (e.g. the animated console
 * page wrapper) can't trap the overlay or bleed table text through it.
 * Uses a fully opaque panel background so edit forms read cleanly.
 */
function ModalShell({ title, onClose, width = 460, children }: { title: string; onClose: () => void; width?: number; children: React.ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [onClose]);
  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(2,6,20,0.78)',
        backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center', padding: 24,
        animation: 'fadeIn 140ms ease-out',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: width, maxHeight: '88vh', overflowY: 'auto',
          background: '#0c1733',
          backgroundImage: 'linear-gradient(160deg, rgba(35,214,255,0.06), rgba(122,76,255,0.05))',
          border: `1px solid ${(c as any).borderAI || c.border}`,
          borderRadius: 16, padding: 22,
          boxShadow: '0 30px 80px -20px rgba(0,0,0,0.85), 0 0 0 1px rgba(35,214,255,0.08)',
          color: c.textIce,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${c.border}` }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: c.textIce, letterSpacing: 0.2 }}>{title}</div>
          <button onClick={onClose} aria-label="Close" style={{
            width: 28, height: 28, borderRadius: 8, border: `1px solid ${c.border}`,
            background: 'rgba(255,255,255,0.04)', color: c.mutedSilver, cursor: 'pointer', fontSize: 14,
          }}>✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

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
    <ModalShell title={`Edit Extension ${ext.extension}`} onClose={onClose} width={420}>
      <Label>Display name</Label>
      <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} />
      <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12 }}>
          <input type="checkbox" checked={voicemail} onChange={(e) => setVoicemail(e.target.checked)} /> Voicemail
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12 }}>
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
        </label>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => onSave({
          effective_caller_id_name: displayName,
          voicemail_enabled: voicemail ? 'true' : 'false',
          enabled: enabled ? 'true' : 'false',
        })} disabled={saving} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
          background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`, opacity: saving ? 0.6 : 1,
        }}>{saving ? 'Saving…' : 'Save & sync to PBX'}</button>
      </div>
    </ModalShell>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 8,
  background: c.deepPanel, border: `1px solid ${c.border}`, color: c.textIce, fontSize: 13, outline: 'none',
};
function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 4 }}>{children}</div>;
}

type Section =
  | 'extensions' | 'devices' | 'numbers' | 'ivrs' | 'queues' | 'ringgroups'
  | 'gateways' | 'sip-profiles' | 'conferences' | 'hold-music' | 'dialplans'
  | 'time-conditions' | 'registrations' | 'voicemails' | 'recordings' | 'feature-codes'
  | 'sync';

const NAV_GROUPS: { label: string; items: { id: Section; label: string }[] }[] = [
  {
    label: 'Telephony',
    items: [
      { id: 'extensions', label: 'Extensions' },
      { id: 'devices', label: 'Devices' },
      { id: 'numbers', label: 'Phone Numbers' },
      { id: 'registrations', label: 'Live Registrations' },
    ],
  },
  {
    label: 'Routing',
    items: [
      { id: 'ivrs', label: 'Auto-Attendants' },
      { id: 'queues', label: 'Call Queues' },
      { id: 'ringgroups', label: 'Ring Groups' },
      { id: 'time-conditions', label: 'Time Conditions' },
      { id: 'dialplans', label: 'Dialplans' },
    ],
  },
  {
    label: 'Media',
    items: [
      { id: 'voicemails', label: 'Voicemails' },
      { id: 'recordings', label: 'Recording Rules' },
      { id: 'hold-music', label: 'Hold Music' },
      { id: 'conferences', label: 'Conferences' },
      { id: 'feature-codes', label: 'Feature Codes' },
    ],
  },
  {
    label: 'Infrastructure',
    items: [
      { id: 'gateways', label: 'Gateways' },
      { id: 'sip-profiles', label: 'SIP Profiles' },
      { id: 'sync', label: 'Sync Status' },
    ],
  },
];

export default function AdminView() {
  const [sec, setSec] = useState<Section>('extensions');
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={{ width: 220, flexShrink: 0, borderRight: `1px solid ${c.border}`, background: c.deepPanel, padding: '18px 14px', overflowY: 'auto' }}>
        {NAV_GROUPS.map((g) => (
          <div key={g.label} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5, color: c.signalGold, textTransform: 'uppercase', marginBottom: 6, paddingLeft: 6 }}>{g.label}</div>
            {g.items.map((n) => (
              <button key={n.id} onClick={() => setSec(n.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '7px 10px', borderRadius: 8,
                background: sec === n.id ? 'rgba(11,181,214,0.14)' : 'transparent',
                border: 'none', color: sec === n.id ? c.avaCyan : c.mutedSilver,
                fontSize: 12, fontWeight: sec === n.id ? 700 : 500, cursor: 'pointer',
                marginBottom: 1,
                transition: 'all 160ms ease',
              }}>{n.label}</button>
            ))}
          </div>
        ))}
      </aside>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '24px 28px' }}>
        {sec === 'extensions' && <ExtensionsTable />}
        {sec === 'devices' && (
          <PbxResourceSection
            kind="devices" actionKind="device" title="Devices" uuidField="device_uuid"
            cols={[{ key: 'device_vendor', label: 'Vendor' }, { key: 'device_mac_address', label: 'MAC' }, { key: 'device_template', label: 'Template' }, { key: 'device_label', label: 'Assigned' }, { key: 'device_enabled', label: 'Enabled' }]}
            fields={[{ key: 'device_label', label: 'Label' }, { key: 'device_vendor', label: 'Vendor' }, { key: 'device_mac_address', label: 'MAC Address' }, { key: 'device_template', label: 'Template' }, { key: 'device_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] }]}
          />
        )}
        {sec === 'numbers' && (
          <PbxResourceSection
            kind="destinations" actionKind="destination" title="Phone Numbers" uuidField="destination_uuid"
            cols={[{ key: 'destination_number', label: 'Number' }, { key: 'destination_action', label: 'Assigned To' }, { key: 'destination_type', label: 'Type' }, { key: 'destination_enabled', label: 'Enabled' }]}
            fields={[{ key: 'destination_number', label: 'Number' }, { key: 'destination_action', label: 'Destination Action' }, { key: 'destination_type', label: 'Type' }, { key: 'destination_description', label: 'Description' }, { key: 'destination_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] }]}
          />
        )}
        {sec === 'ivrs' && <IvrsTable />}
        {sec === 'queues' && <QueuesTable />}
        {sec === 'ringgroups' && (
          <PbxResourceSection
            kind="ring-groups" actionKind="ring-group" title="Ring Groups" uuidField="ring_group_uuid"
            cols={[{ key: 'ring_group_name', label: 'Name' }, { key: 'ring_group_extension', label: 'Extension' }, { key: 'ring_group_strategy', label: 'Strategy' }, { key: 'ring_group_enabled', label: 'Enabled' }]}
            fields={[{ key: 'ring_group_name', label: 'Name' }, { key: 'ring_group_extension', label: 'Extension' }, { key: 'ring_group_strategy', label: 'Strategy', type: 'select', options: ['simultaneous', 'sequence', 'enterprise'] }, { key: 'ring_group_timeout_app', label: 'Timeout App' }, { key: 'ring_group_forward_destination', label: 'Forwarding / fallback' }, { key: 'ring_group_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] }, { key: 'ring_group_description', label: 'Description', type: 'textarea' }]}
          />
        )}
        {sec === 'gateways' && (
          <PbxResourceSection
            kind="gateways" title="Gateways" uuidField="gateway_uuid" global
            cols={[
              { key: 'gateway', label: 'Name' },
              { key: 'proxy', label: 'Proxy' },
              { key: 'username', label: 'Username' },
              { key: 'enabled', label: 'Enabled', render: (v) => (String(v) === 'true' ? '✓' : '—') },
              { key: 'register', label: 'Register' },
            ]}
            fields={[
              { key: 'gateway', label: 'Name' },
              { key: 'username', label: 'Username' },
              { key: 'password', label: 'Password' },
              { key: 'proxy', label: 'Proxy (host[:port])' },
              { key: 'realm', label: 'Realm' },
              { key: 'register', label: 'Register', type: 'select', options: ['true', 'false'] },
              { key: 'enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] },
            ]}
            rowActions={[{
              label: 'Restart',
              run: async (row, { orgId }) => {
                await supabase.functions.invoke('fusionpbx-proxy', {
                  body: { action: 'restart-gateway', organization_id: orgId, params: { gateway_name: row.gateway } },
                });
              },
            }]}
          />
        )}
        {sec === 'sip-profiles' && (
          <PbxResourceSection
            kind="sip-profiles" title="SIP Profiles" uuidField="sip_profile_uuid" global canCreate={false}
            cols={[
              { key: 'sip_profile_name', label: 'Name' },
              { key: 'sip_profile_description', label: 'Description' },
              { key: 'sip_profile_enabled', label: 'Enabled' },
            ]}
            rowActions={[{
              label: 'Restart',
              run: async (row, { orgId }) => {
                await supabase.functions.invoke('fusionpbx-proxy', {
                  body: { action: 'restart-sip-profile', organization_id: orgId, params: { profile_name: row.sip_profile_name } },
                });
              },
            }]}
          />
        )}
        {sec === 'conferences' && (
          <PbxResourceSection
            kind="conferences" title="Conferences" uuidField="conference_room_uuid"
            cols={[
              { key: 'conference_room_name', label: 'Name' },
              { key: 'conference_room_extension', label: 'Extension' },
              { key: 'conference_room_pin', label: 'PIN' },
              { key: 'conference_room_enabled', label: 'Enabled' },
            ]}
            fields={[
              { key: 'conference_room_name', label: 'Name' },
              { key: 'conference_room_extension', label: 'Extension' },
              { key: 'conference_room_pin', label: 'PIN' },
              { key: 'conference_room_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] },
              { key: 'conference_room_description', label: 'Description', type: 'textarea' },
            ]}
          />
        )}
        {sec === 'hold-music' && (
          <PbxResourceSection
            kind="hold-music" title="Hold Music" uuidField="music_on_hold_uuid"
            cols={[
              { key: 'music_on_hold_name', label: 'Name' },
              { key: 'music_on_hold_path', label: 'Path' },
              { key: 'music_on_hold_rate', label: 'Rate' },
              { key: 'music_on_hold_enabled', label: 'Enabled' },
            ]}
            fields={[
              { key: 'music_on_hold_name', label: 'Name' },
              { key: 'music_on_hold_path', label: 'Path' },
              { key: 'music_on_hold_rate', label: 'Rate', type: 'select', options: ['8000', '16000', '32000', '48000'] },
              { key: 'music_on_hold_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] },
            ]}
          />
        )}
        {sec === 'dialplans' && (
          <PbxResourceSection
            kind="dialplans" title="Dialplans" uuidField="dialplan_uuid"
            cols={[
              { key: 'dialplan_name', label: 'Name' },
              { key: 'dialplan_number', label: 'Number' },
              { key: 'dialplan_context', label: 'Context' },
              { key: 'dialplan_continue', label: 'Continue' },
              { key: 'dialplan_enabled', label: 'Enabled' },
            ]}
            fields={[
              { key: 'dialplan_name', label: 'Name' },
              { key: 'dialplan_number', label: 'Number' },
              { key: 'dialplan_context', label: 'Context' },
              { key: 'dialplan_order', label: 'Order', type: 'number' },
              { key: 'dialplan_continue', label: 'Continue', type: 'select', options: ['true', 'false'] },
              { key: 'dialplan_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] },
              { key: 'dialplan_xml', label: 'XML', type: 'textarea' },
              { key: 'dialplan_description', label: 'Description' },
            ]}
          />
        )}
        {sec === 'time-conditions' && (
          <PbxResourceSection
            kind="time-conditions" title="Time Conditions" uuidField="dialplan_uuid"
            cols={[
              { key: 'dialplan_name', label: 'Name' },
              { key: 'dialplan_number', label: 'Match' },
              { key: 'dialplan_enabled', label: 'Enabled' },
            ]}
            fields={[
              { key: 'dialplan_name', label: 'Name' },
              { key: 'dialplan_number', label: 'Match expression' },
              { key: 'dialplan_enabled', label: 'Enabled', type: 'select', options: ['true', 'false'] },
              { key: 'dialplan_description', label: 'Description' },
            ]}
          />
        )}
        {sec === 'feature-codes' && <FeatureCodesTable />}
        {sec === 'voicemails' && <VoicemailsTable />}
        {sec === 'recordings' && <RecordingRulesTable />}
        {sec === 'registrations' && <LiveRegistrationsTable />}
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
    <ModalShell title={`Edit IVR · ${ivr.name}`} onClose={onClose} width={500}>
      <Label>Name</Label><input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <div style={{ height: 12 }} />
      <Label>Extension</Label><input value={extension} onChange={(e) => setExtension(e.target.value)} style={inputStyle} />
      <div style={{ height: 12 }} />
      <Label>Greeting (long)</Label><textarea value={greet} onChange={(e) => setGreet(e.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }} />
      <div style={{ height: 12 }} />
      <Label>Timeout (ms)</Label><input type="number" value={timeout} onChange={(e) => setTimeoutMs(Number(e.target.value))} style={inputStyle} />
      <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textIce, fontSize: 12, marginTop: 14 }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Enabled
      </label>
      <div style={{ display: 'flex', gap: 8, marginTop: 22, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '8px 14px', borderRadius: 8, background: 'transparent', border: `1px solid ${c.border}`, color: c.mutedSilver, fontSize: 12, cursor: 'pointer' }}>Cancel</button>
        <button onClick={() => onSave({
          ivr_menu_name: name,
          ivr_menu_extension: extension,
          ivr_menu_greet_long: greet,
          ivr_menu_timeout: timeout,
          ivr_menu_enabled: enabled ? 'true' : 'false',
        })} disabled={saving} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`, opacity: saving ? 0.6 : 1 }}>{saving ? 'Saving…' : 'Save & sync to PBX'}</button>
      </div>
    </ModalShell>
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

/* ============= New section tables (Supabase-backed reads) ============= */

function SimpleSection({ title, headers, rows, loading, error, onRefresh, extra }: {
  title: string; headers: string[]; rows: any[][]; loading: boolean; error: string | null; onRefresh: () => void; extra?: React.ReactNode;
}) {
  return (
    <>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, color: c.textIce, margin: 0, fontWeight: 700 }}>
          {title} <span style={{ fontSize: 12, color: c.mutedSilver, fontWeight: 500, marginLeft: 6 }}>({rows.length})</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {extra}
          <button onClick={onRefresh} style={{ padding: '8px 12px', borderRadius: 10, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>↻ Refresh</button>
        </div>
      </header>
      <div style={{ ...theme.glass.card, padding: 0, overflow: 'hidden', background: 'rgba(255,255,255,0.04)', borderColor: c.border }}>
        {loading ? <div style={{ padding: 32, textAlign: 'center', color: c.mutedSilver }}>Loading…</div>
          : error ? <div style={{ padding: 24, color: c.danger }}>{error}</div>
          : rows.length === 0 ? <div style={{ padding: 32, textAlign: 'center', color: c.mutedSilver }}>No records.</div>
          : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                <thead><tr style={{ background: 'rgba(255,255,255,0.025)' }}>
                  {headers.map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: c.mutedSilver, fontSize: 10, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', borderBottom: `1px solid ${c.border}` }}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>{rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${c.border}` }}>
                    {r.map((cell, j) => <td key={j} style={{ padding: '11px 14px', color: c.textIce }}>{cell ?? '—'}</td>)}
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
      </div>
    </>
  );
}

function useTableLoader(loader: () => Promise<any[]>) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(() => {
    setLoading(true); setError(null);
    loader().then(setRows).catch((e) => setError(e?.message || 'Failed to load')).finally(() => setLoading(false));
  }, [loader]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, loading, error, reload };
}

function VoicemailsTable() {
  const loader = useCallback(async () => {
    const me = await getMeContext().catch(() => null);
    const orgId = me?.organization_id || LEMTEL_ORG;
    const { data, error } = await supabase.from('pbx_voicemail_settings').select('*').eq('organization_id', orgId).order('extension');
    if (error) throw error;
    return data || [];
  }, []);
  const { rows, loading, error, reload } = useTableLoader(loader);
  return <SimpleSection title="Voicemail Boxes" headers={['Ext', 'Email', 'PIN', 'Greeting', 'Attach', 'Delete after']}
    rows={rows.map((v) => [v.extension, v.email || '—', v.voicemail_password ? '••••' : '—', v.greeting_id || '—', v.attach_file ? '✓' : '—', v.local_after_email ? 'Delete' : 'Keep'])}
    loading={loading} error={error} onRefresh={reload} />;
}

function RecordingRulesTable() {
  const loader = useCallback(async () => {
    const me = await getMeContext().catch(() => null);
    const orgId = me?.organization_id || LEMTEL_ORG;
    const { data, error } = await supabase.from('pbx_call_recording_rules').select('*').eq('organization_id', orgId);
    if (error) throw error;
    return data || [];
  }, []);
  const { rows, loading, error, reload } = useTableLoader(loader);
  return <SimpleSection title="Recording Rules" headers={['Scope', 'Target', 'Mode', 'Retention (days)']}
    rows={rows.map((r) => [r.scope || 'global', r.target || '—', r.mode || 'on', r.retention_days ?? '—'])}
    loading={loading} error={error} onRefresh={reload} />;
}

function FeatureCodesTable() {
  const loader = useCallback(async () => {
    const me = await getMeContext().catch(() => null);
    const orgId = me?.organization_id || LEMTEL_ORG;
    const { data, error } = await supabase.from('pbx_feature_codes').select('*').eq('organization_id', orgId).order('code');
    if (error) throw error;
    return data || [];
  }, []);
  const { rows, loading, error, reload } = useTableLoader(loader);
  return <SimpleSection title="Feature Codes" headers={['Code', 'Name', 'Description', 'Enabled']}
    rows={rows.map((f) => [f.code, f.name || '—', f.description || '—', f.enabled ? '✓' : '—'])}
    loading={loading} error={error} onRefresh={reload} />;
}

function LiveRegistrationsTable() {
  const loader = useCallback(async () => {
    const me = await getMeContext().catch(() => null);
    const orgId = me?.organization_id || LEMTEL_ORG;
    const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
      body: { action: 'get-registrations', organization_id: orgId, params: { domain_uuid: LEMTEL_DOMAIN } },
    });
    if (error) throw error;
    return (data as any)?.data || (data as any)?.registrations || [];
  }, []);
  const { rows, loading, error, reload } = useTableLoader(loader);
  return <SimpleSection title="Live Registrations" headers={['User', 'Contact', 'Agent', 'Status', 'Expires']}
    rows={rows.map((r: any) => [r.user || r.aor || '—', r.contact || '—', r.agent || '—', r.status || 'registered', r.expires || '—'])}
    loading={loading} error={error} onRefresh={reload} />;
}
