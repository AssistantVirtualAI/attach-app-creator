import React, { useCallback, useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { ava } from '../../lib/avaApi';

const { colors: c } = theme;

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
        {sec === 'extensions' && <Table title="Extensions" cols={['Ext', 'Display Name', 'User', 'Voicemail', 'Status']} load={ava.extensions} row={(e: any) => [e.extension, e.displayName, e.user || '—', e.voicemailEnabled ? 'On' : 'Off', e.enabled ? 'Active' : 'Disabled']} />}
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
