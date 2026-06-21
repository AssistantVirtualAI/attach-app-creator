import { useEffect, useMemo, useRef, useState, Suspense, lazy } from 'react';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';
// Re-use battle-tested SIP hook from the desktop app
import { useSoftphone } from './hooks/useSoftphone';
import AuthScreen from './screens/AuthScreen';
import DashboardScreen from './screens/DashboardScreen';
import CallsScreen from './screens/CallsScreen';
// Lazy-loaded screens: only fetched when the user navigates to the tab.
// Keeps the initial bundle small for fast mobile boot.
const AVAChatScreen      = lazy(() => import('./screens/AVAChatScreen'));
const MoreScreen         = lazy(() => import('./screens/MoreScreen'));
const VoicemailScreen    = lazy(() => import('./screens/VoicemailScreen'));
const ContactsScreen     = lazy(() => import('./screens/ContactsScreen'));
const MessagesScreen     = lazy(() => import('./screens/MessagesScreen'));
const MessagesHubScreen  = lazy(() => import('./screens/MessagesHubScreen'));
const QueuesScreen       = lazy(() => import('./screens/QueuesScreen'));
const SettingsScreen     = lazy(() => import('./screens/SettingsScreen'));
const DialerScreen       = lazy(() => import('./screens/DialerScreen'));
const SpeedDialScreen    = lazy(() => import('./screens/SpeedDialScreen'));
import BottomTabs, { Tab } from './components/BottomTabs';
import NotificationsSheet from './components/NotificationsSheet';
import { useTheme } from './lib/ThemeContext';
import { useT } from './lib/i18n';
import { Bell, Sun, Moon, Globe } from 'lucide-react';
import ActiveCallSheet from './components/ActiveCallSheet';
import SplashAva from './components/SplashAva';
import PermissionGate from './components/PermissionGate';
import DialerFab from './components/DialerFab';
import SyncIndicator from './components/SyncIndicator';
import ProfileSheet from './components/ProfileSheet';
import { useRealtimeCDR } from './hooks/useRealtimeCDR';
import { initBackgroundSync } from './lib/backgroundSync';
import { useNotificationCounts } from './hooks/useNotificationCounts';
import { useStoredCreds, Creds, ensureStoredOrganizationId, hydrateSoftphoneCredentials } from './lib/creds';
import { gradients, colors } from './lib/theme';
import { ThemeProvider } from './lib/ThemeContext';
import { MobileI18nProvider } from './lib/i18n';
import { requestAllPermissions, checkAllPermissions } from './lib/permissions';
import { registerPush, sendPushTokenToBackend } from './lib/pushNotifications';
import { syncDeviceContacts } from './lib/contacts';
import { bootNative, onAppStateChange } from './lib/nativeBoot';
import { registerDeepLinkHandler } from './lib/deepLink';
import { configureMobileApi, setAuthToken } from './lib/mobileApi';


// Initialize immediately so API calls never go out without credentials
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';
configureMobileApi({
  portalUrl: 'https://gejxisrqtvxavbrfcoxz.supabase.co',
  anonKey: SUPABASE_ANON_KEY,
  accessToken: null,
});
import { configureAudit, audit } from './lib/audit';
import { edgeCall, supabase } from './lib/mobileSupabase';
import PerfOverlay from './components/PerfOverlay';
import ScreenSkeleton from './components/ScreenSkeleton';
import SessionExpired from './components/SessionExpired';
import { startPrefetch, prefetchForTab } from './lib/prefetch';

const isPreviewMode = (() => {
  try { return new URLSearchParams(window.location.search).get('preview') === '1'; }
  catch { return false; }
})();

export default function MobileApp() {
  const { creds, setCreds, clearCreds, loading } = useStoredCreds();

  // Restore Supabase session on app launch so API calls are authenticated
  useEffect(() => {
    const token = creds?.accessToken;
    const refresh = creds?.refreshToken;
    if (!token || !refresh) return;
    supabase.auth.setSession({
      access_token: token,
      refresh_token: refresh,
    }).then(({ data, error }) => {
      if (error) {
        console.warn('[Auth] Session restore failed:', error.message);
        supabase.auth.refreshSession().then(({ data: r }) => {
          if (r?.session) {
            setCreds((prev: any) => ({ ...prev, accessToken: r.session!.access_token, refreshToken: r.session!.refresh_token }));
            setAuthToken(r.session!.access_token);
            configureMobileApi({ accessToken: r.session!.access_token });
          }
        });
      } else if (data?.session) {
        setAuthToken(data.session.access_token);
        configureMobileApi({ accessToken: data.session.access_token });
        console.log('[Auth] Session restored ✅');
      }
    });
  }, [creds?.accessToken, creds?.refreshToken]);
  const ALL_TABS: Tab[] = ['home','calls','ava','messages','more','voicemail','contacts','sms','queues','settings','chats','keypad','speeddial'];
  const initialTab = (() => {
    try {
      const t = new URLSearchParams(window.location.search).get('tab') as Tab | null;
      if (t && ALL_TABS.includes(t)) return t;
    } catch {}
    return 'keypad' as Tab;
  })();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [booting, setBooting] = useState(!isPreviewMode);
  const preferC2C = false;

  useEffect(() => {
    let cancelled = false;
    bootNative().finally(() => {
      setTimeout(() => setBooting(false), 700);
    });
    initBackgroundSync().catch(() => {});
    // Préchargement opportuniste des écrans les plus consultés.
    try { startPrefetch(); } catch {}
    let unsubDeepLink: (() => void) | undefined;
    registerDeepLinkHandler().then((u) => { unsubDeepLink = u; }).catch(() => {});

    // Accept navigation commands from /mobile-preview host.
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== 'ava-preview') return;
      if (d.type === 'set-tab' && typeof d.tab === 'string') setTab(d.tab as Tab);
    };
    window.addEventListener('message', onMsg);
    return () => {
      cancelled = true;
      window.removeEventListener('message', onMsg);
      unsubDeepLink?.();
    };
  }, []);


  if (loading || booting) return <SplashAva />;
  if (!creds) return <MobileI18nProvider><ThemeProvider><AuthScreen onAuthenticated={setCreds} /><PerfOverlay /></ThemeProvider></MobileI18nProvider>;

  return <MobileI18nProvider><ThemeProvider><AuthenticatedShell creds={creds} setCreds={setCreds} tab={tab} setTab={setTab} onSignOut={clearCreds} preferClickToCall={preferC2C} onTogglePreferC2C={() => {}} /><PerfOverlay /></ThemeProvider></MobileI18nProvider>;
}

function AuthenticatedShell({
  creds, setCreds, tab, setTab, onSignOut, preferClickToCall, onTogglePreferC2C,
}: { creds: Creds; setCreds: (c: Creds) => void; tab: Tab; setTab: (t: Tab) => void; onSignOut: () => void; preferClickToCall: boolean; onTogglePreferC2C: () => void }) {

  const [permsGateDone, setPermsGateDone] = useState<boolean | null>(isPreviewMode ? true : null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [freshCredentialToken, setFreshCredentialToken] = useState('');
  const [authExpired, setAuthExpired] = useState(false);
  const passwordHealRef = useRef('');
  const hydratedTokenRef = useRef('');

  // Restore Supabase session from stored creds so the mobile SDK can
  // auto-refresh tokens (and so realtime/edge calls always have a fresh JWT).
  useEffect(() => {
    if (!creds.accessToken || !creds.refreshToken) return;
    supabase.auth.setSession({
      access_token: creds.accessToken,
      refresh_token: creds.refreshToken,
    }).then(({ error }) => {
      if (error) console.warn('[Auth] Session restore failed:', error.message);
      else console.log('[Auth] Session restored');
    }).catch((e) => console.warn('[Auth] setSession threw', e?.message || e));
  }, [creds.accessToken, creds.refreshToken]);

  // Keep stored creds in sync with token refreshes; sign-out clears the app.
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' && session) {
        setCreds({ ...creds, accessToken: session.access_token, refreshToken: session.refresh_token });
        setAuthExpired(false);
      } else if (event === 'SIGNED_OUT') {
        onSignOut();
      }
    });
    return () => { sub?.subscription?.unsubscribe?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a clear "Session expired" screen when API calls return 401/403.
  useEffect(() => {
    const onAuthReq = () => setAuthExpired(true);
    window.addEventListener('mobile-auth-required', onAuthReq);
    return () => window.removeEventListener('mobile-auth-required', onAuthReq);
  }, []);

  // Decide whether to show the onboarding permission gate.
  useEffect(() => {
    if (isPreviewMode) return;
    let cancelled = false;
    (async () => {
      try {
        const seen = localStorage.getItem('lemtel-permissions-onboarded') === '1';
        const current = await checkAllPermissions();
        if (cancelled) return;
        if (seen || current.microphone === 'granted') setPermsGateDone(true);
        else setPermsGateDone(false);
      } catch {
        if (!cancelled) setPermsGateDone(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Build SIP config from the same backend credentials used by desktop/portal,
  // but keep the mobile transport pinned to CA-signed WSS endpoints.
  const sipPassword = creds.sipPassword;
  const WORKING_WSS = [
    'wss://node.lemtelcloud.net:7443',
    'wss://pbxnode.lemtel.tel:7443',
  ];
  const sipDomain = creds.sipDomain || 'lemtel.lemtel.tel';
  // credentialsReady: true once we have extension + password, regardless of token freshness
  // The freshCredentialToken check was blocking SIP from ever starting
  const credentialsReady = !!(creds.extension && sipPassword);

  const sipConfig = credentialsReady && creds.extension && sipPassword
    ? {
        extension: creds.extension,
        displayName: creds.displayName || creds.email || 'User',
        password: sipPassword,
        domain: sipDomain,
        wssUrl: WORKING_WSS[0],
        wssUrls: WORKING_WSS,
        authUsername: creds.authUsername || creds.extension,
      }
    : null;

  console.log('[SIP] sipConfig:', sipConfig
    ? `ext=${sipConfig.extension} domain=${sipConfig.domain} wss=${sipConfig.wssUrl}`
    : 'NULL - missing: ' + [
        !creds.extension && 'extension',
        !sipPassword && 'password',
      ].filter(Boolean).join(', '));
  const softphone = useSoftphone(sipConfig);

  useEffect(() => {
    if (!creds.accessToken || !creds.extension || !softphone.sipError) return;
    if (!/authentication failed|403|401|407|forbidden|unauthor/i.test(softphone.sipError)) return;
    const key = `${creds.userId || creds.email}:${creds.extension}:${softphone.sipError}`;
    if (passwordHealRef.current === key) return;
    passwordHealRef.current = key;
    edgeCall('softphone-sync-password', creds.accessToken, { force_local_to_pbx: false })
      .then(() => hydrateSoftphoneCredentials('mobile'))
      .then((next) => { if (next) setCreds(next); })
      .catch((e) => console.warn('[SIP] password auto-sync failed', e?.message || e));
  }, [creds.accessToken, creds.email, creds.extension, creds.userId, setCreds, softphone.sipError]);

  const sp = useMemo(() => {
    const richCallState = softphone.callState === 'ringing' ? 'ringing-out' : softphone.callState;
    return {
      snap: {
        status: softphone.sipStatus,
        error: softphone.sipError,
        callState: richCallState,
        startedAt: softphone.callState === 'active' ? Date.now() - softphone.callTimer * 1000 : null,
        remoteParty: softphone.activeCallNumber,
        remoteUri: softphone.activeCallNumber,
        muted: softphone.isMuted,
        recording: false,
        contacts: [],
        recents: [],
        quality: softphone.quality,
      },
      sipConfig,
      call: softphone.call,
      addCall: softphone.call,
      hangup: softphone.hangup,
      answer: softphone.answer,
      mute: softphone.mute,
      unmute: softphone.unmute,
      hold: softphone.hold,
      unhold: softphone.unhold,
      sendDtmf: softphone.sendDTMF,
      sendDTMF: softphone.sendDTMF,
      setStatus: softphone.setStatus,
      reconnect: softphone.reconnect,
      lastPersistedError: softphone.lastPersistedError,
      sipLog: softphone.sipLog,
      clearSipLog: softphone.clearSipLog,
      clearSipState: softphone.clearSipState,
      retryAttempt: softphone.retryAttempt,
      nextRetryAt: softphone.nextRetryAt,
      retryLimitReached: softphone.retryLimitReached,
      quality: softphone.quality,
      audioProfile: softphone.audioProfile,
      setAudioProfile: softphone.setAudioProfile,
      setAudioEl: (_el: HTMLAudioElement | null) => {},
      transfer: (_target?: string) => {},
      park: () => {},
      startRecord: () => {},
      stopRecord: () => {},
    };
  }, [softphone, sipConfig]);

  const notif = useNotificationCounts({
    accessToken: creds.accessToken,
    organizationId: creds.organizationId,
    userId: creds.userId,
  });




  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { sp.setAudioEl(audioRef.current); }, [sp]);

  // Configure the mobile API client with the Supabase Edge Functions host
  // (NOT the marketing portal URL — edge functions live on supabase.co).
  useEffect(() => {
    const SUPABASE_URL =
      (import.meta as any).env?.VITE_SUPABASE_URL ||
      'https://gejxisrqtvxavbrfcoxz.supabase.co';
    const SUPABASE_ANON =
      (import.meta as any).env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
      (import.meta as any).env?.VITE_SUPABASE_ANON_KEY ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';
    configureMobileApi({
      portalUrl: SUPABASE_URL,
      accessToken: creds.accessToken || null,
      anonKey: SUPABASE_ANON,
    });
    configureAudit(async () => creds.accessToken || null);
    if (creds.accessToken) audit('softphone.signed_in', creds.userId, { extension: creds.extension });
    // Desktop/portal always fetch fresh SIP credentials from the backend.
    // Do the same on mobile once per session so stale cached SIP passwords from
    // prior logins cannot keep causing PBX auth failures.
    if (creds.accessToken && hydratedTokenRef.current !== creds.accessToken) {
      hydratedTokenRef.current = creds.accessToken;
      hydrateSoftphoneCredentials('mobile').then((next) => {
        if (next) setCreds(next);
        else if (!creds.organizationId) ensureStoredOrganizationId().catch(() => {});
        setFreshCredentialToken(creds.accessToken || '');
      }).catch(() => { setFreshCredentialToken(creds.accessToken || ''); });
    }
  }, [creds]);



  // Once the permission gate is dismissed, finalize permissions + push.
  useEffect(() => {
    if (!permsGateDone) return;
    let cancelled = false;
    (async () => {
      const perms = await requestAllPermissions();
      if (cancelled) return;

      // Push notifications — register token with backend.
      registerPush({
        onToken: async (token, platform) => {
          await sendPushTokenToBackend({
            token, platform,
            portalUrl: (creds as any).portalUrl || 'https://avastatistic.ca',
            accessToken: creds.accessToken || '',
            extension: creds.extension,
          });
        },
        onAction: (p) => {
          // Deep-link: tap a push to open the right tab.
          const kind = p.data?.kind;
          if (kind === 'voicemail' || kind === 'missed' || kind === 'call') setTab('calls');
          else if (kind === 'ava') setTab('ava');
        },
      });

      // Contacts sync — for dialer autocomplete.
      if (perms.contacts === 'granted') {
        syncDeviceContacts().catch(() => {});
      }
    })();

    // Re-register SIP when app comes back to foreground.
    let unsub: () => void = () => {};
    onAppStateChange((active) => { if (active) sp.reconnect?.(); }).then((u) => { unsub = u; });

    return () => { cancelled = true; unsub(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creds.extension, permsGateDone]);


  const inCall =
    sp.snap.callState === 'active' ||
    sp.snap.callState === 'held' ||
    sp.snap.callState === 'ringing-in' ||
    sp.snap.callState === 'ringing-out';

  const haptic = async (style: ImpactStyle = ImpactStyle.Light) => {
    if (Capacitor.isNativePlatform()) {
      try { await Haptics.impact({ style }); } catch {}
    }
  };
  if (permsGateDone === null) return <SplashAva />;
  if (permsGateDone === false) {
    return (
      <PermissionGate onComplete={() => {
        try { localStorage.setItem('lemtel-permissions-onboarded', '1'); } catch {}
        setPermsGateDone(true);
      }} />
    );
  }
  if (authExpired) return <SessionExpired onSignOut={onSignOut} />;



  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: gradients.app,
      paddingTop: 'var(--safe-top)',
      paddingBottom: 'var(--safe-bottom)',
      color: colors.textIce,
      position: 'relative',
    }}>
      <audio ref={audioRef} autoPlay playsInline />

      {/* Top header — hamburger menu + title (Google-Voice style) */}
      <TopHeader
        tab={tab}
        onNavigate={(t) => { haptic(ImpactStyle.Light); setTab(t); }}
        haptic={haptic}
      />







      <div key={tab} className="lemtel-page-enter" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Suspense fallback={<ScreenSkeleton />}>
          {tab === 'contacts'   && <ContactsScreen sp={sp} />}
          {tab === 'chats'      && <MessagesHubScreen accessToken={creds.accessToken || null} userId={creds.userId} sp={sp} haptic={haptic} channelUnread={notif.channelUnread} />}
          {tab === 'calls'      && <CallsScreen sp={sp} haptic={haptic} creds={creds} />}
          {tab === 'keypad'     && <DialerScreen sp={sp} haptic={haptic} preferClickToCall={preferClickToCall} />}
          {tab === 'speeddial'  && <SpeedDialScreen sp={sp} preferClickToCall={preferClickToCall} />}
          {/* legacy deep-link routes */}
          {tab === 'home'       && <DashboardScreen onNavigate={setTab as any} haptic={haptic} onOpenProfile={() => setProfileOpen(true)} />}
          {tab === 'ava'        && <AVAChatScreen />}
          {tab === 'messages'   && <MessagesHubScreen accessToken={creds.accessToken || null} userId={creds.userId} sp={sp} haptic={haptic} channelUnread={notif.channelUnread} />}
          {tab === 'settings'   && <SettingsScreen creds={creds} sp={sp} onSignOut={onSignOut} onNavigate={setTab as any} preferClickToCall={preferClickToCall} togglePreferC2C={onTogglePreferC2C} />}
          {tab === 'more'       && <MoreScreen creds={creds} sp={sp} onSignOut={onSignOut} haptic={haptic} />}
          {tab === 'voicemail'  && <VoicemailScreen haptic={haptic} />}
          {tab === 'sms'        && <MessagesScreen haptic={haptic} />}
          {tab === 'queues'     && <QueuesScreen />}
        </Suspense>
      </div>


      <BottomTabs
        active={tab}
        onChange={(t) => {
          haptic(ImpactStyle.Light);
          if (t === 'calls') notif.markSeen('calls');
          if (t === 'voicemail') notif.markSeen('voicemail');
          try { prefetchForTab(t); } catch {}
          setTab(t);
        }}
        badges={{
          calls: notif.missedCalls + notif.voicemails,
          messages: notif.messages,
          voicemail: notif.voicemails,
        }}
      />

      {!inCall && <DialerFab sp={sp} haptic={haptic}  />}
      {inCall && <ActiveCallSheet sp={sp} haptic={haptic} />}

      {profileOpen && (
        <ProfileSheet
          creds={creds}
          onClose={() => setProfileOpen(false)}
          onSignOut={() => { setProfileOpen(false); onSignOut(); }}
          onCredsUpdate={setCreds}
        />
      )}
    </div>
  );
}

/* ─── Top header with hamburger dropdown ─────────────────────── */
function TopHeader({
  tab, onNavigate, haptic,
}: { tab: Tab; onNavigate: (t: Tab) => void; haptic: (s?: ImpactStyle) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const titles: Partial<Record<Tab, string>> = {
    contacts: 'Contacts',
    chats: 'Chats',
    calls: 'Calls',
    keypad: 'Keypad',
    speeddial: 'Speed dial',
    settings: 'Settings',
    home: 'Home',
  };
  const items: { id: Tab; label: string; icon: string }[] = [
    { id: 'home',     label: 'Accueil',  icon: '🏠' },
    { id: 'contacts', label: 'Contacts', icon: '👤' },
    { id: 'calls',    label: 'Calls',    icon: '📞' },
    { id: 'keypad',   label: 'Keypad',   icon: '⌨️' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];
  return (
    <header style={{
      position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '14px 16px 10px',
      minHeight: 56,
    }}>
      <button
        onClick={() => { haptic(ImpactStyle.Light); setOpen((v) => !v); }}
        aria-label="Open menu"
        style={{
          position: 'relative',
          width: 44, height: 44, borderRadius: 12,
          background: open ? 'rgba(255,255,255,0.10)' : 'transparent',
          border: 'none', display: 'grid', placeItems: 'center',
          cursor: 'pointer', color: colors.textIce,
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <line x1="4" y1="7"  x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="14" y2="17" />
        </svg>
        <span style={{
          position: 'absolute', right: 6, top: 6, width: 8, height: 8,
          borderRadius: '50%', background: colors.lemtelBlue,
        }} />
      </button>

      <span style={{
        flex: 1, marginLeft: 8,
        fontSize: 22, fontWeight: 500, color: 'rgba(255,255,255,0.85)',
        letterSpacing: 0.2,
      }}>
        {titles[tab] || ''}
      </span>

      <div style={{ width: 44 }} />

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'transparent' }}
          />
          <div
            role="menu"
            style={{
              position: 'absolute', top: 58, left: 12, zIndex: 71,
              minWidth: 220, padding: 6,
              borderRadius: 14,
              background: 'rgba(20,28,52,0.96)',
              border: '1px solid rgba(255,255,255,0.12)',
              boxShadow: '0 24px 60px -20px rgba(0,0,0,0.6)',
              backdropFilter: 'blur(20px)',
            }}
          >
            {items.map((it) => {
              const active = tab === it.id;
              return (
                <button
                  key={it.id}
                  onClick={() => { setOpen(false); onNavigate(it.id); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    width: '100%', padding: '10px 12px',
                    borderRadius: 10, border: 'none', cursor: 'pointer',
                    background: active ? 'rgba(0,120,255,0.18)' : 'transparent',
                    color: active ? '#7ab8ff' : colors.textIce,
                    fontSize: 15, fontWeight: active ? 700 : 500,
                    textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: 18, width: 22, textAlign: 'center' }}>{it.icon}</span>
                  <span>{it.label}</span>
                </button>
              );
            })}
          </div>
        </>
      )}
    </header>
  );
}


