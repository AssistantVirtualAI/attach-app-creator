import React, { useEffect, useState } from 'react';
import LemtelLogo from './LemtelLogo';
import { theme } from '../lib/theme';

const dragStyle: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'drag',
};
const noDrag: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'no-drag',
};

interface Props {
  sipStatus?: string;
}

export default function TitleBar({ sipStatus: sipStatusProp }: Props) {
  const api = window.electronAPI;
  const { colors } = theme;
  const [sipStatus, setSipStatus] = useState<string>(sipStatusProp || 'connecting');

  useEffect(() => {
    const onStatus = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') setSipStatus(detail);
    };
    window.addEventListener('lemtel:sip-status', onStatus as EventListener);
    return () => window.removeEventListener('lemtel:sip-status', onStatus as EventListener);
  }, []);
  useEffect(() => { if (sipStatusProp) setSipStatus(sipStatusProp); }, [sipStatusProp]);

  const statusMeta =
    sipStatus === 'registered'
      ? { color: colors.gold, label: 'Registered', anim: 'statusPulse 2s ease-in-out infinite' }
      : sipStatus === 'error'
        ? { color: colors.red, label: 'Error', anim: 'none' }
        : { color: colors.textSub, label: 'Connecting', anim: 'statusPulse 1.4s ease-in-out infinite' };

  return (
    <div
      style={{
        height: 38,
        background: 'rgba(10,21,48,0.85)',
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 14px',
        position: 'relative',
        backdropFilter: 'blur(14px)',
        ...dragStyle,
      }}
    >
      {/* Center: status pill (window controls handled by OS on left) */}
      <div style={{ ...noDrag }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '4px 12px', borderRadius: 999,
          background: 'rgba(0,82,204,0.18)',
          border: `1px solid ${colors.border}`,
          fontSize: 10.5, letterSpacing: 1, textTransform: 'uppercase',
          color: colors.textSub, fontWeight: 700,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusMeta.color, color: statusMeta.color,
            animation: statusMeta.anim,
          }} />
          {statusMeta.label}
        </div>
      </div>
    </div>
  );
}

export { LemtelLogo };
