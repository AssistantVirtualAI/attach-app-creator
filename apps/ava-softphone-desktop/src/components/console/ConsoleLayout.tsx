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
import CustomersView from './CustomersView';
import VoiceAgentsView from './VoiceAgentsView';
import PBXLiveView from './PBXLiveView';
import AuditView from './AuditView';
import SoftphonePane from '../SoftphonePane';
import SettingsPage from '../SettingsPage';
import { AppErrorBoundary } from '../AppErrorBoundary';
import IncomingCallToast from './IncomingCallToast';
import ActiveCallDock from './ActiveCallDock';
import DesktopTour from './DesktopTour';
import { useCallShortcuts } from '../../hooks/useShortcuts';
import { callBus } from '../../hooks/useCallBus';
import { useDesktopRole } from '../../hooks/useDesktopRole';
import { useTenant } from '../../hooks/useTenant';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { theme } from '../../lib/theme';
import { ava, setAuthToken } from '../../lib/avaApi';
import { supabase } from '../../lib/supabaseClient';

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
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const [compact, setCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640);
  const [tourOpen, setTourOpen] = useState(false);
  const { isAdmin, isSuperAdmin } = useDesktopRole();
  const { orgId, orgName } = useTenant();
  useRealtimeSync(orgId);

  // Redirect non-admins away from admin-only views
  useEffect(() => {
    const adminOnly: ConsoleView[] = ['admin', 'aiadmin', 'reports', 'customers', 'voiceagents', 'pbxlive'];
    if (!isAdmin && adminOnly.includes(view)) setView('home');
  }, [isAdmin, view]);

  useCallShortcuts();

  const runFullSync = async () => {
    setSyncing(true); setSyncNote(null);
    try {
      const res = await ava.syncPhoneSystemFull();
      const stats = res?.stats || {};
      const count = Object.entries(stats).filter(([k]) => k !== 'duration_ms').map(([k, v]) => `${k}:${v}`).join(' · ');
      setSyncNote(res.ok ? `Synced ${count || 'phone system'} · ${new Date(res.syncedAt).toLocaleTimeString()}` : (res.errors?.[0] || 'Phone-system sync failed'));
      window.dispatchEvent(new Event('lemtel:phone-sync-complete'));
      (window as any).__lemtelRefreshCalls?.();
    } finally {
      setSyncing(false);
    }
  };

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
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setAiOpen((v) => !v);
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
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          onStartTour={() => setTourOpen(true)}
        />
      )}

      <main style={{
        flex: 1, minWidth: 0, minHeight: 0, overflow: 'hidden', position: 'relative',
        paddingBottom: compact ? 78 : 0, paddingTop: compact ? 54 : 0, display: 'flex', flexDirection: 'column',
      }}>
        {compact && (
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, zIndex: 8,
            height: 54, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            padding: '8px 10px', boxSizing: 'border-box',
            background: `linear-gradient(180deg, ${c.deepPanel}f6, ${c.midnight}e8)`,
            borderBottom: `1px solid ${c.border}`,
            backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
            WebkitAppRegion: 'drag' as any,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.1 }}>
              <span style={{ fontSize: 11, color: c.signalGold, fontWeight: 900, letterSpacing: 1.4, textTransform: 'uppercase' }}>AVA Statistic</span>
              <span style={{ fontSize: 10, color: c.mutedSilver, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 210 }}>
                Ext {creds.extension} · {syncNote || orgName || 'Phone system live data'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' as any }}>
              <button onClick={() => setPaletteOpen(true)} style={{ width: 34, height: 32, borderRadius: 10, border: `1px solid ${c.border}`, background: 'rgba(255,255,255,0.04)', color: c.textIce, cursor: 'pointer' }} aria-label="Search">⌘K</button>
              <button onClick={runFullSync} disabled={syncing} style={{ height: 32, padding: '0 10px', borderRadius: 10, border: `1px solid ${c.borderGold}`, background: syncing ? 'rgba(255,230,0,0.08)' : 'rgba(255,230,0,0.14)', color: c.signalGold, fontSize: 10, fontWeight: 900, letterSpacing: 0.8, cursor: syncing ? 'wait' : 'pointer' }}>
                {syncing ? 'SYNC…' : 'SYNC'}
              </button>
            </div>
          </div>
        )}
        {!compact && (
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            {syncNote && <span style={{ maxWidth: 360, color: c.mutedSilver, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{syncNote}</span>}
            <button onClick={runFullSync} disabled={syncing} style={{ padding: '7px 11px', borderRadius: 8, background: syncing ? 'rgba(255,230,0,0.08)' : 'rgba(255,230,0,0.14)', border: `1px solid ${c.borderGold}`, color: c.signalGold, fontSize: 10, fontWeight: 800, letterSpacing: 1, cursor: syncing ? 'wait' : 'pointer' }}>
              {syncing ? 'SYNCING…' : 'SYNC PHONE SYSTEM'}
            </button>
          </div>
        )}
        <AppErrorBoundary key={view} compact onBack={() => setView('dialer')}>
        <div className="lemtel-page-enter" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
          {view === 'customers' && <CustomersView />}
          {view === 'voiceagents' && <VoiceAgentsView />}
          {view === 'pbxlive' && <PBXLiveView />}
          {view === 'settings' && (
            <SettingsPage
              creds={creds}
              onSignOut={async () => {
                try { setAuthToken(null); } catch { /* noop */ }
                try { await supabase.auth.signOut(); } catch { /* noop */ }
                try {
                  window.localStorage.removeItem('lemtel-desktop-auth');
                  window.sessionStorage.removeItem('lemtel-desktop-auth');
                } catch { /* noop */ }
                await window.electronAPI?.clearCredentials?.();
                window.location.reload();
              }}
              onBack={() => setView('home')}
            />
          )}
        </div>
        </AppErrorBoundary>
      </main>

      {!compact && <AIPanel open={aiOpen} onToggle={() => setAiOpen((v) => !v)} />}

      {compact && (
        <LeftRail
          compact
          view={view}
          onChange={setView}
          onOpenSettings={() => setView('settings')}
          onOpenSearch={() => setPaletteOpen(true)}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
          onStartTour={() => setTourOpen(true)}
        />
      )}

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onNavigate={setView} />

      <IncomingCallToast />
      <ActiveCallDock />
      <DesktopTour
        isAdmin={isAdmin}
        isSuperAdmin={isSuperAdmin}
        forceOpen={tourOpen}
        onClose={() => setTourOpen(false)}
      />
    </div>
  );
}
