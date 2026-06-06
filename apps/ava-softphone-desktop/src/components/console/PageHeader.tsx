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
 * chip, icon halo, and an optional right-side action slot.
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
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${accent}, ${c.lemtelBlue} 60%, transparent)`,
        opacity: 0.85,
      }} />
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

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  hint: string;
  accent?: string;
  cta?: { label: string; onClick: () => void };
  secondary?: { label: string; onClick: () => void };
}

export function EmptyState({
  icon = '✦', title, hint, accent = c.avaCyan, cta, secondary,
}: EmptyStateProps) {
  return (
    <div style={{
      position: 'relative',
      padding: '40px 24px',
      margin: '12px 0',
      textAlign: 'center',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      borderRadius: 18,
      background: `radial-gradient(circle at 50% 0%, ${accent}14, transparent 70%), ${c.bgCard}`,
      border: `1px solid ${accent}33`,
      boxShadow: `inset 0 1px 0 rgba(255,255,255,0.04), 0 12px 32px -20px ${accent}55`,
      overflow: 'hidden',
    }}>
      {/* Ambient orbs */}
      <div aria-hidden style={{
        position: 'absolute', top: -40, left: -40, width: 140, height: 140,
        borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${c.lemtelBlue}33, transparent 65%)`,
      }} />
      <div aria-hidden style={{
        position: 'absolute', bottom: -50, right: -30, width: 160, height: 160,
        borderRadius: '50%', pointerEvents: 'none',
        background: `radial-gradient(circle, ${accent}22, transparent 65%)`,
      }} />

      <div style={{
        position: 'relative',
        width: 64, height: 64, borderRadius: 18,
        display: 'grid', placeItems: 'center',
        background: `linear-gradient(135deg, ${accent}28, ${c.lemtelBlue}1c)`,
        border: `1px solid ${accent}55`,
        color: accent, fontSize: 26,
        boxShadow: `0 14px 34px -16px ${accent}77, inset 0 1px 0 rgba(255,255,255,0.08)`,
      }}>{icon}</div>
      <div style={{ position: 'relative', fontSize: 15, fontWeight: 700, color: c.textIce, marginTop: 2, letterSpacing: -0.2 }}>{title}</div>
      <div style={{ position: 'relative', fontSize: 12, color: c.mutedSilver, maxWidth: 300, lineHeight: 1.55 }}>{hint}</div>
      {(cta || secondary) && (
        <div style={{ position: 'relative', display: 'flex', gap: 8, marginTop: 8 }}>
          {cta && (
            <button onClick={cta.onClick} style={{
              padding: '9px 16px', borderRadius: 10, border: 'none',
              background: `linear-gradient(135deg, ${accent}, ${c.lemtelBlue})`,
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
              boxShadow: `0 8px 24px -10px ${accent}88`,
              letterSpacing: 0.2,
            }}>{cta.label}</button>
          )}
          {secondary && (
            <button onClick={secondary.onClick} style={{
              padding: '9px 14px', borderRadius: 10,
              background: 'transparent',
              border: `1px solid ${c.border}`,
              color: c.textIce, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>{secondary.label}</button>
          )}
        </div>
      )}
    </div>
  );
}

/** Shimmer skeleton primitive — uses .lemtel-skeleton from animations.css */
export function Skeleton({
  width = '100%', height = 12, radius = 8, style,
}: { width?: number | string; height?: number | string; radius?: number; style?: React.CSSProperties }) {
  return (
    <div className="lemtel-skeleton" style={{ width, height, borderRadius: radius, ...style }} />
  );
}

/** List-row skeleton — matches the unified row layout across console views. */
export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, overflow: 'hidden' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: '24px 1fr 80px 60px',
          alignItems: 'center', gap: 12,
          padding: '14px 14px',
          borderBottom: i === rows - 1 ? 'none' : `1px solid ${c.border}`,
        }}>
          <Skeleton width={10} height={10} radius={999} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Skeleton width={`${50 + ((i * 13) % 30)}%`} height={11} />
            <Skeleton width={`${30 + ((i * 7) % 40)}%`} height={9} />
          </div>
          <Skeleton width={50} height={10} />
          <Skeleton width={36} height={10} />
        </div>
      ))}
    </div>
  );
}
