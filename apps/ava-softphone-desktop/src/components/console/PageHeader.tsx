import React from 'react';
import { theme } from '../../lib/theme';

const { colors: c } = theme;

interface Props {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  accent?: string;
  right?: React.ReactNode;
}

/**
 * Shared premium page header — gold/blue gradient strip, uppercase eyebrow
 * chip, icon halo, and an optional right-side action slot. Keeps every
 * console view visually aligned and elegant under any brightness preset.
 */
export default function PageHeader({
  eyebrow, title, subtitle, icon, accent = c.signalGold, right,
}: Props) {
  return (
    <header style={{
      position: 'relative',
      padding: '20px 22px 22px',
      marginBottom: 18,
      borderRadius: 16,
      background: `linear-gradient(135deg, rgba(0,82,204,0.10) 0%, rgba(255,215,0,0.04) 60%, transparent 100%), ${c.bgCard}`,
      border: `1px solid ${c.border}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 24px -16px rgba(0,0,0,0.5)',
      overflow: 'hidden',
    }}>
      {/* Accent strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, ${c.lemtelBlue} 60%, transparent)`,
        opacity: 0.85,
      }} />
      {/* Ambient orb */}
      <div aria-hidden style={{
        position: 'absolute', top: -60, right: -40, width: 200, height: 200,
        borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${accent}22 0%, transparent 65%)`,
      }} />

      <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {icon && (
          <div style={{
            flexShrink: 0,
            width: 44, height: 44, borderRadius: 12,
            display: 'grid', placeItems: 'center',
            background: `linear-gradient(135deg, ${accent}22, ${c.lemtelBlue}1c)`,
            border: `1px solid ${accent}44`,
            color: accent,
            boxShadow: `0 6px 18px -8px ${accent}55`,
          }}>{icon}</div>
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          {eyebrow && (
            <div style={{
              fontSize: 10, fontWeight: 800, letterSpacing: 2,
              color: accent, textTransform: 'uppercase', marginBottom: 4,
            }}>{eyebrow}</div>
          )}
          <h1 style={{
            fontSize: 26, fontWeight: 700, lineHeight: 1.15,
            color: c.textIce, margin: '0 0 4px',
            letterSpacing: -0.4,
          }}>{title}</h1>
          {subtitle && (
            <p style={{ fontSize: 12.5, color: c.mutedSilver, margin: 0, lineHeight: 1.5, maxWidth: 620 }}>
              {subtitle}
            </p>
          )}
        </div>
        {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      </div>
    </header>
  );
}

export function EmptyState({
  icon = '✦', title, hint, accent = c.avaCyan,
}: { icon?: React.ReactNode; title: string; hint: string; accent?: string }) {
  return (
    <div style={{
      padding: '60px 28px', textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        display: 'grid', placeItems: 'center',
        background: `linear-gradient(135deg, ${accent}20, ${c.lemtelBlue}18)`,
        border: `1px solid ${accent}38`,
        color: accent, fontSize: 22,
        boxShadow: `0 10px 30px -16px ${accent}55`,
      }}>{icon}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: c.textIce, marginTop: 2 }}>{title}</div>
      <div style={{ fontSize: 12, color: c.mutedSilver, maxWidth: 280, lineHeight: 1.5 }}>{hint}</div>
    </div>
  );
}
