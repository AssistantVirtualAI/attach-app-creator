/**
 * Calling Features — visual catalogue of every available softphone action
 * with availability rules and inline tooltips.
 */
import React, { useState } from 'react';
import { colors, font, radius, gradients, shadow } from '../lib/theme';
import { SectionTitle } from '../components/ui/Primitives';

type Availability = 'always' | 'in-call' | 'on-hold' | 'idle' | 'admin' | 'soon';

interface Feature {
  key: string;
  label: string;
  icon: string;
  tone: 'blue' | 'gold' | 'cyan' | 'violet' | 'danger';
  description: string;
  availability: Availability;
}

const FEATURES: Feature[] = [
  { key: 'mute',       label: 'Mute / Unmute',     icon: '🎙', tone: 'blue',   description: 'Silence your microphone while you stay on the call. Tap again to unmute.', availability: 'in-call' },
  { key: 'hold',       label: 'Hold',              icon: '⏸',  tone: 'gold',   description: 'Place the active call on hold with music. The other party cannot hear you.', availability: 'in-call' },
  { key: 'resume',     label: 'Resume',            icon: '▶',  tone: 'blue',   description: 'Take the call back from hold and continue the conversation.', availability: 'on-hold' },
  { key: 'transferB',  label: 'Blind Transfer',    icon: '↗',  tone: 'cyan',   description: 'Send the call to another extension or number without announcing it.', availability: 'in-call' },
  { key: 'transferA',  label: 'Attended Transfer', icon: '↪',  tone: 'cyan',   description: 'Speak with the destination first, then complete the transfer.', availability: 'in-call' },
  { key: 'conference', label: '3-Way Conference',  icon: '👥', tone: 'violet', description: 'Add a third participant to create a live conference bridge.', availability: 'in-call' },
  { key: 'record',     label: 'Record',            icon: '●',  tone: 'danger', description: 'Start or stop on-demand recording. AVA can transcribe the audio after.', availability: 'in-call' },
  { key: 'park',       label: 'Park',              icon: '🅿', tone: 'gold',   description: 'Park the call in a shared slot any teammate can pick up.', availability: 'in-call' },
  { key: 'dtmf',       label: 'DTMF Keypad',       icon: '⌨',  tone: 'blue',   description: 'Send tones to navigate IVRs and phone menus.', availability: 'in-call' },
  { key: 'dnd',        label: 'Do Not Disturb',    icon: '🌙', tone: 'violet', description: 'Block incoming ringing on this extension. Voicemail still works.', availability: 'always' },
  { key: 'forward',    label: 'Call Forwarding',   icon: '⇢',  tone: 'cyan',   description: 'Redirect every incoming call to another number while you are away.', availability: 'always' },
  { key: 'voicemail',  label: 'Voicemail',         icon: '✉',  tone: 'gold',   description: 'Listen to messages and get AI summaries + sentiment for each one.', availability: 'always' },
  { key: 'cw',         label: 'Call Waiting',      icon: '⌛', tone: 'blue',   description: 'Get a soft beep when a second call arrives while you are talking.', availability: 'always' },
  { key: 'blocklist',  label: 'Blocked Numbers',   icon: '🚫', tone: 'danger', description: 'Numbers on this list will hear a fast-busy tone — they never ring you.', availability: 'always' },
  { key: 'ava',        label: 'AVA Live Assist',   icon: '✦',  tone: 'violet', description: 'Real-time coaching, objection handling and post-call summary.', availability: 'in-call' },
  { key: 'queues',     label: 'Queue Pause',       icon: '⇉',  tone: 'gold',   description: 'Pause/unpause yourself in your assigned call-center queues.', availability: 'always' },
];

function badgeFor(a: Availability) {
  switch (a) {
    case 'always':  return { label: 'Always available', color: colors.success };
    case 'in-call': return { label: 'Requires active call', color: colors.signalGold };
    case 'on-hold': return { label: 'While on hold', color: colors.avaCyan };
    case 'idle':    return { label: 'When idle', color: colors.mutedSilver };
    case 'admin':   return { label: 'Admin only', color: colors.avaViolet };
    case 'soon':    return { label: 'Coming soon', color: colors.mutedSilver };
  }
}

function toneAccent(t: Feature['tone']) {
  switch (t) {
    case 'blue':   return colors.lemtelBlue;
    case 'gold':   return colors.signalGold;
    case 'cyan':   return colors.avaCyan;
    case 'violet': return colors.avaViolet;
    case 'danger': return colors.danger;
  }
}

export default function FeaturesScreen({ sp }: { sp?: any }) {
  const [open, setOpen] = useState<Feature | null>(null);
  const inCall = sp?.snap?.callState === 'active' || sp?.snap?.callState === 'held';
  const onHold = sp?.snap?.callState === 'held';

  const isEnabled = (a: Availability) =>
    a === 'always' ? true :
    a === 'in-call' ? inCall :
    a === 'on-hold' ? onHold :
    a === 'idle' ? !inCall :
    false;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 32px' }}>
      <SectionTitle eyebrow="Reference" title="Calling features" />
      <p style={{ fontSize: font.sm, color: colors.mutedSilver, margin: '4px 0 14px', lineHeight: 1.55 }}>
        Tap any tile to see how it works. Glowing tiles are available right now.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {FEATURES.map((f) => {
          const enabled = isEnabled(f.availability);
          const accent = toneAccent(f.tone);
          return (
            <button
              key={f.key}
              onClick={() => setOpen(f)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 6, padding: '14px 8px',
                borderRadius: radius.lg,
                background: enabled
                  ? `linear-gradient(155deg, ${accent}22 0%, rgba(255,255,255,0.04) 100%)`
                  : gradients.card,
                border: `1px solid ${enabled ? accent + '66' : colors.border}`,
                color: colors.textIce,
                cursor: 'pointer',
                opacity: enabled ? 1 : 0.55,
                boxShadow: enabled ? `0 12px 28px -18px ${accent}` : shadow.glass,
                transition: 'transform .15s ease, box-shadow .15s ease, opacity .15s ease',
              }}
            >
              <span style={{
                width: 42, height: 42, borderRadius: '50%',
                background: enabled ? `${accent}24` : 'rgba(255,255,255,0.04)',
                border: `1px solid ${enabled ? accent : colors.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, color: enabled ? accent : colors.mutedSilver,
              }}>{f.icon}</span>
              <span style={{ fontSize: 11, fontWeight: 700, textAlign: 'center', letterSpacing: 0.2 }}>{f.label}</span>
            </button>
          );
        })}
      </div>

      {open && (
        <div onClick={() => setOpen(null)} style={{
          position: 'fixed', inset: 0, zIndex: 70,
          background: 'rgba(6,12,28,0.72)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          padding: 12, paddingBottom: 'calc(20px + var(--safe-bottom))',
        }}>
          <div onClick={(e) => e.stopPropagation()} style={{
            width: '100%', maxWidth: 520,
            padding: 18, borderRadius: radius.xl,
            background: `linear-gradient(155deg, ${toneAccent(open.tone)}18 0%, rgba(14,27,61,0.96) 100%)`,
            border: `1px solid ${toneAccent(open.tone)}55`,
            boxShadow: shadow.lift, color: colors.textIce,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span style={{
                width: 48, height: 48, borderRadius: '50%',
                background: `${toneAccent(open.tone)}26`,
                border: `1px solid ${toneAccent(open.tone)}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24, color: toneAccent(open.tone),
              }}>{open.icon}</span>
              <div>
                <div style={{ fontSize: font.md, fontWeight: 800 }}>{open.label}</div>
                <div style={{ fontSize: 10.5, color: badgeFor(open.availability).color, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {badgeFor(open.availability).label}
                </div>
              </div>
            </div>
            <p style={{ fontSize: font.sm, color: colors.textSub, lineHeight: 1.55, margin: '8px 0 14px' }}>
              {open.description}
            </p>
            <button onClick={() => setOpen(null)} style={{
              width: '100%', padding: '12px 14px', borderRadius: radius.md, border: 'none',
              background: gradients.shinyPrimary, color: '#fff', fontWeight: 800, letterSpacing: 0.4,
              cursor: 'pointer',
            }}>Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
