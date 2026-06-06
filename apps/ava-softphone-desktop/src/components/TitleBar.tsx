import React from 'react';
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
  sipStatus?: 'registered' | 'connecting' | 'error' | 'unregistered' | string;
}

export default function TitleBar({ sipStatus = 'connecting' }: Props) {
  const api = window.electronAPI;
  const { colors } = theme;

  const statusMeta =
    sipStatus === 'registered'
      ? { color: colors.green, label: 'Registered', anim: 'statusPulse 2s ease-in-out infinite' }
      : sipStatus === 'error'
        ? { color: colors.red, label: 'Error', anim: 'none' }
        : { color: colors.yellow, label: 'Connecting', anim: 'statusPulse 1.4s ease-in-out infinite' };

  return (
    <div
      style={{
        height: 38,
        background:
          'linear-gradient(180deg, rgba(8,12,30,0.95) 0%, rgba(5,5,16,0.92) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${colors.borderGold}`,
        color: colors.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        position: 'relative',
        ...dragStyle,
      }}
    >
      {/* Subtle gold glow line under titlebar */}
      <div style={{
        position: 'absolute', left: 0, right: 0, bottom: -1, height: 1,
        background: 'linear-gradient(90deg, transparent, rgba(255,215,0,0.5), transparent)',
        pointerEvents: 'none',
      }} />

      {/* Left: brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...noDrag }}>
        <LemtelLogo size="xs" glow />
        <span style={{
          fontSize: 12, fontWeight: 700, letterSpacing: 0.6,
          color: colors.text,
        }}>
          Lemtel <span style={{ color: colors.gold }}>Telecom</span>
        </span>
      </div>

      {/* Center: status pill */}
      <div style={{ ...noDrag, position: 'absolute', left: '50%', transform: 'translateX(-50%)' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${colors.border}`,
          fontSize: 10, letterSpacing: 0.5, textTransform: 'uppercase',
          color: colors.textSub,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: '50%',
            background: statusMeta.color, color: statusMeta.color,
            animation: statusMeta.anim,
          }} />
          {statusMeta.label}
        </div>
      </div>

      {/* Right: macOS traffic-light style */}
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
