import React from 'react';
import { colors, font, gradients, radius, shadow } from '../lib/theme';

export type Tab = 'home' | 'calls' | 'ava' | 'messages' | 'more';

const SIDE: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',   label: 'Home',   icon: '⌂' },
  { id: 'calls',  label: 'Calls',  icon: '☎' },
];
const SIDE_RIGHT: { id: Tab; label: string; icon: string }[] = [
  { id: 'messages', label: 'Messages', icon: '✉' },
  { id: 'more',     label: 'More',     icon: '⋯' },
];

export default function BottomTabs({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav style={{
      position: 'relative',
      display: 'grid',
      gridTemplateColumns: '1fr 1fr 84px 1fr 1fr',
      alignItems: 'center',
      margin: '0 10px calc(8px + var(--safe-bottom))',
      padding: '8px 6px',
      background: 'rgba(255,255,255,0.86)',
      backdropFilter: 'blur(22px) saturate(180%)',
      WebkitBackdropFilter: 'blur(22px) saturate(180%)',
      border: `1px solid ${colors.border}`,
      borderRadius: radius.xl,
      boxShadow: shadow.glass,
    }}>
      {SIDE.map((it) => <TabBtn key={it.id} item={it} active={active === it.id} onPress={() => onChange(it.id)} />)}

      {/* Raised AVA center button */}
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        <button
          onClick={() => onChange('ava')}
          aria-label="AVA assistant"
          style={{
            position: 'absolute', top: -34,
            width: 64, height: 64, borderRadius: '50%',
            background: gradients.ai,
            border: '3px solid rgba(255,255,255,0.95)',
            boxShadow: '0 12px 28px -10px rgba(122,76,255,0.55), 0 0 0 6px rgba(122,76,255,0.06)',
            color: '#fff', fontSize: 26, fontWeight: 800, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            transform: active === 'ava' ? 'scale(1.06)' : 'scale(1)',
            transition: 'transform .18s ease',
          }}
        >✦</button>
        <span style={{
          position: 'absolute', top: 36, fontSize: 10, fontWeight: 800,
          letterSpacing: 1.2, color: active === 'ava' ? colors.avaViolet : colors.mutedSilver,
        }}>AVA</span>
      </div>

      {SIDE_RIGHT.map((it) => <TabBtn key={it.id} item={it} active={active === it.id} onPress={() => onChange(it.id)} />)}
    </nav>
  );
}

function TabBtn({
  item, active, onPress,
}: { item: { id: Tab; label: string; icon: string }; active: boolean; onPress: () => void }) {
  const accent = colors.lemtelBlue;
  return (
    <button onClick={onPress} style={{
      minHeight: 50, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
      padding: '7px 4px', borderRadius: radius.lg,
      background: active ? `linear-gradient(180deg, ${accent}1c, rgba(255,255,255,0.68))` : 'transparent',
      border: 'none', cursor: 'pointer',
      color: active ? accent : colors.mutedSilver,
      transition: 'color .15s ease, background .15s ease',
      position: 'relative',
    }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
      <span style={{ fontSize: 10, fontWeight: active ? 800 : 600, letterSpacing: 0.3 }}>{item.label}</span>
    </button>
  );
}
