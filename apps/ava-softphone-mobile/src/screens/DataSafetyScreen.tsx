import React, { useEffect, useState } from 'react';
import { colors, font, radius } from '../lib/theme';
import { Card, SectionTitle } from '../components/ui/Primitives';
import { supabase } from '../lib/supabaseClient';

type Row = {
  type: string;
  collected: boolean;
  shared: boolean;
  optional: boolean;
  purpose: string;
  retention: string;
};

// Mirrors Google Play Data Safety form and Apple Privacy Nutrition Label.
const ROWS: Row[] = [
  // Personal
  { type: 'Email address',     collected: true,  shared: false, optional: false, purpose: 'Sign-in & account recovery', retention: 'Account lifetime' },
  { type: 'Name',              collected: true,  shared: false, optional: false, purpose: 'Caller display name',         retention: 'Account lifetime' },
  { type: 'Phone number',      collected: true,  shared: false, optional: false, purpose: 'SIP routing',                  retention: 'Account lifetime' },
  // Device & permissions
  { type: 'Microphone audio',  collected: false, shared: false, optional: false, purpose: 'Live call only — not recorded by AVA', retention: 'Not stored' },
  { type: 'Contacts',          collected: false, shared: false, optional: true,  purpose: 'On-device dialer autocomplete',         retention: 'On device only' },
  { type: 'Device push token', collected: true,  shared: false, optional: false, purpose: 'Incoming-call & voicemail alerts',     retention: 'Until sign-out' },
  // Telephony
  { type: 'Call history (CDRs)', collected: true, shared: false, optional: false, purpose: 'Show your recents & analytics',       retention: 'PBX policy (≈90d)' },
  { type: 'Call recordings',   collected: true,  shared: false, optional: true,  purpose: 'QA, training, dispute resolution',     retention: 'Workspace policy (30/60/90d)' },
  { type: 'AI transcripts',    collected: true,  shared: false, optional: true,  purpose: 'Searchable history, coaching, summary', retention: 'Same as parent recording' },
  { type: 'AI sentiment & topics', collected: true, shared: false, optional: true, purpose: 'Customer-experience trends',         retention: 'Same as parent recording' },
  { type: 'Voicemail audio',   collected: true,  shared: false, optional: false, purpose: 'Playback + AI transcript',             retention: '30 days' },
  // App health
  { type: 'Crash logs',        collected: true,  shared: false, optional: true,  purpose: 'App stability — no call content',      retention: '90 days' },
];

const PERMISSIONS = [
  { perm: 'Microphone',         why: 'Place and receive SIP calls',           required: true,  android: 'RECORD_AUDIO',         ios: 'NSMicrophoneUsageDescription' },
  { perm: 'Notifications',      why: 'Inbound call & voicemail alerts',       required: false, android: 'POST_NOTIFICATIONS',   ios: 'UNUserNotificationCenter' },
  { perm: 'Contacts',           why: 'Match caller name in dialer',           required: false, android: 'READ_CONTACTS',        ios: 'NSContactsUsageDescription' },
  { perm: 'Background refresh', why: 'Sync CDRs, queues, voicemail',          required: false, android: 'FOREGROUND_SERVICE',   ios: 'UIBackgroundModes (fetch)' },
  { perm: 'Network',            why: 'Connect to your PBX and AVA backend',   required: true,  android: 'INTERNET',             ios: 'always' },
];

export default function DataSafetyScreen() {
  return (
    <div style={{ padding: 16, overflowY: 'auto', paddingBottom: 120 }}>
      <SectionTitle eyebrow="App Store & Play Store" title="Data safety summary" />

      <Card padded={true}>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.6, margin: 0 }}>
          This page mirrors the <strong>Data Safety</strong> form in Google Play and the
          <strong> Privacy Nutrition Label</strong> in App Store Connect. Data is encrypted in
          transit (TLS 1.2+) and at rest. AVA Softphone does not sell data, does not share with
          advertisers, and does not use your call content to train third-party AI.
        </p>
      </Card>

      {/* Data types table */}
      <Card padded={true}>
        <h3 style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce, margin: '0 0 8px' }}>
          Data types handled
        </h3>
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden' }}>
          <Header />
          {ROWS.map((r) => <DataRow key={r.type} row={r} />)}
        </div>
        <p style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 10, marginBottom: 0 }}>
          "Optional" = workspace admin or end-user can disable. "Shared" = sent to any party
          outside your workspace; AVA shares <strong>none</strong> of these.
        </p>
      </Card>

      {/* Permissions table */}
      <Card padded={true}>
        <h3 style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce, margin: '0 0 8px' }}>
          Permissions required
        </h3>
        <div style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.6fr 0.8fr', padding: '8px 10px', background: 'rgba(0,35,230,0.06)', fontSize: font.xs, fontWeight: 800, color: colors.textIce }}>
            <span>Permission</span><span>Why</span><span>Required?</span>
          </div>
          {PERMISSIONS.map((p) => (
            <div key={p.perm} style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.6fr 0.8fr', padding: '8px 10px', borderTop: `1px solid ${colors.border}`, fontSize: font.xs, color: colors.textSub }}>
              <div>
                <div style={{ color: colors.textIce, fontWeight: 700 }}>{p.perm}</div>
                <div style={{ fontSize: 9, color: colors.mutedSilver }}>Android: {p.android}</div>
                <div style={{ fontSize: 9, color: colors.mutedSilver }}>iOS: {p.ios}</div>
              </div>
              <span style={{ alignSelf: 'center', lineHeight: 1.45 }}>{p.why}</span>
              <span style={{ alignSelf: 'center', color: p.required ? colors.danger : colors.success, fontWeight: 800 }}>
                {p.required ? 'Required' : 'Optional'}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Security practices */}
      <Card padded={true}>
        <h3 style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce, margin: '0 0 8px' }}>
          Security practices
        </h3>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: font.sm, color: colors.textSub, lineHeight: 1.7 }}>
          <li>All traffic encrypted with TLS 1.2+ (SIP over WSS, REST over HTTPS).</li>
          <li>Workspace data isolated via row-level security in our database.</li>
          <li>AI processing uses transient model inference — no third-party training on your audio.</li>
          <li>Auth tokens stored in OS-secure storage (Keychain on iOS, EncryptedSharedPreferences on Android).</li>
          <li>Audit log of every recording playback, transcript view, and admin action.</li>
          <li>You can request data export or deletion at any time — handled within 30 days.</li>
        </ul>
      </Card>

      <Card padded={true}>
        <p style={{ fontSize: font.xs, color: colors.mutedSilver, margin: 0 }}>
          Data Protection Officer: <a href="mailto:privacy@avastatistic.ca" style={{ color: colors.lemtelBlue }}>privacy@avastatistic.ca</a><br/>
          Last updated: {new Date().toISOString().slice(0,10)}
        </p>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr', padding: '8px 10px', background: 'rgba(0,35,230,0.06)', fontSize: font.xs, fontWeight: 800, color: colors.textIce }}>
      <span>Data type</span><span>Collected</span><span>Shared</span><span>Optional</span><span>Purpose</span><span>Retention</span>
    </div>
  );
}

function DataRow({ row }: { row: Row }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 0.7fr 0.7fr 0.7fr 1.6fr 1.2fr', padding: '8px 10px', borderTop: `1px solid ${colors.border}`, fontSize: font.xs, color: colors.textSub, alignItems: 'center' }}>
      <span style={{ color: colors.textIce, fontWeight: 700 }}>{row.type}</span>
      <span style={{ color: row.collected ? colors.lemtelBlue : colors.mutedSilver, fontWeight: 700 }}>{row.collected ? 'Yes' : 'No'}</span>
      <span style={{ color: row.shared ? colors.danger : colors.success, fontWeight: 700 }}>{row.shared ? 'Yes' : 'No'}</span>
      <span style={{ color: row.optional ? colors.success : colors.mutedSilver, fontWeight: 700 }}>{row.optional ? 'Yes' : 'No'}</span>
      <span style={{ lineHeight: 1.45 }}>{row.purpose}</span>
      <span style={{ lineHeight: 1.45, fontStyle: 'italic' }}>{row.retention}</span>
    </div>
  );
}
