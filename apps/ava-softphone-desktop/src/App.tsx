import React, { useEffect, useState, useRef } from 'react';
import TitleBar from './components/TitleBar';
import SetupWizard from './components/SetupWizard';
import SettingsPage from './components/SettingsPage';
import UpdateBanner from './components/UpdateBanner';

type Creds = {
  portalUrl: string;
  email: string;
  extension: string;
  sipDomain?: string;
  wssUrl?: string;
  displayName?: string;
} | null;

export default function App() {
  const [creds, setCreds] = useState<Creds>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'phone' | 'settings'>('phone');

  useEffect(() => {
    window.electronAPI?.getCredentials().then((c: any) => {
      setCreds(c);
      setLoading(false);
    });
    window.electronAPI?.onSetStatus((s: any) => {
      window.dispatchEvent(new CustomEvent('ava:set-status', { detail: s }));
    });
  }, []);

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;

  if (!creds) {
    return (
      <>
        <TitleBar />
        <SetupWizard onComplete={(c: any) => setCreds(c)} />
      </>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TitleBar />
      <div style={{ flex: 1, overflow: 'auto' }}>
        {view === 'settings' ? (
          <SettingsPage
            creds={creds}
            onSignOut={async () => {
              await window.electronAPI.clearCredentials();
              setCreds(null);
            }}
            onBack={() => setView('phone')}
          />
        ) : (
          <SoftphonePane onOpenSettings={() => setView('settings')} creds={creds} />
        )}
      </div>
      <UpdateBanner />
    </div>
  );
}

function SoftphonePane({
  onOpenSettings,
  creds,
}: {
  onOpenSettings: () => void;
  creds: {
    extension: string;
    email: string;
    sipDomain?: string;
    wssUrl?: string;
    displayName?: string;
  };
}) {
  const [dialNumber, setDialNumber] = useState('');
  const [callState, setCallState] = useState<'idle' | 'ringing' | 'active' | 'ended'>('idle');
  const [callTimer, setCallTimer] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isOnHold, setIsOnHold] = useState(false);
  const [activeTab, setActiveTab] = useState<'dial' | 'recents' | 'contacts'>('dial');
  const [sipStatus, setSipStatus] = useState<'connecting' | 'registered' | 'error'>('connecting');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const uaRef = useRef<any>(null);
  const sessionRef = useRef<any>(null);

  useEffect(() => {
    const wss = creds.wssUrl || 'wss://lemtel.lemtel.tel:7443';
    const domain = creds.sipDomain || 'lemtel.lemtel.tel';

    if (typeof window !== 'undefined' && (window as any).JsSIP) {
      try {
        const JsSIP = (window as any).JsSIP;
        const socket = new JsSIP.WebSocketInterface(wss);
        const ua = new JsSIP.UA({
          sockets: [socket],
          uri: `sip:${creds.extension}@${domain}`,
          password: '',
          register: true,
          session_timers: false,
          register_expires: 300,
          user_agent: 'Lemtel Telecom 1.0',
        });

        ua.on('registered', () => setSipStatus('registered'));
        ua.on('registrationFailed', () => setSipStatus('error'));
        ua.on('disconnected', () => setSipStatus('connecting'));
        ua.on('newRTCSession', (data: any) => {
          const session = data.session;
          sessionRef.current = session;

          if (session.direction === 'incoming') {
            setCallState('ringing');
          }

          session.on('confirmed', () => {
            setCallState('active');
            timerRef.current = setInterval(() => {
              setCallTimer((t) => t + 1);
            }, 1000);
          });

          session.on('ended', () => {
            setCallState('ended');
            if (timerRef.current) clearInterval(timerRef.current);
            setTimeout(() => {
              setCallState('idle');
              setCallTimer(0);
              setIsMuted(false);
              setIsOnHold(false);
            }, 2000);
          });

          session.on('failed', () => {
            setCallState('idle');
            if (timerRef.current) clearInterval(timerRef.current);
          });
        });

        ua.start();
        uaRef.current = ua;
      } catch (e) {
        console.error('JsSIP init error:', e);
        setSipStatus('error');
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      uaRef.current?.stop();
    };
  }, []);

  const handleDial = (key: string) => setDialNumber((prev) => prev + key);

  const handleCall = () => {
    if (!dialNumber || !uaRef.current) return;
    const domain = creds.sipDomain || 'lemtel.lemtel.tel';
    const session = uaRef.current.call(`sip:${dialNumber}@${domain}`, {
      mediaConstraints: { audio: true, video: false },
    });
    sessionRef.current = session;
    setCallState('ringing');
  };

  const handleHangup = () => {
    sessionRef.current?.terminate();
    setCallState('idle');
    if (timerRef.current) clearInterval(timerRef.current);
    setCallTimer(0);
  };

  const handleMute = () => {
    if (sessionRef.current) {
      if (isMuted) sessionRef.current.unmute({ audio: true });
      else sessionRef.current.mute({ audio: true });
      setIsMuted(!isMuted);
    }
  };

  const handleHold = () => {
    if (sessionRef.current) {
      if (isOnHold) sessionRef.current.unhold();
      else sessionRef.current.hold();
      setIsOnHold(!isOnHold);
    }
  };

  const formatTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const dialKeys: [string, string][] = [
    ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ['*', ''], ['0', '+'], ['#', ''],
  ];

  const statusColor =
    sipStatus === 'registered' ? '#28ca41' :
    sipStatus === 'error' ? '#ff5f56' : '#ffbd2e';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a1a', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{creds.displayName || creds.email}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Ext. {creds.extension}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor }} />
          <span style={{ fontSize: 11, opacity: 0.7 }}>
            {sipStatus === 'registered' ? 'Registered' : sipStatus === 'error' ? 'Error' : 'Connecting...'}
          </span>
          <button onClick={onOpenSettings} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 }}>⚙️</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
        {(['dial', 'recents', 'contacts'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: 10,
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab ? '2px solid #FFD700' : '2px solid transparent',
              color: activeTab === tab ? '#FFD700' : 'rgba(255,255,255,0.5)',
              fontSize: 12,
              cursor: 'pointer',
              textTransform: 'capitalize',
              fontWeight: activeTab === tab ? 600 : 400,
            }}
          >
            {tab === 'dial' ? '📞 Dial' : tab === 'recents' ? '📋 Recents' : '👤 Contacts'}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {activeTab === 'dial' && (
          <div>
            {callState === 'active' && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 8 }}>{dialNumber}</div>
                <div style={{ fontSize: 28, fontFamily: 'monospace', color: '#28ca41', marginBottom: 8 }}>{formatTimer(callTimer)}</div>
                <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 20 }}>Active Call</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
                  <button onClick={handleMute} style={circleBtn(isMuted ? '#ffbd2e' : 'rgba(255,255,255,0.1)')}>
                    {isMuted ? '🔇' : '🎤'}
                  </button>
                  <button onClick={handleHold} style={circleBtn(isOnHold ? '#ffbd2e' : 'rgba(255,255,255,0.1)')}>⏸</button>
                  <button onClick={handleHangup} style={circleBtn('#ff5f56')}>📵</button>
                </div>
              </div>
            )}

            {callState === 'ringing' && (
              <div style={{ textAlign: 'center', padding: 24 }}>
                <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>Calling...</div>
                <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 20 }}>{dialNumber}</div>
                <button onClick={handleHangup} style={circleBtn('#ff5f56')}>📵</button>
              </div>
            )}

            {callState === 'idle' && (
              <>
                <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 500, minHeight: 36, marginBottom: 16, opacity: dialNumber ? 1 : 0.3 }}>
                  {dialNumber || 'Enter number'}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
                  {dialKeys.map(([key, sub]) => (
                    <button
                      key={key}
                      onClick={() => handleDial(key)}
                      style={{
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 10,
                        color: 'white',
                        padding: '14px 8px',
                        cursor: 'pointer',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 2,
                      }}
                    >
                      <span style={{ fontSize: 22, fontWeight: 500 }}>{key}</span>
                      <span style={{ fontSize: 9, opacity: 0.5 }}>{sub}</span>
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                  <button
                    onClick={() => setDialNumber((prev) => prev.slice(0, -1))}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: 8 }}
                  >
                    ⌫
                  </button>
                  <button onClick={handleCall} disabled={!dialNumber || sipStatus !== 'registered'} style={{ ...circleBtn('#28ca41'), opacity: !dialNumber || sipStatus !== 'registered' ? 0.4 : 1 }}>
                    📞
                  </button>
                  <div style={{ width: 36 }} />
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'recents' && (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
            <div style={{ fontSize: 13 }}>No recent calls</div>
          </div>
        )}

        {activeTab === 'contacts' && (
          <div style={{ textAlign: 'center', padding: 40, opacity: 0.5 }}>
            <div style={{ fontSize: 36, marginBottom: 8 }}>👤</div>
            <div style={{ fontSize: 13 }}>No contacts</div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 16px', borderTop: '1px solid rgba(255,255,255,0.08)', textAlign: 'center', fontSize: 10, opacity: 0.5 }}>
        Powered by AVA AI · assistantvirtualai.com
      </div>
    </div>
  );
}

const circleBtn = (bg: string): React.CSSProperties => ({
  width: 56,
  height: 56,
  borderRadius: '50%',
  background: bg,
  border: 'none',
  color: '#fff',
  fontSize: 22,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});
