import React, { useEffect } from 'react';
import { useCallBus } from '../../hooks/useCallBus';
import { theme } from '../../lib/theme';

const { colors: c } = theme;

export default function IncomingCallToast() {
  const { call, answer, hangup } = useCallBus();

  useEffect(() => {
    if (call?.status === 'incoming') {
      window.electronAPI?.showNotification?.(
        'Incoming call',
        `${call.displayName || call.number}`,
      );
    }
  }, [call?.status, call?.id]);

  if (!call || call.status !== 'incoming') return null;

  return (
    <div style={{
      position: 'fixed', top: 60, right: 24, zIndex: 9999,
      width: 320, padding: 18, borderRadius: 16,
      background: `linear-gradient(160deg, ${c.deepPanel}, ${c.midnight})`,
      border: `1px solid ${c.signalGold}55`,
      boxShadow: `0 24px 60px -10px rgba(0,0,0,0.7), 0 0 30px ${c.signalGold}33`,
      color: c.textIce, animation: 'fadeIn 220ms ease-out',
    }}>
      <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2, color: c.signalGold, textTransform: 'uppercase' }}>
        Incoming call
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, marginTop: 6 }}>
        {call.displayName || 'Unknown'}
      </div>
      <div style={{ fontSize: 12, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
        {call.number}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={answer} style={btn(`linear-gradient(135deg, ${c.success}, ${c.success}cc)`, '#001a0a')}>
          Answer ⏎
        </button>
        <button onClick={hangup} style={btn(`linear-gradient(135deg, ${c.danger}, #b21a30)`, '#fff')}>
          Decline ⎋
        </button>
      </div>
    </div>
  );
}

const btn = (bg: string, color: string): React.CSSProperties => ({
  flex: 1, padding: '10px 12px', borderRadius: 10,
  background: bg, border: 'none', color, fontSize: 12, fontWeight: 800,
  cursor: 'pointer', letterSpacing: 0.4,
});
