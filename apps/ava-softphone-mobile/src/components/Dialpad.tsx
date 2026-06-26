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
  // Use pointerdown only — fires exactly once for both mouse and touch
  // (unlike onClick + onTouchStart which double-fired the "22" bug).
  const handledRef = React.useRef<number>(0);
  const longTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  return (
    <div style={gridStyle}>
      {KEYS.map((k) => (
        <button
          key={k.d}
          className="ava-glass-button ava-dialpad-key"
          type="button"
          onPointerDown={(e) => {
            // Guard against any duplicate event in the same tick.
            const now = Date.now();
            if (now - handledRef.current < 50) return;
            handledRef.current = now;
            e.preventDefault();
            onPress(k.d);
            if (k.d === '0' && onLongPressZero) {
              longTimerRef.current = setTimeout(() => onLongPressZero(), 600);
            }
          }}
          onPointerUp={() => {
            if (longTimerRef.current) { clearTimeout(longTimerRef.current); longTimerRef.current = null; }
          }}
          onPointerLeave={() => {
            if (longTimerRef.current) { clearTimeout(longTimerRef.current); longTimerRef.current = null; }
          }}
          onClick={(e) => { e.preventDefault(); /* handled in pointerdown */ }}
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
