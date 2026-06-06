import React, { useEffect, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';

export default function ActiveCallSheet({
  sp,
  haptic,
}: {
  sp: any;
  haptic: (s?: ImpactStyle) => Promise<void>;
}) {
  const [timer, setTimer] = useState(0);

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

  return (
    <div style={sheetStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <div style={{
          width: 120, height: 120, borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--brand-blue), var(--brand-blue-2))',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 48, fontWeight: 300, color: 'white',
          boxShadow: '0 20px 60px rgba(0, 61, 166, 0.5)',
          position: 'relative',
        }}>
          {String(remote).charAt(0).toUpperCase()}
          {(isIncoming || isOutgoing) && (
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              border: '2px solid var(--brand-yellow)',
              animation: 'pulse-ring 1.4s ease-out infinite',
            }} />
          )}
        </div>
        <div style={{ fontSize: 24, fontWeight: 500 }}>{remote}</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          {isIncoming && 'Incoming call…'}
          {isOutgoing && 'Calling…'}
          {inCall && fmt(timer)}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'center', gap: 24, paddingBottom: 'calc(40px + var(--safe-bottom))' }}>
        {isIncoming ? (
          <>
            <CallButton color="#ef4444" onClick={() => { haptic(ImpactStyle.Heavy); sp.hangup(); }} label="Decline" icon="✕" />
            <CallButton color="#22c55e" onClick={() => { haptic(ImpactStyle.Medium); sp.answer(); }} label="Accept" icon="✓" />
          </>
        ) : (
          <>
            {inCall && (
              <CallButton
                color="rgba(255,255,255,0.1)"
                onClick={() => { haptic(); sp.snap.muted ? sp.unmute() : sp.mute(); }}
                label={sp.snap.muted ? 'Unmute' : 'Mute'}
                icon={sp.snap.muted ? '🔇' : '🎙'}
              />
            )}
            <CallButton color="#ef4444" onClick={() => { haptic(ImpactStyle.Heavy); sp.hangup(); }} label="End" icon="✕" />
            {inCall && (
              <CallButton
                color="rgba(255,255,255,0.1)"
                onClick={() => { haptic(); sp.snap.callState === 'held' ? sp.unhold() : sp.hold(); }}
                label={sp.snap.callState === 'held' ? 'Resume' : 'Hold'}
                icon="⏸"
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CallButton({ color, onClick, label, icon }: { color: string; onClick: () => void; label: string; icon: string }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
      background: 'transparent', border: 'none', cursor: 'pointer', color: 'white',
    }}>
      <span style={{
        width: 64, height: 64, borderRadius: '50%',
        background: color,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 26,
        boxShadow: color.includes('#') ? `0 8px 24px ${color}55` : 'none',
      }}>
        {icon}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</span>
    </button>
  );
}

const sheetStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 100,
  background: 'linear-gradient(180deg, #001a3d 0%, #07091a 100%)',
  paddingTop: 'calc(40px + var(--safe-top))',
  display: 'flex', flexDirection: 'column',
};
