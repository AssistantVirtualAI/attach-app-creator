import React from 'react';
import { theme } from '../../lib/theme';
import LemtelLogo from '../LemtelLogo';

const { colors: c } = theme;

export type ConsoleView =
  | 'home' | 'dialer' | 'calls' | 'messages' | 'voicemail'
  | 'recordings' | 'ai' | 'contacts' | 'admin' | 'settings';

const ICON: Record<ConsoleView, string> = {
  home: 'M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1V11z',
  dialer: 'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.8a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.35 1.84.59 2.8.72A2 2 0 0 1 22 16.92z',
  calls: 'M3 5h4l2 5-2.5 1.5a11 11 0 0 0 6 6L14 15l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 7a2 2 0 0 1 2-2',
  messages: 'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z',
  voicemail: 'M5.5 17a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zm13 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9zM5.5 17h13',
  recordings: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 6a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
  ai: 'M12 2l1.8 4.5L18 8l-4.2 1.5L12 14l-1.8-4.5L6 8l4.2-1.5L12 2zm6 10l1 2.5 2.5 1-2.5 1-1 2.5-1-2.5-2.5-1 2.5-1 1-2.5z',
  contacts: 'M16 11a4 4 0 1 0-8 0 4 4 0 0 0 8 0zm-8 2a6 6 0 0 0-6 6v2h20v-2a6 6 0 0 0-6-6H8z',
  admin: 'M12 1l9 4v6c0 5-4 9-9 11-5-2-9-6-9-11V5l9-4zm0 6a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  settings: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

const LABEL: Record<ConsoleView, string> = {
  home: 'Home', dialer: 'Dialer', calls: 'Calls', messages: 'Messages',
  voicemail: 'Voicemail', recordings: 'Recordings', ai: 'AVA AI',
  contacts: 'Contacts', admin: 'Admin', settings: 'Settings',
};

const ITEMS: ConsoleView[] = ['home', 'dialer', 'calls', 'messages', 'voicemail', 'recordings', 'ai', 'contacts', 'admin'];

export default function LeftRail({
  view, onChange, onOpenSettings, onOpenSearch,
}: {
  view: ConsoleView;
  onChange: (v: ConsoleView) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
}) {
  return (
    <aside style={{
      width: 220, flexShrink: 0, height: '100%',
      background: `linear-gradient(180deg, ${c.deepPanel} 0%, ${c.midnight} 100%)`,
      borderRight: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '14px 10px',
      WebkitAppRegion: 'drag' as any,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px 14px', WebkitAppRegion: 'no-drag' as any }}>
        <LemtelLogo size="xs" glow />
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 13, fontWeight: 800, color: c.textIce, letterSpacing: 0.4 }}>Lemtel</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: c.signalGold, letterSpacing: 1.5, textTransform: 'uppercase' }}>AI Phone</span>
        </div>
      </div>

      <button
        onClick={onOpenSearch}
        style={{
          margin: '4px 4px 12px', padding: '8px 10px',
          background: 'rgba(255,255,255,0.04)',
          border: `1px solid ${c.border}`,
          borderRadius: 10, color: c.mutedSilver,
          fontSize: 11, textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          Search
        </span>
        <kbd style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: c.textSub, fontFamily: 'inherit' }}>⌘K</kbd>
      </button>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, WebkitAppRegion: 'no-drag' as any }}>
        {ITEMS.map((v) => {
          const active = view === v;
          const isAI = v === 'ai';
          const accent = isAI ? c.avaViolet : c.signalGold;
          return (
            <button
              key={v}
              onClick={() => onChange(v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                padding: '9px 11px', borderRadius: 9,
                background: active ? `linear-gradient(90deg, ${isAI ? 'rgba(122,76,255,0.18)' : 'rgba(255,230,0,0.10)'}, transparent)` : 'transparent',
                border: '1px solid transparent',
                borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
                color: active ? c.textIce : c.mutedSilver,
                fontSize: 12.5, fontWeight: active ? 600 : 500,
                cursor: 'pointer', textAlign: 'left',
                transition: 'all 160ms ease',
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? accent : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICON[v]} />
              </svg>
              {LABEL[v]}
            </button>
          );
        })}
      </nav>

      <button
        onClick={onOpenSettings}
        style={{
          display: 'flex', alignItems: 'center', gap: 11,
          padding: '9px 11px', borderRadius: 9,
          background: 'transparent', border: 'none',
          color: c.mutedSilver, fontSize: 12.5, fontWeight: 500,
          cursor: 'pointer', textAlign: 'left',
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={ICON.settings}/></svg>
        Settings
      </button>
    </aside>
  );
}
