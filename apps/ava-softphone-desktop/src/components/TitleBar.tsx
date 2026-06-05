import React from 'react';

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

  const Controls = (
    <div style={{ display: 'flex', ...noDrag }}>
      <button style={ctrl} onClick={() => api?.minimize()} aria-label="Minimize">
        −
      </button>
      <button style={ctrl} onClick={() => api?.maximize()} aria-label="Maximize">
        □
      </button>
      <button
        style={{ ...ctrl, color: '#ff6b6b' }}
        onClick={() => api?.close()}
        aria-label="Close to tray"
      >
        ✕
      </button>
    </div>
  );

  return (
    <div
      style={{
        height: 32,
        background: '#0a0a0f',
        borderBottom: '1px solid #1f1f2c',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...dragStyle,
      }}
    >
      {isMac && Controls}
      <div style={{ padding: '0 12px', fontSize: 12, fontWeight: 600 }}>
        AVA Softphone
      </div>
      {!isMac && Controls}
    </div>
  );
}

const ctrl: React.CSSProperties = {
  width: 44,
  height: 32,
  background: 'transparent',
  border: 0,
  color: '#fff',
  cursor: 'pointer',
  fontSize: 14,
};
