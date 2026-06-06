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
        height: 44,
        background: colors.bg,
        borderBottom: `1px solid ${colors.border}`,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        position: 'relative',
        ...dragStyle,
      }}
    >
      {/* Left: brand wordmark */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...noDrag }}>
        <LemtelLogo size="xs" glow />
      </div>

      {/* Center: status pill */}
      <div style={{ ...noDrag, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 12px', borderRadius: 999,
          background: colors.bgElev,
          border: `1px solid ${colors.border}`,
          fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase',
          color: colors.textSub, fontWeight: 600,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusMeta.color, color: statusMeta.color,
            animation: statusMeta.anim,
          }} />
          {statusMeta.label}
        </div>
      </div>

      {/* Right: window controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDrag }}>
        <button onClick={() => api?.minimize()} aria-label="Minimize" style={dot('#fbbf24')} />
        <button onClick={() => api?.maximize()} aria-label="Maximize" style={dot('#34d399')} />
        <button onClick={() => api?.close()} aria-label="Close" style={dot('#f87171')} />
      </div>
    </div>
  );
}

const dot = (bg: string): React.CSSProperties => ({
  width: 12, height: 12, borderRadius: '50%',
  background: bg, border: 'none', cursor: 'pointer',
  transition: 'transform 120ms ease, box-shadow 120ms ease',
  boxShadow: `0 0 8px ${bg}55`,
});

export { LemtelLogo };
