import React from 'react';
import lemtelLogo from '../assets/lemtel-logo.png';



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
        height: 42,
        background: 'linear-gradient(180deg, #001a3d 0%, #000814 100%)',
        borderBottom: '1px solid rgba(255,215,0,0.25)',
        boxShadow: '0 1px 0 rgba(0,200,255,0.08), 0 8px 24px -12px rgba(0,90,255,0.5)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 14px',
        ...dragStyle,
      }}
    >
      {/* Left: Lemtel logo + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img
          src={lemtelLogo}
          alt="Lemtel"
          style={{
            height: 24,
            width: 'auto',
            filter: 'drop-shadow(0 0 8px rgba(255,215,0,0.35))',
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 0.5, background: 'linear-gradient(90deg,#fff,#7dd3fc)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>Lemtel Telecom</span>
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
