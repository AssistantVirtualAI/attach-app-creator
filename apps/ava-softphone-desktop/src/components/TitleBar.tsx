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
  const api = window.electronAPI;

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
        padding: '0 12px',
        ...dragStyle,
      }}
    >
      {/* Left: Lemtel logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="30" height="16" viewBox="0 0 180 90" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="90" cy="45" rx="88" ry="43" fill="#FFD700" />
          <ellipse cx="90" cy="45" rx="78" ry="35" fill="#003DA6" />
          <text x="90" y="40" textAnchor="middle" fill="white" fontSize="22" fontWeight="bold" fontFamily="Arial, sans-serif">
            LEMTEL
          </text>
          <text x="90" y="58" textAnchor="middle" fill="white" fontSize="9" letterSpacing="2" fontFamily="Arial, sans-serif">
            COMMUNICATIONS
          </text>
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700 }}>Lemtel Telecom</span>
      </div>

      {/* Right: Window controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...noDrag }}>
        <button
          onClick={() => api?.minimize()}
          aria-label="Minimize"
          style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e', border: 'none', cursor: 'pointer' }}
        />
        <button
          onClick={() => api?.maximize()}
          aria-label="Maximize"
          style={{ width: 12, height: 12, borderRadius: '50%', background: '#28ca41', border: 'none', cursor: 'pointer' }}
        />
        <button
          onClick={() => api?.close()}
          aria-label="Close"
          style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56', border: 'none', cursor: 'pointer' }}
        />
      </div>
    </div>
  );
}
