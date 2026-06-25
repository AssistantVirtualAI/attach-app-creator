import React, { useEffect, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import { colors, font, gradients, radius, shadow } from '../lib/theme';
import { getCallStateVisual } from '../lib/callStateAccent';
import CallQualityGauge from './CallQualityGauge';
import type { AudioProfile } from '../lib/sip/audioProfile';
import { EMPTY_QUALITY } from '../lib/sip/callQuality';
import { getAudioState, onAudioStateChange, setRoute, type AudioRoute, type AudioState } from '../lib/sip/audioOutput';

const PROFILE_CYCLE: AudioProfile[] = ['auto', 'hd', 'low-bandwidth'];

export default function ActiveCallSheet({
  sp,
  haptic,
}: {
  sp: any;
  haptic: (s?: ImpactStyle) => Promise<void>;
}) {
  const [timer, setTimer] = useState(0);
  const [showKeypad, setShowKeypad] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [audio, setAudio] = useState<AudioState>(getAudioState());
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => onAudioStateChange(setAudio), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2400);
    return () => clearTimeout(id);
  }, [toast]);

  const switchRoute = async (next: AudioRoute) => {
    haptic(ImpactStyle.Light);
    try {
      await setRoute(next);
    } catch {
      setToast(`Impossible de basculer sur ${routeLabel(next)}`);
    }
  };

  useEffect(() => {
    if (sp.snap.callState !== 'active' && sp.snap.callState !== 'held') { setTimer(0); return; }
    if (!sp.snap.startedAt) return;
    const id = setInterval(() => {
      setTimer(Math.floor((Date.now() - (sp.snap.startedAt || Date.now())) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [sp.snap.callState, sp.snap.startedAt]);

  const fmt = (s: number) =>
    `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const remote = sp.snap.remoteParty || sp.snap.remoteUri || 'Unknown';
  const isIncoming = sp.snap.callState === 'ringing-in';
  const isOutgoing = sp.snap.callState === 'ringing-out';
  const inCall = sp.snap.callState === 'active' || sp.snap.callState === 'held';
  const onHold = sp.snap.callState === 'held';
  const isTransfer = !!sp.snap.transferring;
  const isEnded = sp.snap.callState === 'ended' || sp.snap.callState === 'idle';

  // State-aware accent — see lib/callStateAccent.ts (single source of truth, snapshot-tested).
  const visual = getCallStateVisual(sp.snap.callState, { transferring: isTransfer });
  const stateAccent = visual.accent;
  const stateLabel = visual.label;

  const safeCall = (name: string, fn?: () => void) => {
    if (typeof fn !== 'function') {
      console.info(`[ActiveCall] ${name} not supported by SIP layer yet.`);
      return;
    }
    try { fn(); } catch (e) { console.warn(`[ActiveCall] ${name} failed`, e); }
  };

  const transfer = () => {
    const target = window.prompt('Transfer to extension or number:');
    if (target) safeCall('transfer', () => sp.transfer?.(target));
  };
  const park = () => safeCall('park', () => sp.park?.());
  const addCall = () => {
    const target = window.prompt('Add call to:');
    if (target) safeCall('addCall', () => sp.addCall?.(target) ?? sp.call?.(target));
  };
  const record = () => safeCall('record', () => sp.snap.recording ? sp.stopRecord?.() : sp.startRecord?.());

  const avatarGradient =
    isTransfer ? `linear-gradient(135deg, ${colors.avaViolet} 0%, ${colors.avaCyan} 100%)` :
    onHold     ? `linear-gradient(135deg, ${colors.warning} 0%, ${colors.signalGold} 100%)` :
    isEnded    ? `linear-gradient(135deg, ${colors.graphite2} 0%, ${colors.midnight2} 100%)` :
    gradients.call;

  return (
    <div style={sheetStyle}>
      {/* Top brand strip */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 16px 8px', padding: '10px 12px', borderRadius: radius.lg, background: 'rgba(255,255,255,0.04)', border: `1px solid ${stateAccent}55`, boxShadow: shadow.glass }}>
        <span style={{ fontSize: 10, letterSpacing: 1.6, fontWeight: 800, color: stateAccent, textTransform: 'uppercase' }}>
          {stateLabel}
        </span>
        <CallQualityGauge
          quality={sp.snap.quality || sp.quality || EMPTY_QUALITY}
          profile={(sp.audioProfile as AudioProfile) || 'auto'}
          onCycleProfile={() => {
            const cur = (sp.audioProfile as AudioProfile) || 'auto';
            const next = PROFILE_CYCLE[(PROFILE_CYCLE.indexOf(cur) + 1) % PROFILE_CYCLE.length];
            haptic(ImpactStyle.Light);
            sp.setAudioProfile?.(next);
          }}
        />
      </div>

      {/* Identity */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        <div style={{
          width: 132, height: 132, borderRadius: '50%',
          background: avatarGradient,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 54, fontWeight: 300, color: colors.textIce,
          boxShadow: `0 30px 80px ${stateAccent}33, inset 0 1px 0 rgba(255,255,255,0.32)`,
          position: 'relative',
          opacity: isEnded ? 0.6 : 1,
          transition: 'background .3s ease, opacity .3s ease',
        }}>
          {String(remote).charAt(0).toUpperCase()}
          {(isIncoming || isOutgoing) && (
            <span style={{
              position: 'absolute', inset: -6, borderRadius: '50%',
              border: `2px solid ${stateAccent}`,
              animation: 'pulse-ring 1.4s ease-out infinite',
            }} />
          )}
        </div>
        <div style={{ fontSize: 26, fontWeight: 600, color: colors.textIce }}>{remote}</div>
        <div style={{ fontSize: 13, color: colors.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
          {isIncoming && 'Incoming call…'}
          {isOutgoing && 'Calling…'}
          {inCall && fmt(timer)}
          {isTransfer && 'Transferring call…'}
          {isEnded && 'Call has ended'}
        </div>
        {sp.snap.muted && inCall && (
          <div style={{ fontSize: 11, color: colors.warning, letterSpacing: 1.2, fontWeight: 700, textTransform: 'uppercase' }}>Microphone muted</div>
        )}
      </div>

      {/* AI Assist drawer */}
      {aiOpen && (
        <div style={{
          margin: '0 16px 12px', padding: 14, borderRadius: radius.lg,
          background: `linear-gradient(135deg, rgba(122,76,255,0.20), rgba(35,214,255,0.14), rgba(255,255,255,0.04))`,
          border: `1px solid ${colors.borderAI}`,
          boxShadow: shadow.glass,
        }}>
          <div style={{ fontSize: 10, color: colors.avaCyan, fontWeight: 800, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>AVA Live Assist</div>
          <div style={{ fontSize: 13, color: colors.textIce, lineHeight: 1.5 }}>
            Listening… AVA will surface objections, suggest next steps and capture action items when the call ends.
          </div>
        </div>
      )}

      {/* Control grid */}
      {inCall && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 18,
          padding: '6px 20px 14px',
        }}>
          <Ctrl label={sp.snap.muted ? 'Unmute' : 'Mute'} icon="🎙" active={sp.snap.muted}
            onClick={() => { haptic(); sp.snap.muted ? sp.unmute() : sp.mute(); }} />
          <Ctrl label={onHold ? 'Resume' : 'Hold'} icon="⏸" active={onHold}
            onClick={() => { haptic(); onHold ? sp.unhold() : sp.hold(); }} />
          <Ctrl label={speaker ? 'Speaker' : 'Earpiece'} icon="🔊" active={speaker}
            onClick={() => { haptic(); toggleSpeaker(); }} />
          <Ctrl label="Keypad" icon="⌨" active={showKeypad}
            onClick={() => { haptic(); setShowKeypad((v) => !v); }} />
          <Ctrl label="Transfer" icon="↗" onClick={() => { haptic(ImpactStyle.Medium); transfer(); }} />
          <Ctrl label="Add" icon="＋" onClick={() => { haptic(ImpactStyle.Medium); addCall(); }} />
          <Ctrl label="Park" icon="🅿" onClick={() => { haptic(ImpactStyle.Medium); park(); }} />
          <Ctrl label={sp.snap.recording ? 'Stop Rec' : 'Record'} icon="●" tone={sp.snap.recording ? 'danger' : 'default'}
            onClick={() => { haptic(ImpactStyle.Medium); record(); }} />
          <Ctrl label="AVA" icon="✦" tone="ai" active={aiOpen}
            onClick={() => { haptic(); setAiOpen((v) => !v); }} />
        </div>
      )}

      {/* Primary action row */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 28, paddingBottom: 'calc(36px + var(--safe-bottom))' }}>
        {isIncoming ? (
          <>
            <BigButton color={colors.danger} onClick={() => { haptic(ImpactStyle.Heavy); sp.hangup(); }} label="Decline" icon="✕" />
            <BigButton color={colors.success} onClick={() => { haptic(ImpactStyle.Medium); sp.answer(); }} label="Accept" icon="✓" />
          </>
        ) : (
          <BigButton color={colors.danger} onClick={() => { haptic(ImpactStyle.Heavy); sp.hangup(); }} label={isOutgoing ? 'Cancel' : 'End call'} icon="✕" />
        )}
      </div>

      {showKeypad && inCall && (
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 'calc(120px + var(--safe-bottom))',
          padding: '12px 16px',
          background: 'rgba(14,27,61,0.92)', backdropFilter: 'blur(18px) saturate(170%)',
          borderTop: `1px solid ${colors.border}`,
          boxShadow: '0 -18px 46px -24px rgba(0,0,0,0.6)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {['1','2','3','4','5','6','7','8','9','*','0','#'].map((d) => (
              <button key={d} onClick={() => { haptic(); sp.sendDtmf?.(d) ?? sp.sendDTMF?.(d); }} style={{
                padding: '14px 0', borderRadius: radius.md, background: colors.graphite2,
                border: `1px solid ${colors.border}`, color: colors.textIce,
                fontSize: 20, fontWeight: 500, cursor: 'pointer',
              }}>{d}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Ctrl({ label, icon, onClick, active, tone = 'default' }: {
  label: string; icon: string; onClick: () => void; active?: boolean;
  tone?: 'default' | 'danger' | 'ai';
}) {
  const accent = tone === 'danger' ? colors.danger : tone === 'ai' ? colors.avaViolet : colors.blueGlow;
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textIce,
    }}>
      <span style={{
        width: 60, height: 60, borderRadius: '50%',
        background: active ? `${accent}24` : 'rgba(255,255,255,0.06)',
        border: `1px solid ${active ? accent : colors.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22, color: active ? accent : colors.textIce,
        boxShadow: active ? `0 12px 28px -18px ${accent}` : shadow.glass,
        transition: 'all 0.18s cubic-bezier(.4,.0,.2,1)',
      }}>{icon}</span>
      <span style={{ fontSize: 10, color: colors.mutedSilver, letterSpacing: 0.6, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

function BigButton({ color, onClick, label, icon }: { color: string; onClick: () => void; label: string; icon: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textIce,
    }}>
      <span style={{
        width: 72, height: 72, borderRadius: '50%',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 30, fontWeight: 300,
        boxShadow: `0 14px 36px ${color}66`,
      }}>{icon}</span>
      <span style={{ fontSize: 11, color: colors.mutedSilver, letterSpacing: 0.8, fontWeight: 600 }}>{label}</span>
    </button>
  );
}

const sheetStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: `radial-gradient(900px 600px at 50% -12%, rgba(0,35,230,0.32), transparent 66%), radial-gradient(720px 520px at 100% 100%, rgba(224,168,0,0.20), transparent 60%), linear-gradient(180deg, #060C1C 0%, #0A1429 50%, #0E1B3D 100%)`,
  paddingTop: 'calc(36px + var(--safe-top))',
  display: 'flex', flexDirection: 'column',
  color: colors.textIce,
};
