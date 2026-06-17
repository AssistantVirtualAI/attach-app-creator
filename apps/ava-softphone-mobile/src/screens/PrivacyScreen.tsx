import React from 'react';
import { colors, font } from '../lib/theme';
import { Card, SectionTitle } from '../components/ui/Primitives';

export default function PrivacyScreen() {
  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      <SectionTitle eyebrow="Privacy" title="How AVA Softphone uses your data" />
      <Card padded={true}>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.6 }}>
          AVA Softphone is built around privacy-by-design. We only collect what is strictly
          required to deliver voice service, message you about calls, and protect your account.
        </p>
        <Bullet title="Account data" body="Email, display name, organization and SIP extension — used to sign you in and route calls." />
        <Bullet title="Call metadata" body="Caller / callee number, direction, duration, timestamp. Used to render your call history and analytics." />
        <Bullet title="Recordings & voicemail" body="Stored on your organization's PBX. Played back via short-lived signed URLs. Never accessible to other tenants." />
        <Bullet title="Microphone" body="Used only during an active call. Audio is streamed peer-to-peer / via your SIP server and never recorded by AVA itself." />
        <Bullet title="Contacts" body="Optional. Used locally for dialer autocomplete and caller-name lookup. Not uploaded." />
        <Bullet title="Push tokens" body="Used solely to notify you of incoming calls, missed calls and voicemail." />
        <Bullet title="Diagnostics" body="Crash logs and SIP state. Anonymized and used to fix bugs." />
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.6, marginTop: 10 }}>
          We never sell your data. Retention: 90 days for audit logs. Recordings follow your
          organization's policy. You can delete your account at any time from the More tab.
        </p>
        <p style={{ fontSize: font.sm, color: colors.lemtelBlue, marginTop: 12 }}>
          Full policy: <a href="https://avastatistic.ca/privacy" target="_blank" rel="noreferrer">avastatistic.ca/privacy</a>
        </p>
      </Card>
    </div>
  );
}

function Bullet({ title, body }: { title: string; body: string }) {
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: font.sm, fontWeight: 800, color: colors.textIce }}>{title}</div>
      <div style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.55 }}>{body}</div>
    </div>
  );
}
