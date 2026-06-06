import React from 'react';
import { colors, font, gradients } from '../lib/theme';

export type Tab = 'home' | 'calls' | 'messages' | 'ai' | 'settings';

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'home',     label: 'Home',     icon: '⌂' },
  { id: 'calls',    label: 'Calls',    icon: '☎' },
  { id: 'messages', label: 'Messages', icon: '✉' },
  { id: 'ai',       label: 'AVA',      icon: '✦' },
  { id: 'settings', label: 'Settings', icon: '⚙' },
];

export default function BottomTabs({
  active, onChange,
}: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      padding: '6px 4px calc(6px + var(--safe-bottom))',
      background: 'rgba(5,8,22,0.88)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${colors.border}`,
    }}>
      {ITEMS.map((it) => {
        const isActive = it.id === active;
        const isAI = it.id === 'ai';
        const accent = isAI ? colors.avaViolet : colors.signalGold;
        return (
          <button key={it.id} onClick={() => onChange(it.id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
            padding: '6px 4px', borderRadius: 12,
            background: isActive ? `linear-gradient(180deg, ${accent}1c, transparent)` : 'transparent',
            border: 'none', cursor: 'pointer',
            color: isActive ? accent : colors.mutedSilver,
            transition: 'color .15s ease, background .15s ease',
            position: 'relative',
          }}>
            {isActive && (
              <span style={{
                position: 'absolute', top: 2, left: '50%', transform: 'translateX(-50%)',
                width: 22, height: 3, borderRadius: 2,
                background: isAI ? gradients.ai : `linear-gradient(90deg, ${colors.signalGold}, ${colors.lemtelBlue})`,
                boxShadow: `0 0 10px ${accent}88`,
              }} />
            )}
            <span style={{ fontSize: 20, lineHeight: 1, marginTop: isActive ? 4 : 0 }}>{it.icon}</span>
            <span style={{ fontSize: 10, fontWeight: isActive ? 800 : 600, letterSpacing: 0.3 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
