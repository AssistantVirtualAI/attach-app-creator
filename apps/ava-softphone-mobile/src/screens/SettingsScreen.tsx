import React from 'react';
import type { Creds } from '../lib/creds';

export default function SettingsScreen({
  creds,
  sp,
  onSignOut,
}: {
  creds: Creds;
  sp: any;
  onSignOut: () => void;
}) {
  return (
    <div style={{ height: '100%', overflow: 'auto', padding: '20px 16px' }}>
      <h2 style={{ fontSize: 28, fontWeight: 700, margin: '8px 0 16px' }}>Account</h2>

      <div style={cardStyle}>
        <Row label="Email" value={creds.email} />
        <Row label="Extension" value={creds.extension} />
        {creds.displayName && <Row label="Name" value={creds.displayName} />}
        {creds.sipDomain && <Row label="SIP Domain" value={creds.sipDomain} />}
        <Row label="Status" value={sp.snap.status || 'connecting'} />
      </div>

      <button onClick={onSignOut} style={{
        marginTop: 24, width: '100%', height: 48, borderRadius: 12,
        background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
        color: 'var(--danger)', fontSize: 15, fontWeight: 600, cursor: 'pointer',
      }}>
        Sign Out
      </button>

      <div style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--text-muted)' }}>
        Powered by AVA Statistic · assistantvirtualai.com
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}</span>
      <span style={{ fontSize: 14, color: 'white' }}>{value}</span>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid var(--border)',
  borderRadius: 12,
  overflow: 'hidden',
};
