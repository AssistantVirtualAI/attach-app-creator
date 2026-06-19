import React, { useState } from 'react';
import type { ImpactStyle } from '@capacitor/haptics';
import { colors, font, radius, gradients } from '../lib/theme';
import type { Creds } from '../lib/creds';
import { Card, SectionTitle, SettingsRow } from '../components/ui/Primitives';
import { LemtelMark, AvaBadge } from '../components/Brand';
import RecordingsScreen from './RecordingsScreen';
import VoicemailScreen from './VoicemailScreen';
import MessagesScreen from './MessagesScreen';
import ContactsScreen from './ContactsScreen';
import SettingsScreen from './SettingsScreen';
import DeleteAccountScreen from './DeleteAccountScreen';
import PrivacyScreen from './PrivacyScreen';
import DataSafetyScreen from './DataSafetyScreen';
import PermissionsScreen from './PermissionsScreen';
import SupportScreen from './SupportScreen';
import AIAuditScreen from './AIAuditScreen';
import QueuesScreen from './QueuesScreen';
import FeaturesScreen from './FeaturesScreen';

type Sub = null | 'recordings' | 'voicemail' | 'messages' | 'contacts' | 'settings' | 'delete' | 'privacy' | 'datasafety' | 'permissions' | 'support' | 'aiaudit' | 'queues' | 'features';

export default function MoreScreen({
  creds, sp, onSignOut, haptic,
}: { creds: Creds; sp: any; onSignOut: () => void; haptic: (s?: ImpactStyle) => Promise<void> }) {
  const [sub, setSub] = useState<Sub>(null);

  if (sub === 'recordings')  return <SubPage onBack={() => setSub(null)} title="Recordings"><RecordingsScreen /></SubPage>;
  if (sub === 'voicemail')   return <SubPage onBack={() => setSub(null)} title="Voicemail"><VoicemailScreen haptic={haptic} /></SubPage>;
  if (sub === 'messages')    return <SubPage onBack={() => setSub(null)} title="Messages"><MessagesScreen haptic={haptic} /></SubPage>;
  if (sub === 'contacts')    return <SubPage onBack={() => setSub(null)} title="Contacts"><ContactsScreen sp={sp} /></SubPage>;
  if (sub === 'settings')    return <SubPage onBack={() => setSub(null)} title="Settings"><SettingsScreen creds={creds} sp={sp} onSignOut={onSignOut} /></SubPage>;
  if (sub === 'delete')      return <SubPage onBack={() => setSub(null)} title="Delete account"><DeleteAccountScreen onDone={onSignOut} /></SubPage>;
  if (sub === 'privacy')     return <SubPage onBack={() => setSub(null)} title="Privacy"><PrivacyScreen /></SubPage>;
  if (sub === 'datasafety')  return <SubPage onBack={() => setSub(null)} title="Data safety"><DataSafetyScreen /></SubPage>;
  if (sub === 'permissions') return <SubPage onBack={() => setSub(null)} title="Permissions"><PermissionsScreen /></SubPage>;
  if (sub === 'support')     return <SubPage onBack={() => setSub(null)} title="Support"><SupportScreen /></SubPage>;
  if (sub === 'aiaudit')     return <SubPage onBack={() => setSub(null)} title="AI requests"><AIAuditScreen /></SubPage>;
  if (sub === 'queues')      return <SubPage onBack={() => setSub(null)} title="Queues"><QueuesScreen /></SubPage>;
  if (sub === 'features')    return <SubPage onBack={() => setSub(null)} title="Calling features"><FeaturesScreen sp={sp} /></SubPage>;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <Card padded={true} accent="gold" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LemtelMark size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce }}>{creds.displayName || creds.email}</span>
              <AvaBadge compact />
            </div>
            <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>
              Ext {creds.extension} · {creds.sipDomain || 'AVA'}
            </div>
          </div>
        </div>
      </Card>

      <SectionTitle eyebrow="Communications" title="More features" />
      <Card padded={false}>
        <SettingsRow label="Calling features" icon="☎" value="Hold, transfer, record, DND…" onPress={() => setSub('features')} />
        <SettingsRow label="Queues" icon="⇉" value="Live queues & agents" onPress={() => setSub('queues')} />
      </Card>

      <SectionTitle eyebrow="Account" title="Settings & privacy" />
      <Card padded={false}>
        <SettingsRow label="Settings" icon="⚙" onPress={() => setSub('settings')} />
        <SettingsRow label="Permissions" icon="🔐" value="Mic, notifications, contacts" onPress={() => setSub('permissions')} />
        <SettingsRow label="Privacy" icon="🛡" value="How we use your data" onPress={() => setSub('privacy')} />
        <SettingsRow label="Data safety" icon="🗂" value="Store disclosures" onPress={() => setSub('datasafety')} />
        <SettingsRow label="AI requests audit" icon="✨" value="Transcription & analysis log" onPress={() => setSub('aiaudit')} />
        <SettingsRow label="Terms of service" icon="📄" onPress={() => openExternal('https://avastatistic.ca/terms')} />
        <SettingsRow label="Support" icon="❔" value="support@avastatistic.ca" onPress={() => setSub('support')} />
      </Card>

      <SectionTitle eyebrow="Danger zone" title="Account control" />
      <Card padded={false}>
        <SettingsRow label="Sign out" icon="⎋" onPress={onSignOut} />
        <SettingsRow label="Delete my account" icon="🗑" onPress={() => setSub('delete')} />
      </Card>

      <div style={{ textAlign: 'center', marginTop: 18, fontSize: 10, color: colors.mutedSilver }}>
        AVA Softphone · v1.0.0
      </div>
      <div style={{ height: 80 }} />
    </div>
  );
}

function openExternal(url: string) {
  try { window.open(url, '_blank'); } catch {}
}

function SubPage({ onBack, title, children }: { onBack: () => void; title: string; children: React.ReactNode }) {
  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px 6px', borderBottom: `1px solid ${colors.border}`,
        background: 'rgba(14,27,61,0.78)', backdropFilter: 'blur(14px)',
      }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', color: colors.lemtelBlue,
          fontSize: 18, fontWeight: 800, cursor: 'pointer', padding: '6px 8px',
        }}>‹</button>
        <span style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce }}>{title}</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}
