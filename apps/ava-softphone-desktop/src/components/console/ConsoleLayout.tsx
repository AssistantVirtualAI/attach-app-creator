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

  useCallShortcuts();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Dev helper: trigger a simulated incoming call so the toast + dock can be
  // exercised before SIP is fully wired. Press ⌘⇧I.
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
      background: `linear-gradient(180deg, ${c.midnight}, ${c.deepPanel})`,
      color: c.textIce, position: 'relative', overflow: 'hidden',
    }}>
      <LeftRail
        view={view}
        onChange={setView}
        onOpenSettings={() => setView('settings')}
        onOpenSearch={() => setPaletteOpen(true)}
      />

      <main style={{ flex: 1, minWidth: 0, overflow: 'auto', position: 'relative' }}>
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
      </main>

      <AIPanel open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setView} />

      <IncomingCallToast />
      <ActiveCallDock />
    </div>
  );
}
