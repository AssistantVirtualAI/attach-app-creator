import React from 'react';
import { colors, font } from '../lib/theme';
import { Card, SectionTitle, SettingsRow, PrimaryButton } from '../components/ui/Primitives';

export default function SupportScreen() {
  const diag = () => {
    const body = encodeURIComponent(
      [
        'AVA Softphone diagnostic',
        '------------------------',
        `App version: 1.0.0`,
        `UA: ${navigator.userAgent}`,
        `Time: ${new Date().toISOString()}`,
        '',
        'Describe the issue:',
        '',
      ].join('\n'),
    );
    window.location.href = `mailto:support@avastatistic.ca?subject=AVA%20Softphone%20support&body=${body}`;
  };

  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      <SectionTitle eyebrow="Help" title="Contact support" />
      <Card padded={false}>
        <SettingsRow label="Email support" icon="✉" value="support@avastatistic.ca" onPress={() => (window.location.href = 'mailto:support@avastatistic.ca')} />
        <SettingsRow label="Call us"       icon="☎" value="+1 514 555 0100"       onPress={() => (window.location.href = 'tel:+15145550100')} />
        <SettingsRow label="Knowledge base" icon="📘" value="avastatistic.ca/help" onPress={() => window.open('https://avastatistic.ca/help', '_blank')} />
        <SettingsRow label="Status page"   icon="◐" value="status.avastatistic.ca" onPress={() => window.open('https://status.avastatistic.ca', '_blank')} />
      </Card>

      <SectionTitle eyebrow="Diagnostics" title="Send report" />
      <Card padded={true}>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.55 }}>
          Sending diagnostics attaches your app version and device info so we can help you faster.
          No call audio, recordings or messages are included.
        </p>
        <PrimaryButton onClick={diag} style={{ marginTop: 10, width: '100%' }}>Send diagnostic email</PrimaryButton>
      </Card>

      <p style={{ fontSize: font.xs, color: colors.mutedSilver, textAlign: 'center', marginTop: 14 }}>
        Response within one business day · EN / FR
      </p>
    </div>
  );
}
