import React, { useEffect, useState } from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import type { Creds } from '../lib/creds';
import { mobileApi, MeResponse } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, SettingsRow, StatusDot, GhostButton, AIPanel } from '../components/ui/Primitives';
import { LemtelMark, AvaBadge } from '../components/Brand';

export default function SettingsScreen({
  creds, sp, onSignOut,
}: { creds: Creds; sp: any; onSignOut: () => void }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [dnd, setDnd] = useState(false);
  const [forwarding, setForwarding] = useState<string | null>(null);

  useEffect(() => { mobileApi.me().then(setMe); }, []);

  const toggleDnd = async () => { const next = !dnd; setDnd(next); try { await mobileApi.setDnd(next); } catch {} };
  const toggleFwd = async () => {
    const next = forwarding ? null : '+1 514 555 0199';
    setForwarding(next); try { await mobileApi.setForwarding(next); } catch {}
  };

  const sipState: 'registered' | 'connecting' | 'offline' =
    sp?.snap?.status === 'registered' ? 'registered' : sp?.snap?.status === 'connecting' ? 'connecting' : 'offline';

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      {/* Profile */}
      <Card padded={true} accent="gold" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <LemtelMark size={48} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce }}>{me?.user.name || creds.displayName || creds.email}</span>
              <AvaBadge compact />
            </div>
            <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>
              Ext {creds.extension} · {me?.organization.name || creds.sipDomain || 'lemtel.tel'}
            </div>
            <div style={{ marginTop: 6 }}><StatusDot state={sipState} /></div>
          </div>
        </div>
      </Card>

      <SectionTitle eyebrow="Calling" title="Availability" />
      <Card padded={false}>
        <SettingsRow label="Do not disturb" icon="🔕" onPress={toggleDnd} right={<Switch on={dnd} />} />
        <SettingsRow label="Call forwarding" icon="↪" onPress={toggleFwd} value={forwarding || 'Off'} right={<Switch on={!!forwarding} />} />
        <SettingsRow label="Voicemail greeting" icon="🎙" value="Default · Lemtel AVA" onPress={() => {}} />
      </Card>

      <SectionTitle eyebrow="Account" title="Extension & devices" />
      <Card padded={false}>
        <SettingsRow label="Extension" icon="☎" value={me?.extension.number || creds.extension} />
        <SettingsRow label="SIP domain" icon="🌐" value={me?.extension.sipDomain || creds.sipDomain || '—'} />
        <SettingsRow label="Devices" icon="📱" value="This iPhone · Web" onPress={() => {}} />
        <SettingsRow label="Notifications" icon="🔔" value="Push enabled" onPress={() => {}} />
      </Card>

      {me?.permissions.admin && (
        <>
          <SectionTitle eyebrow="Admin" title="Workspace controls" />
          <Card padded={false}>
            <SettingsRow label="Users & extensions" icon="👥" onPress={() => {}} />
            <SettingsRow label="Phone numbers" icon="#" onPress={() => {}} />
            <SettingsRow label="IVRs & queues" icon="🎛" onPress={() => {}} />
            <SettingsRow label="Voice agents" icon="🤖" onPress={() => {}} />
            <SettingsRow label="Sync status" icon="↻" value="Up to date" onPress={() => {}} />
          </Card>
        </>
      )}

      <SectionTitle eyebrow="Privacy" title="Security & data" />
      <Card padded={false}>
        <SettingsRow label="Permissions" icon="🛡" onPress={() => {}} />
        <SettingsRow label="Diagnostics" icon="📊" onPress={() => {}} />
        <SettingsRow label="About" icon="ⓘ" value="v1.0.0" onPress={() => {}} />
      </Card>

      <AIPanel title="AVA powers this app" accent={colors.avaCyan}>
        <p style={{ fontSize: font.sm, color: colors.textIce, margin: 0, lineHeight: 1.55 }}>
          All sensitive telephony operations run through secure AVA backend services. No PBX or SIP secrets are stored on this device.
        </p>
      </AIPanel>

      <button onClick={onSignOut} style={{
        marginTop: 16, width: '100%', height: 48, borderRadius: radius.md,
        background: 'rgba(255,77,103,0.12)', border: `1px solid ${colors.danger}55`,
        color: colors.danger, fontSize: font.base, fontWeight: 700, cursor: 'pointer',
      }}>
        Sign out
      </button>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: colors.mutedSilver, letterSpacing: 0.4 }}>
        Lemtel AI Phone · Powered by AVA
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span style={{
      width: 36, height: 22, borderRadius: 999,
      background: on ? gradients.call : 'rgba(255,255,255,0.08)',
      border: `1px solid ${on ? colors.signalGold : colors.border}`,
      position: 'relative', display: 'inline-block',
      transition: 'background .2s ease',
    }}>
      <span style={{
        position: 'absolute', top: 1.5, left: on ? 16 : 2,
        width: 17, height: 17, borderRadius: '50%',
        background: '#fff', transition: 'left .2s ease',
        boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
      }} />
    </span>
  );
}
