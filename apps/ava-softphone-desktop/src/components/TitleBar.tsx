import React from 'react';
import { WHITELABEL } from '../whitelabel.config';

const dragStyle: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'drag',
};
const noDrag: React.CSSProperties = {
  // @ts-expect-error electron CSS
  WebkitAppRegion: 'no-drag',
};

export default function TitleBar() {
  const isMac = window.electronAPI?.platform === 'darwin';
  const api = window.electronAPI;

  const dot = (color: string, onClick: () => void, label: string, glyph: string) => (
    <button
      onClick={onClick}
      aria-label={label}
      style={{
        width: 14,
        height: 14,
        borderRadius: '50%',
        background: color,
        border: 0,
        margin: '0 4px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(0,0,0,0.5)',
        fontSize: 9,
        lineHeight: 1,
        padding: 0,
      }}
    >
      <span style={{ opacity: 0 }}>{glyph}</span>
    </button>
  );

  const Controls = (
    <div style={{ display: 'flex', alignItems: 'center', padding: '0 12px', ...noDrag }}>
      {dot('#888', () => api?.minimize(), 'Minimize', '−')}
      {dot('#888', () => api?.maximize(), 'Maximize', '□')}
      {dot('#ff5f57', () => api?.close(), 'Close', '✕')}
    </div>
  );

  return (
    <div
      style={{
        height: 38,
        background: '#001a3d',
        borderBottom: '1px solid rgba(255,215,0,0.15)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...dragStyle,
      }}
    >
      {isMac && Controls}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 12px',
          flex: 1,
          justifyContent: isMac ? 'center' : 'flex-start',
        }}
      >
        <svg
          width="30"
          height="16"
          viewBox="0 0 180 90"
          xmlns="http://www.w3.org/2000/svg"
        >
          <ellipse cx="90" cy="45" rx="88" ry="43" fill="#FFD700" />
          <ellipse cx="90" cy="45" rx="78" ry="35" fill="#003DA6" />
          <text
            x="90"
            y="40"
            textAnchor="middle"
            fill="white"
            fontSize="22"
            fontWeight="bold"
            fontFamily="Arial, sans-serif"
          >
            LEMTEL
          </text>
          <text
            x="90"
            y="58"
            textAnchor="middle"
            fill="white"
            fontSize="9"
            letterSpacing="2"
            fontFamily="Arial, sans-serif"
          >
            COMMUNICATIONS
          </text>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>{WHITELABEL.appName}</span>
      </div>
      {!isMac && Controls}
    </div>
  );
}
