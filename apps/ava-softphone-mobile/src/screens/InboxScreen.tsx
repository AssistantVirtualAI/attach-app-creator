import React, { useState } from 'react';
import type { ImpactStyle } from '@capacitor/haptics';
import { colors, radius, font } from '../lib/theme';
import VoicemailScreen from './VoicemailScreen';
import RecordingsScreen from './RecordingsScreen';
import MessagesScreen from './MessagesScreen';

type SubTab = 'voicemail' | 'recordings' | 'sms';

const TABS: { id: SubTab; label: string; icon: string }[] = [
  { id: 'voicemail',  label: 'Voicemail',  icon: '✉' },
  { id: 'recordings', label: 'Recordings', icon: '◉' },
  { id: 'sms',        label: 'SMS',        icon: '💬' },
];

export default function InboxScreen({
  haptic,
  initial = 'voicemail',
}: {
  haptic: (s?: ImpactStyle) => Promise<void>;
  initial?: SubTab;
}) {
  const [tab, setTab] = useState<SubTab>(initial);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <header style={{ padding: '14px 14px 10px' }}>
        <div style={{ fontSize: 11, color: colors.mutedSilver, textTransform: 'uppercase', letterSpacing: 1.4, fontWeight: 700 }}>
          Inbox
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, color: colors.textIce, marginTop: 2 }}>Messages</div>
      </header>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
        padding: '0 12px 10px',
      }}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => { haptic(); setTab(t.id); }}
              style={{
                padding: '9px 6px', borderRadius: radius.md,
                background: active ? 'rgba(255,215,0,0.12)' : 'rgba(255,255,255,0.03)',
                border: `1px solid ${active ? colors.signalGold + '66' : colors.border}`,
                color: active ? colors.signalGold : colors.mutedSilver,
                fontSize: font.xs, fontWeight: 800, letterSpacing: 0.4,
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              <span style={{ fontSize: 14 }}>{t.icon}</span>
              {t.label}
            </button>
          );
        })}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {tab === 'voicemail'  && <VoicemailScreen haptic={haptic} />}
        {tab === 'recordings' && <RecordingsScreen />}
        {tab === 'sms'        && <MessagesScreen haptic={haptic} />}
      </div>
    </div>
  );
}
