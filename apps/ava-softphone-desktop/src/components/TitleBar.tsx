import React from 'react';
import LemtelLogo from './LemtelLogo';
import { useTheme } from '../lib/theme';

const dragStyle: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'drag',
};
const noDrag: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'no-drag',
};

export default function TitleBar() {
  const api = window.electronAPI;
  const { t, mode, toggle } = useTheme();

  return (
    <div
      style={{
        height: 44,
        background:
          mode === 'dark'
            ? 'linear-gradient(180deg, rgba(20,23,34,0.95) 0%, rgba(10,11,18,0.92) 100%)'
            : 'linear-gradient(180deg, rgba(255,255,255,0.95) 0%, rgba(244,246,251,0.92) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${t.border}`,
        color: t.text,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        ...dragStyle,
      }}
    >
      {/* Left: logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...noDrag }}>
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: 7,
            background: t.accentGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: 0.5,
            boxShadow: t.accentGlow,
          }}
        >
          A
        </div>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: 0.2,
            color: t.text,
          }}
        >
          AVA Softphone
        </span>
      </div>

      {/* Right: theme toggle + window controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, ...noDrag }}>
        <button
          onClick={toggle}
          title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          style={{
            background: t.surfaceHover,
            border: `1px solid ${t.border}`,
            color: t.text,
            cursor: 'pointer',
            width: 28,
            height: 24,
            borderRadius: 8,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            transition: 'all 160ms ease',
          }}
        >
          {mode === 'dark' ? '☀️' : '🌙'}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
          <button
            onClick={() => api?.minimize()}
            aria-label="Minimize"
            style={dot('#fbbf24')}
          />
          <button
            onClick={() => api?.maximize()}
            aria-label="Maximize"
            style={dot('#34d399')}
          />
          <button
            onClick={() => api?.close()}
            aria-label="Close"
            style={dot('#f87171')}
          />
        </div>
      </div>
    </div>
  );
}

const dot = (bg: string): React.CSSProperties => ({
  width: 12,
  height: 12,
  borderRadius: '50%',
  background: bg,
  border: 'none',
  cursor: 'pointer',
  transition: 'transform 120ms ease',
});

// Keep old export to avoid breaking imports
export { LemtelLogo };
