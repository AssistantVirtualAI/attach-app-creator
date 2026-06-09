import React from 'react';
import { theme } from '../../lib/theme';
import LemtelLogo from '../LemtelLogo';
import { useTranslation, type I18nKey } from '../../lib/i18n';
import LanguageSwitcher from '../ui/LanguageSwitcher';

const { colors: c } = theme;

const NAV_KEY: Record<string, I18nKey> = {
  home: 'nav.home', dialer: 'nav.dialer', calls: 'nav.calls', messages: 'nav.messages',
  voicemail: 'nav.voicemail', recordings: 'nav.recordings', ai: 'nav.ai',
  contacts: 'nav.contacts', admin: 'nav.admin', settings: 'nav.settings',
  telecom: 'nav.telecom', orgchat: 'nav.orgchat', aiadmin: 'nav.aiadmin', reports: 'nav.reports',
};

export type ConsoleView =
  | 'home' | 'dialer' | 'calls' | 'messages' | 'voicemail'
  | 'recordings' | 'ai' | 'contacts' | 'admin' | 'settings'
  | 'telecom' | 'orgchat' | 'aiadmin' | 'reports';

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
  telecom: 'M4 4h16v6H4zM4 14h16v6H4z',
  orgchat: 'M7 8h10M7 12h7M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  aiadmin: 'M12 2l1.8 4.5L18 8l-4.2 1.5L12 14l-1.8-4.5L6 8l4.2-1.5L12 2zM5 18h14',
  reports: 'M3 3v18h18M7 14l3-3 3 3 5-5',
  settings: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z',
};

const LABEL: Record<ConsoleView, string> = {
  home: 'Home', dialer: 'Dialer', calls: 'Calls', messages: 'Messages',
  voicemail: 'Voicemail', recordings: 'Recordings', ai: 'AVA AI',
  contacts: 'Contacts', admin: 'Admin', settings: 'Settings',
  telecom: 'Telecom', orgchat: 'Org Chat', aiadmin: 'AI Admin', reports: 'Reports',
};

const USER_ITEMS: ConsoleView[] = ['home', 'dialer', 'calls', 'messages', 'voicemail', 'recordings', 'orgchat', 'ai', 'telecom', 'contacts'];
const ADMIN_ITEMS: ConsoleView[] = ['reports', 'admin', 'aiadmin'];

interface Props {
  view: ConsoleView;
  onChange: (v: ConsoleView) => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  compact?: boolean;
  isAdmin?: boolean;
}

export default function LeftRail({ view, onChange, onOpenSettings, onOpenSearch, compact, isAdmin }: Props) {
  const { t } = useTranslation();
  const ITEMS: ConsoleView[] = isAdmin ? [...USER_ITEMS, ...ADMIN_ITEMS] : USER_ITEMS;
  if (compact) return <CompactRail view={view} onChange={onChange} onOpenSettings={onOpenSettings} items={ITEMS} />;

  return (
    <aside style={{
      width: 236, flexShrink: 0, height: '100%',
      background: `linear-gradient(180deg, ${c.deepPanel} 0%, ${c.midnight} 100%)`,
      borderRight: `1px solid ${c.border}`,
      display: 'flex', flexDirection: 'column',
      padding: '16px 12px 14px',
      WebkitAppRegion: 'drag' as any,
      position: 'relative',
    }}>
      {/* Brand block */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '6px 8px 16px',
        WebkitAppRegion: 'no-drag' as any,
      }}>
        <LemtelLogo size="sm" glow />
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: c.textIce, letterSpacing: 0.3 }}>Lemtel</span>
          <span style={{ fontSize: 9, fontWeight: 700, color: c.signalGold, letterSpacing: 1.6, textTransform: 'uppercase', marginTop: 3 }}>
            Telecom · AI Phone
          </span>
        </div>
      </div>

      <button
        onClick={onOpenSearch}
        style={{
          margin: '4px 4px 12px', padding: '9px 11px',
          background: 'rgba(140,180,255,0.06)',
          border: `1px solid ${c.border}`,
          borderRadius: 10, color: c.mutedSilver,
          fontSize: 11.5, textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          WebkitAppRegion: 'no-drag' as any,
          transition: 'border-color .18s ease, background .18s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = c.borderGold; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = c.border; }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          {t('nav.search')}
        </span>
        <kbd style={{ fontSize: 9, padding: '2px 5px', borderRadius: 4, background: 'rgba(255,255,255,0.06)', color: c.textSub, fontFamily: 'inherit' }}>⌘K</kbd>
      </button>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2, WebkitAppRegion: 'no-drag' as any, overflowY: 'auto' }}>
        {ITEMS.map((v) => <RailItem key={v} v={v} active={view === v} onClick={() => onChange(v)} label={t(NAV_KEY[v])} />)}
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
          transition: 'color .15s ease, background .15s ease',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(140,180,255,0.06)'; e.currentTarget.style.color = c.textIce; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.mutedSilver; }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d={ICON.settings}/></svg>
        {t('nav.settings')}
      </button>

      {/* AVA footer chip */}
      <div style={{
        marginTop: 10, padding: '10px 12px',
        borderRadius: 12,
        background: 'linear-gradient(135deg, rgba(122,76,255,0.18), rgba(35,214,255,0.08))',
        border: `1px solid ${c.borderAI}`,
        display: 'flex', alignItems: 'center', gap: 10,
        WebkitAppRegion: 'no-drag' as any,
      }}>
        <div style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: `linear-gradient(135deg, ${c.avaViolet}, ${c.avaCyan})`,
          display: 'grid', placeItems: 'center',
          color: '#fff', fontSize: 10, fontWeight: 800, letterSpacing: 0.5,
        }}>AI</div>
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, flex: 1, minWidth: 0 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: c.avaCyan, letterSpacing: 1.2, textTransform: 'uppercase' }}>
            Powered by
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: c.textIce, letterSpacing: 0.3 }}>
            AVA AI
          </span>
        </div>
        <LanguageSwitcher />
      </div>
    </aside>
  );
}

function RailItem({ v, active, onClick, label }: { v: ConsoleView; active: boolean; onClick: () => void; label?: string }) {
  const isAI = v === 'ai';
  const accent = isAI ? c.avaViolet : c.signalGold;
  return (
    <button
      onClick={onClick}
      aria-label={label ?? LABEL[v]}
      aria-current={active ? 'page' : undefined}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '9px 11px', borderRadius: 9,
        background: active
          ? `linear-gradient(90deg, ${isAI ? 'rgba(122,76,255,0.22)' : 'rgba(0,82,204,0.22)'}, transparent)`
          : 'transparent',
        border: '1px solid transparent',
        borderLeft: active ? `2px solid ${accent}` : '2px solid transparent',
        color: active ? c.textIce : c.mutedSilver,
        fontSize: 12.5, fontWeight: active ? 600 : 500,
        cursor: 'pointer', textAlign: 'left',
        transition: 'all 180ms cubic-bezier(.2,.7,.2,1)',
        transform: 'translateX(0)',
        position: 'relative',
        outline: 'none',
      }}
      onFocus={(e) => { e.currentTarget.style.boxShadow = `0 0 0 2px ${accent}55`; }}
      onBlur={(e) => { e.currentTarget.style.boxShadow = 'none'; }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'rgba(140,180,255,0.08)';
          e.currentTarget.style.color = c.textIce;
          e.currentTarget.style.transform = 'translateX(2px)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.background = 'transparent';
          e.currentTarget.style.color = c.mutedSilver;
          e.currentTarget.style.transform = 'translateX(0)';
        }
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? accent : 'currentColor'} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d={ICON[v]} />
      </svg>
      {label ?? LABEL[v]}
    </button>
  );
}

/* ─── Compact bottom rail for narrow / minimized windows ─── */
function CompactRail({ view, onChange, onOpenSettings, items }: { view: ConsoleView; onChange: (v: ConsoleView) => void; onOpenSettings: () => void; items: ConsoleView[] }) {
  const { t } = useTranslation();
  const all: ConsoleView[] = [...items, 'settings'];
  return (
    <aside style={{
      position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 30,
      background: `linear-gradient(180deg, ${c.deepPanel}f2, ${c.midnight}f7)`,
      borderTop: `1px solid ${c.border}`,
      backdropFilter: 'blur(14px)',
      WebkitBackdropFilter: 'blur(14px)',
      boxShadow: '0 -12px 32px -16px rgba(0,0,0,0.5)',
    }}>
      <div className="lemtel-rail-h">
        {all.map((v) => {
          const active = view === v;
          const isAI = v === 'ai';
          const accent = isAI ? c.avaViolet : c.signalGold;
          return (
            <button
              key={v}
              onClick={() => v === 'settings' ? onOpenSettings() : onChange(v)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                minWidth: 64, padding: '8px 10px', borderRadius: 12,
                background: active ? `linear-gradient(180deg, ${accent}22, transparent)` : 'transparent',
                border: active ? `1px solid ${accent}55` : '1px solid transparent',
                color: active ? c.textIce : c.mutedSilver,
                fontSize: 10, fontWeight: active ? 700 : 500,
                cursor: 'pointer', transition: 'all .18s ease',
              }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={active ? accent : 'currentColor'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d={ICON[v]} />
              </svg>
              <span style={{ letterSpacing: 0.3 }}>{t(NAV_KEY[v])}</span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}
