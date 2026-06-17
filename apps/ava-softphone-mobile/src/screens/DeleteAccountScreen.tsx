import React, { useState } from 'react';
import { colors, font, radius } from '../lib/theme';
import { mobileApi } from '../lib/mobileApi';
import { Card, PrimaryButton, GhostButton } from '../components/ui/Primitives';

export default function DeleteAccountScreen({ onDone }: { onDone: () => void }) {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const canDelete = confirm.trim().toUpperCase() === 'DELETE';

  const submit = async () => {
    setBusy(true); setErr(null);
    try {
      await mobileApi.deleteAccount();
      onDone();
    } catch (e: any) {
      setErr(e.message || 'Could not delete account. Contact help@avastatistic.ca');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: '16px', overflowY: 'auto' }}>
      <Card padded={true} accent="gold">
        <div style={{ fontSize: font.md, fontWeight: 800, color: colors.danger }}>Permanently delete your account</div>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.55, marginTop: 8 }}>
          This will remove your AVA Softphone account, sign you out on all devices, and unlink your extension.
          Call recordings, voicemails and analytics owned by your organization remain with your administrator.
        </p>
        <ul style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.55, paddingLeft: 18, margin: '8px 0' }}>
          <li>Authentication identity deleted</li>
          <li>Push tokens revoked</li>
          <li>Roles and extension link removed</li>
          <li>Audit log entry created (90-day retention)</li>
        </ul>
        <p style={{ fontSize: font.sm, color: colors.textIce, marginTop: 10 }}>
          Type <strong>DELETE</strong> to confirm:
        </p>
        <input
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="DELETE"
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '12px 14px', borderRadius: radius.md,
            border: `1px solid ${colors.border}`,
            background: '#fff', color: colors.textIce, fontSize: font.base, marginTop: 6,
            fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2,
          }}
        />
        {err && <div style={{ fontSize: font.sm, color: colors.danger, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <PrimaryButton onClick={submit} disabled={!canDelete || busy} style={{
            flex: 1, background: colors.danger,
          }}>{busy ? 'Deleting…' : 'Delete my account'}</PrimaryButton>
        </div>
      </Card>

      <p style={{ fontSize: font.xs, color: colors.mutedSilver, textAlign: 'center', marginTop: 12 }}>
        Need help instead? Email help@avastatistic.ca
      </p>
    </div>
  );
}
