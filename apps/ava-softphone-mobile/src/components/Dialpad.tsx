import React from 'react';

const KEYS: { d: string; sub: string }[] = [
  { d: '1', sub: ' ' },
  { d: '2', sub: 'ABC' },
  { d: '3', sub: 'DEF' },
  { d: '4', sub: 'GHI' },
  { d: '5', sub: 'JKL' },
  { d: '6', sub: 'MNO' },
  { d: '7', sub: 'PQRS' },
  { d: '8', sub: 'TUV' },
  { d: '9', sub: 'WXYZ' },
  { d: '*', sub: '' },
  { d: '0', sub: '+' },
  { d: '#', sub: '' },
];

export default function Dialpad({
  onPress,
  onLongPressZero,
}: {
  onPress: (d: string) => void;
  onLongPressZero?: () => void;
}) {
  // Touch devices fire BOTH `touchstart` and a synthetic `click`. Without
  // this guard the digit is registered twice (the "22" bug). We mark a
  // short window after touchstart and have onClick bail out.
  const touchedAtRef = React.useRef(0);

  return (
    <div style={gridStyle}>
      {KEYS.map((k) => (
        <button
          key={k.d}
          type="button"
          onTouchStart={(e) => {
            e.preventDefault(); // suppress the synthetic mouse event chain
            touchedAtRef.current = Date.now();
            onPress(k.d);
            if (k.d === '0' && onLongPressZero) {
              (e.currentTarget as any)._lt = setTimeout(() => onLongPressZero(), 600);
            }
          }}
          onTouchEnd={(e) => {
            const lt = (e.currentTarget as any)._lt;
            if (lt) clearTimeout(lt);
          }}
          onClick={() => {
            // Skip the click if a touchstart fired in the last 500 ms —
            // it has already registered the digit.
            if (Date.now() - touchedAtRef.current < 500) return;
            onPress(k.d);
          }}
          style={keyStyle}
        >
          <span style={{ fontSize: 30, fontWeight: 300 }}>{k.d}</span>
          {k.sub && <span style={{ fontSize: 10, letterSpacing: 2, color: 'var(--text-muted)' }}>{k.sub}</span>}
        </button>
      ))}
    </div>
  );
}

const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 12,
  padding: '0 24px',
};

const keyStyle: React.CSSProperties = {
  height: 72,
  borderRadius: 36,
  background: 'rgba(255, 255, 255, 0.06)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'transform 80ms ease, background 120ms ease',
};
