import React, { useEffect, useState } from 'react';
import LeftRail, { ConsoleView } from './LeftRail';
import HomeDashboard from './HomeDashboard';
import AIPanel from './AIPanel';
import CommandPalette from './CommandPalette';
import CallsView from './CallsView';
import MessagesView from './MessagesView';
import VoicemailView from './VoicemailView';
import RecordingsView from './RecordingsView';
import ContactsView from './ContactsView';
import AIWorkspace from './AIWorkspace';
import AdminView from './AdminView';
import TelecomSettingsView from './TelecomSettingsView';
import OrgChatView from './OrgChatView';
import AdminAIChatView from './AdminAIChatView';
import ReportsView from './ReportsView';
import SoftphonePane from '../SoftphonePane';
import SettingsPage from '../SettingsPage';
import IncomingCallToast from './IncomingCallToast';
import ActiveCallDock from './ActiveCallDock';
import { useCallShortcuts } from '../../hooks/useShortcuts';
import { callBus } from '../../hooks/useCallBus';
import { theme } from '../../lib/theme';

const { colors: c } = theme;

interface Creds {
  extension: string;
  email: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

function Placeholder({ title, hint }: { title: string; hint: string }) {
  return (
    <div style={{
      padding: 48, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', height: '100%',
      color: c.mutedSilver, textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, color: c.signalGold, textTransform: 'uppercase' }}>
        Coming in Phase 2
      </div>
      <h2 style={{ fontSize: 22, color: c.textIce, margin: '10px 0 6px' }}>{title}</h2>
      <p style={{ fontSize: 13, maxWidth: 420, margin: 0 }}>{hint}</p>
    </div>
  );
}

export default function ConsoleLayout({
  creds, onOpenSettings,
}: { creds: Creds; onOpenSettings: () => void }) {
  const [view, setView] = useState<ConsoleView>('home');
  const [aiOpen, setAiOpen] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);

  useCallShortcuts();

  useEffect(() => {
    const onResize = () => setCompact(window.innerWidth < 640);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    const onNav = (e: Event) => {
      const v = (e as CustomEvent).detail as ConsoleView;
      if (v) setView(v);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('lemtel:nav', onNav as EventListener);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('lemtel:nav', onNav as EventListener);
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        callBus.simulateIncoming('+1 514 555 0123', 'Marie Tremblay');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div style={{
      display: 'flex', height: '100%',
      background: c.bgGradient,
      color: c.textIce, position: 'relative', overflow: 'hidden',
    }}>
      {!compact && (
        <LeftRail
          view={view}
          onChange={setView}
          onOpenSettings={() => setView('settings')}
          onOpenSearch={() => setPaletteOpen(true)}
        />
      )}

      <main style={{
        flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative',
        paddingBottom: compact ? 78 : 0, display: 'flex', flexDirection: 'column',
      }}>
        <div key={view} className="lemtel-page-enter" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {view === 'home' && <HomeDashboard displayName={creds.displayName || creds.email} extension={creds.extension} onQuickDial={() => setView('dialer')} />}
          {view === 'dialer' && (
            <div style={{ maxWidth: 460, margin: '0 auto', height: '100%' }}>
              <SoftphonePane creds={creds} onOpenSettings={() => setView('settings')} hideTabs />
            </div>
          )}
          {view === 'calls' && <CallsView />}
          {view === 'messages' && <MessagesView />}
          {view === 'voicemail' && <VoicemailView />}
          {view === 'recordings' && <RecordingsView />}
          {view === 'ai' && <AIWorkspace />}
          {view === 'contacts' && <ContactsView />}
          {view === 'admin' && <AdminView />}
          {view === 'telecom' && <TelecomSettingsView />}
          {view === 'orgchat' && <OrgChatView />}
          {view === 'aiadmin' && <AdminAIChatView />}
          {view === 'reports' && <ReportsView />}
          {view === 'settings' && (
            <SettingsPage
              creds={creds}
              onSignOut={async () => {
                await window.electronAPI?.clearCredentials?.();
                window.location.reload();
              }}
              onBack={() => setView('home')}
            />
          )}
        </div>
      </main>

      {!compact && <AIPanel open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />}

      {compact && (
        <LeftRail
          compact
          view={view}
          onChange={setView}
          onOpenSettings={() => setView('settings')}
          onOpenSearch={() => setPaletteOpen(true)}
        />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setView} />

      <IncomingCallToast />
      <ActiveCallDock />
    </div>
  );
}
