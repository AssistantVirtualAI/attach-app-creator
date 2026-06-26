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
      <style>{dialpadCss}</style>
      {KEYS.map((k) => (
        <button
          key={k.d}
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
          className="dialpad-glass-key"
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
  position: 'relative',
  isolation: 'isolate',
  overflow: 'hidden',
  height: 72,
  borderRadius: 36,
  background: 'radial-gradient(circle at 28% 18%, rgba(255,255,255,.28), rgba(255,255,255,.08) 36%, rgba(255,255,255,.035) 100%)',
  border: '1px solid rgba(255,255,255,.20)',
  color: 'var(--text)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.32), inset 0 -18px 28px rgba(0,0,0,.18), 0 16px 34px -24px rgba(35,214,255,.75)',
  WebkitBackdropFilter: 'blur(18px) saturate(180%)',
  backdropFilter: 'blur(18px) saturate(180%)',
  transition: 'transform .18s cubic-bezier(.2,.8,.2,1), box-shadow .18s ease, border-color .18s ease, background .18s ease',
};

const dialpadCss = `
.dialpad-glass-key::before{content:"";position:absolute;inset:-48%;background:linear-gradient(115deg,transparent 34%,rgba(255,255,255,.68) 48%,transparent 62%);transform:translateX(-78%) rotate(8deg);opacity:.55;transition:transform .42s ease;pointer-events:none;z-index:-1;}
.dialpad-glass-key::after{content:"";position:absolute;inset:9px;border-radius:999px;border:1px solid rgba(255,255,255,.10);box-shadow:0 0 22px rgba(255,255,255,.07);pointer-events:none;}
.dialpad-glass-key:hover{transform:translateY(-3px) scale(1.035);border-color:rgba(35,214,255,.62);box-shadow:inset 0 1px 0 rgba(255,255,255,.42),inset 0 -18px 28px rgba(0,0,0,.16),0 20px 46px -20px rgba(35,214,255,.85),0 0 24px -10px rgba(35,214,255,.85);}
.dialpad-glass-key:hover::before{transform:translateX(78%) rotate(8deg);}
.dialpad-glass-key:active{transform:translateY(1px) scale(.94);box-shadow:inset 0 0 34px rgba(35,214,255,.26),inset 0 1px 0 rgba(255,255,255,.50),0 10px 24px -18px rgba(35,214,255,.75);}
@media (prefers-reduced-motion:reduce){.dialpad-glass-key,.dialpad-glass-key::before{transition:none;}}
`;
