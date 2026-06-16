import React, { useCallback, useRef } from 'react';
import { theme } from '../lib/theme';

const { colors: c } = theme;

export type DialerDensity = 'spacious' | 'compact' | 'ultra';

/* ============================================================
   Dialer density tokens — locked sizing so digit + sub-letter
   baselines remain pixel-aligned across every theme mode.
   Themes can change color/shadow/weight but never the rows
   declared here, which guarantees visual stability.
   ============================================================ */
export const DIALER_TOKENS: Record<DialerDensity, {
  keyH: number;          // outer key height
  gap: number;           // grid gap between keys
  digitRow: number;      // fixed row height for the digit baseline
  subRow: number;        // fixed row height for the sub-letter baseline (0 hides it)
  rowGap: number;        // gap between digit row and sub-letter row
  digit: number;         // digit font-size
  sub: number;           // sub-letter font-size
  radius: number;        // key border radius
  gridMax: number;       // overall grid max width
  pad: number;           // horizontal grid padding
}> = {
  spacious: { keyH: 72, gap: 14, digitRow: 30, subRow: 12, rowGap: 4, digit: 26, sub: 8.5, radius: 14, gridMax: 296, pad: 0 },
  compact:  { keyH: 58, gap: 8,  digitRow: 26, subRow: 12, rowGap: 4, digit: 23, sub: 8.5, radius: 14, gridMax: 296, pad: 0 },
  ultra:    { keyH: 50, gap: 6,  digitRow: 22, subRow: 0,  rowGap: 0, digit: 20, sub: 0,   radius: 12, gridMax: 248, pad: 4 },
};

export const DEFAULT_DIAL_KEYS: [string, string][] = [
  ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
  ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
  ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
  ['*', ''], ['0', '+'], ['#', ''],
];

type Props = {
  keys?: [string, string][];
  density?: DialerDensity;
  onKey: (k: string) => void;
  onBackspace?: () => void;
  onSubmit?: () => void;
  /** Test hook — attached to root grid for the baseline-check overlay. */
  'data-baseline-check'?: string;
};

export default function DialerKeypad({
  keys = DEFAULT_DIAL_KEYS,
  density = 'spacious',
  onKey,
  onBackspace,
  onSubmit,
  ...rest
}: Props) {
  const t = DIALER_TOKENS[density];
  const btnRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const COLS = 3;

  const focusAt = (i: number) => {
    const clamped = Math.max(0, Math.min(keys.length - 1, i));
    btnRefs.current[clamped]?.focus();
  };

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
    switch (e.key) {
      case 'ArrowRight': e.preventDefault(); focusAt(i + 1); return;
      case 'ArrowLeft':  e.preventDefault(); focusAt(i - 1); return;
      case 'ArrowDown':  e.preventDefault(); focusAt(i + COLS); return;
      case 'ArrowUp':    e.preventDefault(); focusAt(i - COLS); return;
      case 'Home':       e.preventDefault(); focusAt(0); return;
      case 'End':        e.preventDefault(); focusAt(keys.length - 1); return;
      case 'Backspace':  e.preventDefault(); onBackspace?.(); return;
      case 'Enter':      if (onSubmit) { e.preventDefault(); onSubmit(); } return;
      default: return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.length, onBackspace, onSubmit]);

  return (
    <div
      role="grid"
      aria-label="Dialpad"
      data-density={density}
      className="lemtel-keypad"
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        gap: t.gap,
        width: `min(100%, ${t.gridMax}px)`,
        margin: '0 auto',
        padding: t.pad ? `0 ${t.pad}px` : 0,
        boxSizing: 'border-box',
      }}
      {...rest}
    >
      {keys.map(([key, sub], i) => {
        const row = Math.floor(i / COLS) + 1;
        const col = (i % COLS) + 1;
        const hasSub = t.subRow > 0;
        return (
          <button
            key={key}
            ref={(el) => { btnRefs.current[i] = el; }}
            role="gridcell"
            aria-rowindex={row}
            aria-colindex={col}
            aria-label={sub ? `${key} (${sub})` : key}
            className="lemtel-key lemtel-glass"
            onClick={() => onKey(key)}
            onKeyDown={(e) => onKeyDown(e, i)}
            style={{
              // ---- locked geometry (theme-independent) ----
              height: t.keyH,
              display: 'grid',
              gridTemplateRows: hasSub ? `${t.digitRow}px ${t.subRow}px` : `${t.digitRow}px`,
              rowGap: t.rowGap,
              justifyItems: 'center',
              alignContent: 'center',
              padding: 0,
              borderRadius: t.radius,
              // ---- themeable surface (only color/shadow change with theme) ----
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
              border: `1px solid ${c.border}`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              color: c.textIce,
              cursor: 'pointer',
              willChange: 'transform',
            }}
          >
            <span
              className="ava-display-num"
              data-role="digit"
              style={{
                gridRow: 1,
                height: t.digitRow,
                lineHeight: `${t.digitRow}px`,
                fontSize: t.digit,
                fontWeight: 600,
                letterSpacing: '-0.01em',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >{key}</span>
            {hasSub && (
              <span
                data-role="sub"
                style={{
                  gridRow: 2,
                  height: t.subRow,
                  lineHeight: `${t.subRow}px`,
                  fontSize: t.sub,
                  color: 'rgba(159,179,214,0.72)',
                  letterSpacing: '0.22em',
                  fontWeight: 700,
                  minWidth: '2.4em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >{sub || '\u00A0'}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
