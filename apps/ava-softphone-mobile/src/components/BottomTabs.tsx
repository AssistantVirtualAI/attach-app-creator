import React from 'react';

export type Tab = 'dial' | 'recents' | 'contacts' | 'voicemail' | 'settings';

const ITEMS: { id: Tab; label: string; icon: string }[] = [
  { id: 'dial', label: 'Keypad', icon: '⌨' },
  { id: 'recents', label: 'Recents', icon: '⟲' },
  { id: 'contacts', label: 'Contacts', icon: '☻' },
  { id: 'voicemail', label: 'Voicemail', icon: '✉' },
  { id: 'settings', label: 'More', icon: '⚙' },
];

export default function BottomTabs({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  return (
    <nav style={navStyle}>
      {ITEMS.map((it) => {
        const isActive = it.id === active;
        return (
          <button
            key={it.id}
            onClick={() => onChange(it.id)}
            style={{
              ...btnStyle,
              color: isActive ? 'var(--brand-yellow)' : 'var(--text-muted)',
            }}
          >
            <span style={{ fontSize: 22, lineHeight: 1 }}>{it.icon}</span>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: 0.2 }}>{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

const navStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-around',
  alignItems: 'center',
  padding: '8px 4px calc(8px + var(--safe-bottom))',
  background: 'rgba(7, 9, 26, 0.92)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  borderTop: '1px solid var(--border)',
};

const btnStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 4,
  padding: '6px 4px',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  transition: 'color 120ms ease',
};
