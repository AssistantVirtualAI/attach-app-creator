import React, { useEffect, useState } from 'react';
import { colors, font } from '../lib/theme';
import { Card, SectionTitle, PrimaryButton, GhostButton } from '../components/ui/Primitives';
import { checkAllPermissions, requestAllPermissions } from '../lib/permissions';

type PermMap = Record<string, string>;

export default function PermissionsScreen() {
  const [perms, setPerms] = useState<PermMap>({});

  const load = async () => {
    try { setPerms((await checkAllPermissions()) as any); } catch {}
  };
  useEffect(() => { load(); }, []);

  const req = async () => { try { await requestAllPermissions(); } finally { load(); } };

  const rows: { key: string; label: string; why: string }[] = [
    { key: 'microphone',   label: 'Microphone',    why: 'Needed for two-way voice on every call.' },
    { key: 'notifications', label: 'Notifications', why: 'Alerts you of incoming calls, missed calls and voicemail.' },
    { key: 'contacts',     label: 'Contacts',      why: 'Optional. Speeds up dialing and shows caller names.' },
  ];

  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      <SectionTitle eyebrow="Permissions" title="What the app asks for" />
      <Card padded={true}>
        {rows.map((r) => (
          <div key={r.key} style={{ padding: '10px 0', borderTop: `1px solid ${colors.border}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontSize: font.sm, fontWeight: 800, color: colors.textIce }}>{r.label}</span>
              <span style={{ fontSize: font.xs, color: status(perms[r.key]) }}>
                {perms[r.key] || 'unknown'}
              </span>
            </div>
            <div style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.55, marginTop: 4 }}>{r.why}</div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
          <PrimaryButton onClick={req} style={{ flex: 1 }}>Re-request</PrimaryButton>
          <GhostButton onClick={load}>Refresh</GhostButton>
        </div>
      </Card>
      <p style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 10 }}>
        If a permission is denied, change it in your phone's system Settings → AVA Softphone.
      </p>
    </div>
  );
}

function status(s?: string) {
  if (s === 'granted') return colors.success;
  if (s === 'denied') return colors.danger;
  return colors.warning;
}
