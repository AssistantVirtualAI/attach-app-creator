import React from 'react';
import { colors, font, radius } from '../lib/theme';
import { Card, SectionTitle } from '../components/ui/Primitives';

export default function PrivacyScreen() {
  return (
    <div style={{ padding: 16, overflowY: 'auto', paddingBottom: 120 }}>
      <SectionTitle eyebrow="Privacy" title="How AVA Softphone uses your data" />

      <Card padded={true}>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.6 }}>
          AVA Softphone is built around <strong>privacy-by-design</strong>. We only collect what is
          strictly required to deliver voice service, notify you about calls, transcribe and
          analyse conversations for your own workspace, and protect your account.
          All traffic is encrypted with TLS 1.2+ and stored in your workspace database with
          row-level security.
        </p>
      </Card>

      <Section
        title="1. Call history (CDRs)"
        items={[
          { k: 'Collected', v: 'Caller/callee number, direction, start time, duration, disposition, queue, agent extension.' },
          { k: 'Source', v: 'Synced from your company PBX over a secure backend connection.' },
          { k: 'Purpose', v: 'Display recent calls, dashboards, missed-call alerts.' },
          { k: 'Retention', v: 'Mirrors PBX retention policy — default 90 days, configurable by your workspace admin.' },
          { k: 'Sharing', v: 'Never shared with third parties. Stays inside your workspace.' },
          { k: 'Your control', v: 'Clear local cache · Request data export · Delete account.' },
        ]}
      />

      <Section
        title="2. Call recordings"
        items={[
          { k: 'Collected', v: 'Audio file reference and metadata. Audio is streamed on demand — never stored on your device.' },
          { k: 'Legal basis', v: 'Recording follows your company PBX recording rules. You are informed before playback.' },
          { k: 'Purpose', v: 'Quality assurance, training, dispute resolution.' },
          { k: 'Retention', v: 'Per workspace policy (typically 30 / 60 / 90 days).' },
          { k: 'Access', v: 'Gated by role. Every playback is written to the audit log.' },
          { k: 'Your control', v: 'Request deletion of recordings tied to your extension via Support.' },
        ]}
      />

      <Section
        title="3. AI transcription & analysis"
        items={[
          { k: 'Collected', v: 'Transcript text, speaker turns (Agent/Caller), sentiment, summary, key topics, action items.' },
          { k: 'Processing', v: 'Audio is sent to the AVA AI Gateway over TLS, processed transiently. Audio is NOT used to train any third-party model.' },
          { k: 'Storage', v: 'Transcript + analysis stored in your workspace database, linked to the call record.' },
          { k: 'Purpose', v: 'Searchable history, coaching, sentiment trends, customer-experience scoring.' },
          { k: 'Retention', v: 'Same lifecycle as the parent call recording.' },
          { k: 'Your control', v: 'Per-recording "Delete transcript" · Workspace toggle "Disable AI analysis on my calls".' },
        ]}
      />

      <Section
        title="4. Voicemail"
        items={[
          { k: 'Collected', v: 'Audio + AI transcript + caller metadata.' },
          { k: 'Purpose', v: 'Listen, read, return missed calls.' },
          { k: 'Retention', v: 'Workspace default (30 days). Deleted voicemails are purged within 24h.' },
        ]}
      />

      <Section
        title="5. Account & device"
        items={[
          { k: 'Collected', v: 'Email, display name, SIP extension, role, device push token, app version, OS.' },
          { k: 'Purpose', v: 'Authentication, push delivery, support diagnostics.' },
          { k: 'Retention', v: 'Until account deletion. 30-day grace period, then full purge.' },
        ]}
      />

      <Section
        title="6. Diagnostics & crash logs"
        items={[
          { k: 'Collected', v: 'Anonymous error events, build version, SIP connectivity state. NO call content.' },
          { k: 'Your control', v: 'Toggle off in More → Permissions → Diagnostics.' },
        ]}
      />

      <Card padded={true}>
        <h3 style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce, margin: '0 0 8px' }}>
          7. Your data controls
        </h3>
        <ControlRow label="Export my data" desc="Download a JSON archive of your account, call history, and transcripts." />
        <ControlRow label="Delete my account" desc="Permanent removal of your account, sessions, push tokens, and personal data." />
        <ControlRow label="Revoke this device" desc="Sign out and remove the device push token from our servers." />
        <ControlRow label="Disable AI analysis on my calls" desc="Stops AVA from transcribing or analyzing future calls tied to your extension." />
        <ControlRow label="Manage permissions" desc="Microphone, Notifications, Contacts, Background sync — toggle any time." />
      </Card>

      <Card padded={true}>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.6, margin: 0 }}>
          We <strong>never</strong> sell your data and <strong>never</strong> share it with
          advertisers. Questions, exercising rights, or breach reports:{' '}
          <a href="mailto:privacy@avastatistic.ca" style={{ color: colors.lemtelBlue }}>privacy@avastatistic.ca</a>.
        </p>
        <p style={{ fontSize: font.sm, color: colors.lemtelBlue, marginTop: 10, marginBottom: 0 }}>
          Full policy: <a href="https://avastatistic.ca/privacy" target="_blank" rel="noreferrer" style={{ color: colors.lemtelBlue }}>avastatistic.ca/privacy</a><br/>
          Terms of service: <a href="https://avastatistic.ca/terms" target="_blank" rel="noreferrer" style={{ color: colors.lemtelBlue }}>avastatistic.ca/terms</a>
        </p>
      </Card>
    </div>
  );
}

function Section({ title, items }: { title: string; items: { k: string; v: string }[] }) {
  return (
    <Card padded={true}>
      <h3 style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce, margin: '0 0 10px' }}>{title}</h3>
      <div style={{ display: 'grid', gap: 8 }}>
        {items.map((it) => (
          <div key={it.k} style={{
            display: 'grid', gridTemplateColumns: '110px 1fr', gap: 10,
            padding: '8px 10px', background: 'rgba(0,35,230,0.04)',
            borderRadius: radius.sm, border: `1px solid ${colors.border}`,
          }}>
            <span style={{ fontSize: font.xs, fontWeight: 800, color: colors.lemtelBlue, letterSpacing: 0.3, textTransform: 'uppercase' }}>{it.k}</span>
            <span style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.5 }}>{it.v}</span>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ControlRow({ label, desc }: { label: string; desc: string }) {
  return (
    <div style={{ padding: '10px 0', borderTop: `1px solid ${colors.border}` }}>
      <div style={{ fontSize: font.sm, fontWeight: 800, color: colors.textIce }}>{label}</div>
      <div style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.5, marginTop: 2 }}>{desc}</div>
    </div>
  );
}
