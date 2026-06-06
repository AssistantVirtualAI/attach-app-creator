import React from 'react';
import { colors, gradients } from '../lib/theme';

/**
 * Animated AVA splash — concentric arc orbits with a subtle pulse.
 * Used both for cold boot and during slow auth restore.
 */
export default function SplashAva() {
  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 28,
      background: gradients.app,
      color: colors.textIce,
    }}>
      <style>{`
        @keyframes ava-spin { to { transform: rotate(360deg); } }
        @keyframes ava-spin-rev { to { transform: rotate(-360deg); } }
        @keyframes ava-pulse { 0%,100% { opacity: .65; transform: scale(1); } 50% { opacity: 1; transform: scale(1.04); } }
        .ava-arc { stroke-linecap: round; fill: none; transform-origin: center; }
      `}</style>
      <svg width="120" height="120" viewBox="0 0 120 120" style={{ animation: 'ava-pulse 2.6s ease-in-out infinite' }}>
        <defs>
          <linearGradient id="g1" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="g2" x1="0" x2="1" y1="1" y2="0">
            <stop offset="0%" stopColor="#f5b400" />
            <stop offset="100%" stopColor="#22d3ee" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="48" stroke="rgba(255,255,255,.08)" strokeWidth="2" fill="none" />
        <circle className="ava-arc" cx="60" cy="60" r="48" stroke="url(#g1)" strokeWidth="3"
          strokeDasharray="80 220" style={{ animation: 'ava-spin 2.2s linear infinite' }} />
        <circle className="ava-arc" cx="60" cy="60" r="34" stroke="url(#g2)" strokeWidth="2"
          strokeDasharray="40 180" style={{ animation: 'ava-spin-rev 3.4s linear infinite' }} />
        <circle cx="60" cy="60" r="6" fill="#22d3ee" opacity=".9" />
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: -0.3 }}>Lemtel AI Phone</div>
        <div style={{ fontSize: 12, color: colors.mutedSilver, marginTop: 4 }}>Powered by AVA</div>
      </div>
    </div>
  );
}
