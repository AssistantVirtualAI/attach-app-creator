import React, { useEffect, useState } from 'react';
import { colors, font, radius, gradients } from '../lib/theme';
import type { Creds } from '../lib/creds';
import { mobileApi, MeResponse } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, SettingsRow, StatusDot, GhostButton, AIPanel } from '../components/ui/Primitives';
import { LemtelMark, AvaBadge } from '../components/Brand';
import { checkAllPermissions, openAppSettings, type AllPermissions, type PermissionStatus } from '../lib/permissions';

export default function SettingsScreen({
  creds, sp, onSignOut,
}: { creds: Creds; sp: any; onSignOut: () => void }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [dnd, setDnd] = useState(false);
  const [forwarding, setForwarding] = useState<string | null>(null);
  const [perms, setPerms] = useState<AllPermissions | null>(null);

  useEffect(() => {
    mobileApi.me().then((next) => {
      setMe(next);
      setDnd(!!next.status?.doNotDisturb);
      setForwarding(next.status?.forwarding || null);
    });
  }, []);
  useEffect(() => { checkAllPermissions().then(setPerms); }, []);

  const toggleDnd = async () => { const next = !dnd; setDnd(next); try { await mobileApi.setDnd(next); } catch {} };
  const toggleFwd = async () => {
    const next = forwarding ? null : '+1 514 555 0199';
    setForwarding(next); try { await mobileApi.setForwarding(next); } catch {}
  };

  const s = sp?.snap?.status;
  const sipState: 'registered' | 'connecting' | 'retrying' | 'offline' =
    s === 'registered' ? 'registered' :
    s === 'retrying'   ? 'retrying' :
    s === 'connecting' ? 'connecting' :
                         'offline';

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
              Ext {creds.extension} · {me?.client?.name ? `${me.client.name} · ` : ''}{me?.domain.sipDomain || me?.organization.name || creds.sipDomain || 'lemtel.tel'}
            </div>
            <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}><StatusDot state={sipState} /><Chip tone={me?.permissions.admin ? 'gold' : 'cyan'}>{me?.permissions.admin ? 'Admin domaine' : 'Utilisateur'}</Chip></div>
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
        <SettingsRow label="SIP domain" icon="🌐" value={me?.domain.sipDomain || me?.extension.sipDomain || creds.sipDomain || '—'} />
        {me?.client && <SettingsRow label="Client" icon="◈" value={me.client.name} />}
        <SettingsRow label="Data scope" icon="⌁" value={me?.dataScope === 'domain_admin' ? 'Domain-wide PBX' : 'Own extension only'} />
        <SettingsRow label="Role" icon="◎" value={me?.role || creds.role || 'agent'} />
        <SettingsRow label="Devices" icon="📱" value="This device · WebRTC" onPress={() => {}} />
        <SettingsRow label="Notifications" icon="🔔" value="Push enabled" onPress={() => {}} />
      </Card>

      <SectionTitle eyebrow="SIP" title="Debug" />
      <Card padded={false}>
        <SettingsRow label="Status" icon="●" value={sp?.snap?.status || 'idle'} />
        <SettingsRow label="WSS URL" icon="↔" value={sp?.sipConfig?.wssUrl || '—'} />
        <SettingsRow label="Extension + domain" icon="☎" value={`${sp?.sipConfig?.extension || creds.extension || '—'}@${sp?.sipConfig?.domain || creds.sipDomain || '—'}`} />
        <SettingsRow label="Last error" icon="!" value={sp?.snap?.error || 'None'} />
        <SettingsRow label="Retry Registration" icon="↻" onPress={() => sp?.reconnect?.()} />
      </Card>

      {me?.permissions.admin && (
        <>
          <SectionTitle eyebrow="Admin" title="Workspace controls" />
          <Card padded={false}>
            {me.permissions.canManageUsers && <SettingsRow label="Users & extensions" icon="👥" value={me.domain.sipDomain} onPress={() => {}} />}
            {me.permissions.canManageNumbers && <SettingsRow label="Phone numbers" icon="#" value="Domain inventory" onPress={() => {}} />}
            {me.permissions.canManageRouting && <SettingsRow label="IVRs, queues & routing" icon="🎛" value="Editable in AVA portal" onPress={() => {}} />}
            {me.permissions.canManageAgents && <SettingsRow label="Voice agents" icon="🤖" value="Domain agents" onPress={() => {}} />}
            <SettingsRow label="Sync status" icon="↻" value="Live PBX scope" onPress={() => {}} />
          </Card>
        </>
      )}

      <SectionTitle eyebrow="Privacy" title="Permissions" />
      <Card padded={false}>
        {PERMISSION_ITEMS.map((item) => (
          <SettingsRow
            key={item.key}
            label={item.label}
            icon={item.icon}
            value={item.sublabel}
            right={<PermBadge status={perms?.[item.key as keyof AllPermissions] ?? 'prompt'} />}
            onPress={() => {
              const s = perms?.[item.key as keyof AllPermissions];
              if (s === 'denied') openAppSettings();
            }}
          />
        ))}
        <SettingsRow label="Open device settings" icon="⚙" onPress={() => openAppSettings()} />
      </Card>

      <SectionTitle eyebrow="Privacy" title="Security & data" />
      <Card padded={false}>
        <SettingsRow label="Diagnostics" icon="📊" onPress={() => {}} />
        <SettingsRow label="About" icon="ⓘ" value="v1.0.0" onPress={() => {}} />
      </Card>


      <AIPanel title="AVA powers this app" accent={colors.avaCyan}>
        <p style={{ fontSize: font.sm, color: colors.textIce, margin: 0, lineHeight: 1.55 }}>
          All telephony data is scoped by the authenticated AVA organization/domain. Standard users can access only their own extension, while domain admins can manage the phone system features enabled for their role. No PBX secrets are exposed on this device.
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
        AVA Softphone · Powered by AVA AI
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

const PERMISSION_ITEMS = [
  { key: 'microphone',    icon: '🎤', label: 'Microphone',    sublabel: 'Required for calls' },
  { key: 'speaker',       icon: '🔊', label: 'Speaker',       sublabel: 'For call audio' },
  { key: 'contacts',      icon: '👥', label: 'Contacts',      sublabel: 'For caller ID' },
  { key: 'notifications', icon: '🔔', label: 'Notifications', sublabel: 'For incoming calls' },
] as const;

function PermBadge({ status }: { status: PermissionStatus }) {
  const cfg =
    status === 'granted' ? { dot: '#10B981', label: 'Granted' } :
    status === 'denied'  ? { dot: colors.danger, label: 'Denied' } :
    status === 'unsupported' ? { dot: colors.mutedSilver, label: 'N/A' } :
                           { dot: colors.mutedSilver, label: 'Ask' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 11, color: colors.textIce, fontWeight: 600,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot }} />
      {cfg.label}
    </span>
  );
}
