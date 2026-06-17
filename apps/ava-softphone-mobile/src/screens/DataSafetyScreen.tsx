import React from 'react';
import { colors, font, radius } from '../lib/theme';
import { Card, SectionTitle } from '../components/ui/Primitives';

type Row = { type: string; collected: boolean; shared: boolean; required: boolean; purpose: string };

const ROWS: Row[] = [
  { type: 'Email address',     collected: true,  shared: false, required: true,  purpose: 'Sign-in & account recovery' },
  { type: 'Name',              collected: true,  shared: false, required: true,  purpose: 'Caller display name' },
  { type: 'Phone number',      collected: true,  shared: false, required: true,  purpose: 'Call routing' },
  { type: 'Contacts',          collected: false, shared: false, required: false, purpose: 'On-device dialer autocomplete' },
  { type: 'Microphone audio',  collected: false, shared: false, required: true,  purpose: 'Live call only — not recorded by AVA' },
  { type: 'Call history',      collected: true,  shared: false, required: true,  purpose: 'Display your recents' },
  { type: 'Voicemail audio',   collected: true,  shared: false, required: false, purpose: 'Playback & AI transcript' },
  { type: 'Crash logs',        collected: true,  shared: false, required: false, purpose: 'App stability' },
  { type: 'Device push token', collected: true,  shared: false, required: true,  purpose: 'Incoming-call notifications' },
];

export default function DataSafetyScreen() {
  return (
    <div style={{ padding: 16, overflowY: 'auto' }}>
      <SectionTitle eyebrow="App Store & Play Store" title="Data safety summary" />
      <Card padded={true}>
        <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.6 }}>
          This page mirrors the Data Safety form in Google Play and the Privacy Nutrition Label
          in App Store Connect. Data is encrypted in transit (TLS 1.2+) and at rest.
        </p>
        <div style={{ marginTop: 12, border: `1px solid ${colors.border}`, borderRadius: radius.md, overflow: 'hidden' }}>
          <Header />
          {ROWS.map((r) => (
            <DataRow key={r.type} row={r} />
          ))}
        </div>
        <p style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 12 }}>
          AVA Softphone does not sell data and does not share data with third-party advertisers.
          You can request export or deletion at any time from More → Delete account, or by
          emailing privacy@avastatistic.ca.
        </p>
      </Card>
    </div>
  );
}

function Header() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', padding: '8px 10px', background: 'rgba(0,35,230,0.06)', fontSize: font.xs, fontWeight: 800, color: colors.textIce }}>
      <span>Data type</span><span>Collected</span><span>Shared</span><span>Purpose</span>
    </div>
  );
}

function DataRow({ row }: { row: Row }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 2fr', padding: '8px 10px', borderTop: `1px solid ${colors.border}`, fontSize: font.xs, color: colors.textSub }}>
      <span style={{ color: colors.textIce, fontWeight: 700 }}>{row.type}</span>
      <span>{row.collected ? 'Yes' : 'No'}</span>
      <span>{row.shared ? 'Yes' : 'No'}</span>
      <span>{row.purpose}</span>
    </div>
  );
}
