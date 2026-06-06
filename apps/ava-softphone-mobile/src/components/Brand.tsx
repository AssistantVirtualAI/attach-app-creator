import React from 'react';
import { colors, gradients } from '../lib/theme';

/** Lemtel mark — luminous rounded square with "L". Pure SVG so it scales crisply. */
export function LemtelMark({ size = 32 }: { size?: number }) {
  return (
    <span style={{
      width: size, height: size, display: 'grid', placeItems: 'center',
      borderRadius: size * 0.28,
      background: `linear-gradient(135deg, ${colors.lemtelBlue}, ${colors.blueGlow})`,
      border: `1px solid ${colors.signalGold}66`,
      boxShadow: `0 8px 22px -10px ${colors.lemtelBlue}, inset 0 1px 0 rgba(255,255,255,0.18)`,
      color: '#fff', fontSize: size * 0.5, fontWeight: 900, letterSpacing: -0.5,
      lineHeight: 1,
    }}>L</span>
  );
}

/** AVA powered-by chip — animated AI badge. */
export function AvaBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: compact ? '2px 8px' : '3px 10px',
      borderRadius: 999,
      background: 'linear-gradient(110deg, rgba(122,76,255,0.16), rgba(35,214,255,0.22), rgba(122,76,255,0.16))',
      border: `1px solid ${colors.borderAI}`,
      color: colors.avaCyan, fontSize: compact ? 9 : 9.5, fontWeight: 800,
      letterSpacing: 1.4, textTransform: 'uppercase', whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, #fff, ${colors.avaViolet} 70%)`,
        boxShadow: `0 0 8px ${colors.avaViolet}`,
      }} />
      Powered by AVA
    </span>
  );
}

/** Hero gradient banner used on Home + dashboards. */
export function HeroGradient({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      position: 'relative', overflow: 'hidden',
      padding: '20px 18px 22px',
      borderRadius: 22,
      background: gradients.hero,
      border: `1px solid ${colors.border}`,
      ...style,
    }}>
      <div aria-hidden style={{
        position: 'absolute', top: -80, right: -60, width: 220, height: 220,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${colors.signalGold}22 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -120, left: -40, width: 260, height: 260,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${colors.avaViolet}28 0%, transparent 65%)`,
        pointerEvents: 'none',
      }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  );
}
