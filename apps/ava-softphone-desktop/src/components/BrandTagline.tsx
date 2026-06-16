import React from 'react';
import { theme } from '../lib/theme';
import avaStatisticsLogo from '../assets/ava-statistic-logo.png';

type Size = 'sm' | 'md' | 'lg';

interface Props {
  size?: Size;
  align?: 'center' | 'left';
  showPoweredBy?: boolean;
  style?: React.CSSProperties;
}

/**
 * Unified brand tagline used under the Lemtel L logo:
 *   "Lemtel Communications — your AI companion"  [AI badge]
 *   "Powered by AVA AI"
 *
 * Uses clamp() so it scales gracefully on every screen size,
 * and tunes colors for dark mode + high-contrast mode.
 */
export default function BrandTagline({
  size = 'md',
  align = 'center',
  showPoweredBy = true,
  style,
}: Props) {
  const { colors } = theme;

  const scale = size === 'lg' ? 1 : size === 'md' ? 0.82 : 0.68;
  const taglineFs = `clamp(${11 * scale}px, ${1.1 * scale}vw + 8px, ${15 * scale}px)`;
  const poweredFs = `clamp(${9 * scale}px, ${0.7 * scale}vw + 6px, ${11 * scale}px)`;
  const gap = size === 'lg' ? 14 : size === 'md' ? 10 : 6;

  return (
    <div
      style={{
        marginTop: gap,
        display: 'flex',
        flexDirection: 'column',
        alignItems: align === 'center' ? 'center' : 'flex-start',
        gap: size === 'lg' ? 6 : 4,
        textAlign: align,
        minWidth: 0,
        maxWidth: '100%',
        ...style,
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          justifyContent: align === 'center' ? 'center' : 'flex-start',
          fontSize: taglineFs,
          fontWeight: 600,
          color: colors.text,
          letterSpacing: 0.2,
          lineHeight: 1.25,
          minWidth: 0,
          maxWidth: '100%',
        }}
      >
        <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
          Lemtel Communications
          <span style={{ color: colors.gold, margin: '0 6px', opacity: 0.85 }}>—</span>
          <span style={{ color: colors.textSub, fontWeight: 500 }}>
            your AI companion
          </span>
        </span>
        <span className="lemtel-ai-badge" aria-label="AI powered">
          <span className="lemtel-ai-badge__dot" aria-hidden />
          AI
        </span>
      </div>

      {showPoweredBy && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: poweredFs,
            fontWeight: 700,
            letterSpacing: size === 'lg' ? 3 : 2,
            color: colors.textDim,
            textTransform: 'uppercase',
          }}
        >
          Powered by
          <img
            src="/ava-statistics-logo.png"
            alt="AVA Statistics"
            style={{
              height: size === 'lg' ? 26 : size === 'md' ? 22 : 18,
              width: 'auto',
              display: 'inline-block',
              verticalAlign: 'middle',
            }}
          />
        </div>
      )}
    </div>
  );
}
