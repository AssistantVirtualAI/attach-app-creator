import React, { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { colors, gradients, radius, font } from '../lib/theme';
import { LemtelMark } from './Brand';
import { requestMicrophone } from '../lib/permissions';
import type { AllPermissions, PermissionStatus } from '../lib/permissions';

interface PermissionGateProps {
  onComplete: () => void;
}

type StepId = 'intro' | 'microphone' | 'contacts' | 'notifications' | 'done';

interface PermDef {
  id: 'microphone' | 'contacts' | 'notifications';
  icon: string;
  title: string;
  description: string;
  why: string;
  required: boolean;
  color: string;
}

// Only microphone is requested up-front (required for calls).
// Contacts and notifications are requested just-in-time when the user
// first engages the corresponding feature (per Apple Guideline 5.1.1).
const PERMISSION_STEPS: PermDef[] = [
  {
    id: 'microphone',
    icon: '🎤',
    title: 'Microphone & Audio',
    description: 'Lemtel Telecom needs your microphone and speaker to make and receive phone calls.',
    why: '⚡ Required for all voice calls',
    required: true,
    color: '#10B981',
  },
];

export default function PermissionGate({ onComplete }: PermissionGateProps) {
  const [step, setStep] = useState<StepId>('intro');
  const [perms, setPerms] = useState<AllPermissions>({
    microphone: 'prompt',
    speaker: 'granted',
    contacts: 'prompt',
    notifications: 'prompt',
    camera: 'prompt',
  });
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const advance = (from: StepId) => {
    const order: StepId[] = PERMISSION_STEPS.map((s) => s.id) as StepId[];
    const i = order.indexOf(from as any);
    if (i < order.length - 1) setStep(order[i + 1]);
    else {
      setStep('done');
      setTimeout(onComplete, 800);
    }
  };

  const requestCurrent = async () => {
    if (step === 'intro' || step === 'done') return;
    setRequesting(true);
    setError(null);
    let shouldAdvance = true;
    try {
      let next: PermissionStatus = 'denied';
      if (step === 'microphone') {
        next = await requestMicrophone();
        setPerms((p) => ({ ...p, microphone: next, speaker: next === 'granted' ? 'granted' : p.speaker }));
        if (next !== 'granted') {
          setError('Accès microphone refusé. Activez-le dans Réglages iOS → Lemtel → Microphone pour que les appels et l’audio bidirectionnel fonctionnent.');
          shouldAdvance = false;
        }
      } else if (step === 'contacts') {
        if (Capacitor.isNativePlatform()) {
          try {
            const { Contacts } = await import('@capacitor-community/contacts');
            const r = await Contacts.requestPermissions();
            next = r?.contacts === 'granted' ? 'granted' : 'denied';
          } catch { next = 'denied'; }
        } else {
          next = 'granted'; // web — nothing to gate
        }
        setPerms((p) => ({ ...p, contacts: next }));
      } else if (step === 'notifications') {
        if (Capacitor.isNativePlatform()) {
          try {
            const { PushNotifications } = await import('@capacitor/push-notifications');
            const r = await PushNotifications.requestPermissions();
            next = r.receive === 'granted' ? 'granted' : 'denied';
            try {
              const { LocalNotifications } = await import('@capacitor/local-notifications');
              await LocalNotifications.requestPermissions();
            } catch { /* ignore */ }
          } catch { next = 'denied'; }
        } else if (typeof Notification !== 'undefined') {
          try {
            const r = await Notification.requestPermission();
            next = r === 'granted' ? 'granted' : 'denied';
          } catch { next = 'denied'; }
        }
        setPerms((p) => ({ ...p, notifications: next }));
      }
    } finally {
      setRequesting(false);
      if (shouldAdvance) advance(step);
    }
  };

  // ─── INTRO ────────────────────────────────────────────────────────────
  if (step === 'intro') {
    return (
      <Shell>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <LemtelMark size={64} />
          <div style={{ fontSize: font.xl, fontWeight: 800, color: colors.signalGold, marginTop: 12, letterSpacing: 2 }}>
            LEMTEL
          </div>
          <div style={{ fontSize: font.xs, color: colors.mutedSilver, letterSpacing: 4 }}>COMMUNICATIONS</div>
        </div>

        <h1 style={titleStyle}>A few quick permissions</h1>
        <p style={subtitleStyle}>
          Lemtel Telecom needs a few permissions to deliver the best calling experience.
        </p>

        <div style={{ width: '100%', maxWidth: 360, margin: '8px 0 24px' }}>
          {PERMISSION_STEPS.map((p) => (
            <div key={p.id} style={previewRow}>
              <div style={{ ...previewIcon, background: `${p.color}22`, border: `1px solid ${p.color}55` }}>
                <span style={{ fontSize: 22 }}>{p.icon}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.base, fontWeight: 700, color: colors.textIce }}>{p.title}</div>
                <div style={{ fontSize: font.xs, color: p.required ? colors.signalGold : colors.mutedSilver, marginTop: 2 }}>
                  {p.required ? '⚡ Required' : '✨ Optional'}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={() => setStep('microphone')} style={primaryBtnStyle}>
          Get Started →
        </button>

        <p style={{ fontSize: 11, color: colors.mutedSilver, marginTop: 14, textAlign: 'center' }}>
          You can change permissions anytime in Settings.
        </p>
      </Shell>
    );
  }

  // ─── DONE ─────────────────────────────────────────────────────────────
  if (step === 'done') {
    return (
      <Shell>
        <div style={{ fontSize: 72, marginBottom: 16 }}>✅</div>
        <h1 style={titleStyle}>All set!</h1>
        <p style={subtitleStyle}>Lemtel Telecom is ready to use.</p>
      </Shell>
    );
  }

  // ─── PER-STEP REQUEST ─────────────────────────────────────────────────
  const current = PERMISSION_STEPS.find((s) => s.id === step)!;
  const idx = PERMISSION_STEPS.findIndex((s) => s.id === step);
  const progress = ((idx + 1) / PERMISSION_STEPS.length) * 100;
  const status = perms[current.id];

  return (
    <Shell>
      {/* Progress bar */}
      <div style={{ width: '100%', maxWidth: 360, height: 4, borderRadius: 4, background: 'rgba(255,255,255,0.08)', marginBottom: 28 }}>
        <div style={{ width: `${progress}%`, height: '100%', borderRadius: 4, background: gradients.call, transition: 'width .3s ease' }} />
      </div>

      <div style={{
        width: 96, height: 96, borderRadius: '50%',
        background: `${current.color}22`,
        border: `2px solid ${current.color}66`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 46, marginBottom: 22,
      }}>
        {current.icon}
      </div>

      <h1 style={titleStyle}>{current.title}</h1>
      <p style={subtitleStyle}>{current.description}</p>

      <div style={{
        display: 'inline-block', padding: '6px 12px', borderRadius: 999,
        background: `${current.color}1a`, border: `1px solid ${current.color}55`,
        color: current.color, fontSize: font.xs, fontWeight: 700, marginBottom: 22,
      }}>
        {current.why}
      </div>

      {status === 'granted' && (
        <div style={{ color: '#10B981', fontSize: font.sm, marginBottom: 16 }}>
          ✅ Permission granted
        </div>
      )}
      {status === 'denied' && (
        <div style={{ color: colors.danger, fontSize: font.xs, marginBottom: 16, textAlign: 'center', maxWidth: 320 }}>
          Accès refusé. Activez-le dans Réglages iOS → Lemtel → Microphone, puis relancez l’application.
        </div>
      )}
      {error && (
        <div style={{ color: colors.danger, fontSize: font.xs, marginBottom: 16, textAlign: 'center', maxWidth: 330, lineHeight: 1.45 }}>
          {error}
        </div>
      )}

      <button onClick={requestCurrent} disabled={requesting} style={{ ...primaryBtnStyle, opacity: requesting ? 0.6 : 1 }}>
        {requesting ? 'Requesting…' : 'Continue'}
      </button>


      {/* Step dots */}
      <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
        {PERMISSION_STEPS.map((s, i) => (
          <span key={s.id} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i <= idx ? colors.signalGold : 'rgba(255,255,255,0.15)',
          }} />
        ))}
      </div>
    </Shell>
  );
}

// ── Styling helpers ──────────────────────────────────────────────────────
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: gradients.app,
      paddingTop: 'var(--safe-top)', paddingBottom: 'var(--safe-bottom)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '32px 22px', color: colors.textIce, zIndex: 9999, overflowY: 'auto',
    }}>
      {children}
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: 26, fontWeight: 800, margin: '0 0 10px', textAlign: 'center', color: colors.textIce,
};
const subtitleStyle: React.CSSProperties = {
  fontSize: font.sm, color: colors.mutedSilver, textAlign: 'center', maxWidth: 340, margin: '0 0 20px', lineHeight: 1.55,
};
const primaryBtnStyle: React.CSSProperties = {
  width: '100%', maxWidth: 320, height: 54,
  background: gradients.call, color: '#fff',
  border: `1px solid ${colors.signalGold}55`, borderRadius: radius.lg,
  fontSize: font.md, fontWeight: 800, cursor: 'pointer',
  boxShadow: '0 8px 32px rgba(0,61,166,0.45)',
};
const ghostBtnStyle: React.CSSProperties = {
  width: '100%', maxWidth: 320, height: 46, marginTop: 12,
  background: 'transparent', color: colors.mutedSilver,
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: radius.md,
  fontSize: font.sm, fontWeight: 600, cursor: 'pointer',
};
const previewRow: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  padding: 12, marginBottom: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: radius.md,
};
const previewIcon: React.CSSProperties = {
  width: 44, height: 44, borderRadius: 12,
  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
};
