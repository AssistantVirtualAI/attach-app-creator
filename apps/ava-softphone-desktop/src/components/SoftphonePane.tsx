import React, { useEffect, useRef, useState } from 'react';
import { useSoftphone, ManualStatus } from '@/hooks/useSoftphone';
import RecentsList from './RecentsList';
import ContactsList from './ContactsList';
import VoicemailList from './VoicemailList';
import SmsThreads from './SmsThreads';
import CallForwarding from './CallForwarding';
import LemtelLogo from './LemtelLogo';
import RecordingsList from './RecordingsList';
import AIInsights from './AIInsights';
import { theme } from '../lib/theme';
import {
  PhoneIcon, ClockIcon, UsersIcon, VoicemailIcon,
  MessageIcon, DiscIcon, SparkleIcon,
} from './TabIcons';

interface Creds {
  extension: string;
  email: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

type Tab = 'dial' | 'recents' | 'contacts' | 'voicemail' | 'sms' | 'recordings' | 'ai';

const TAB_META: Record<Tab, { Icon: React.FC<{ size?: number; color?: string }>; label: string }> = {
  dial:       { Icon: PhoneIcon,     label: 'Phone' },
  recents:    { Icon: ClockIcon,     label: 'History' },
  contacts:   { Icon: UsersIcon,     label: 'Contacts' },
  voicemail:  { Icon: VoicemailIcon, label: 'Voicemail' },
  sms:        { Icon: MessageIcon,   label: 'SMS' },
  recordings: { Icon: DiscIcon,      label: 'Recordings' },
  ai:         { Icon: SparkleIcon,   label: 'AI' },
};

const { colors: c, glow } = theme;


export default function SoftphonePane({
  creds,
  onOpenSettings,
}: {
  creds: Creds;
  onOpenSettings: () => void;
}) {
  const sp = useSoftphone({
    extension: creds.extension,
    displayName: creds.displayName,
    sipDomain: creds.sipDomain,
    wssUrl: creds.wssUrl,
    accessToken: creds.accessToken,
    refreshToken: creds.refreshToken,
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [tab, setTab] = useState<Tab>('dial');
  const [dial, setDial] = useState('');
  const [timer, setTimer] = useState(0);
  const [showXfer, setShowXfer] = useState(false);
  const [xferTarget, setXferTarget] = useState('');
  const [xferMode, setXferMode] = useState<'blind' | 'attended'>('blind');
  const [showDTMF, setShowDTMF] = useState(false);

  useEffect(() => { sp.setAudioEl(audioRef.current); }, [sp]);

  // Broadcast SIP status to TitleBar
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('lemtel:sip-status', { detail: sp.snap.status }));
  }, [sp.snap.status]);

  useEffect(() => {
    if (sp.snap.callState !== 'active' && sp.snap.callState !== 'held') { setTimer(0); return; }
    if (!sp.snap.startedAt) return;
    const id = setInterval(() => {
      setTimer(Math.floor((Date.now() - (sp.snap.startedAt || Date.now())) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [sp.snap.callState, sp.snap.startedAt]);

  const dotColor =
    sp.snap.status === 'registered' ? c.green :
    sp.snap.status === 'error' ? c.red : c.yellow;

  const inCall = sp.snap.callState === 'active' || sp.snap.callState === 'held';
  const ringing = sp.snap.callState === 'ringing-in' || sp.snap.callState === 'ringing-out';

  const fmt = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  const handleCall = () => {
    if (!dial || sp.snap.status !== 'registered') return;
    sp.call(dial);
  };

  const handleXferSubmit = () => {
    if (!xferTarget) return;
    if (xferMode === 'blind') sp.blindTransfer(xferTarget);
    else sp.startAttendedConsult(xferTarget);
    setShowXfer(false);
    setXferTarget('');
  };

  const dialKeys: [string, string][] = [
    ['1', ''], ['2', 'ABC'], ['3', 'DEF'],
    ['4', 'GHI'], ['5', 'JKL'], ['6', 'MNO'],
    ['7', 'PQRS'], ['8', 'TUV'], ['9', 'WXYZ'],
    ['*', ''], ['0', '+'], ['#', ''],
  ];

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: c.bg, color: c.text, position: 'relative', overflow: 'hidden',
    }}>
      {/* Ambient background glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: c.bgGradient,
        pointerEvents: 'none', zIndex: 0,
      }} />

      <audio ref={audioRef} autoPlay />

      {/* HEADER */}
      <div style={{
        position: 'relative', zIndex: 1,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', height: 52, boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: `1px solid ${c.border}`,
        backdropFilter: 'blur(12px)',
      }}>
        {/* Extension badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: c.goldDim, border: `1px solid ${c.borderGold}`,
          color: c.gold, fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
          boxShadow: glow.gold,
        }}>
          Ext {creds.extension}
        </div>

        <div style={{ fontSize: 12, fontWeight: 500, color: c.text, opacity: 0.85 }}>
          {creds.displayName || creds.email}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: dotColor, color: dotColor,
            animation: sp.snap.status === 'registered' ? 'statusPulse 2s ease-in-out infinite' : 'none',
          }} />
          <select
            value={sp.manualStatus}
            onChange={(e) => sp.setManualStatus(e.target.value as ManualStatus)}
            style={{
              background: 'rgba(255,255,255,0.05)', color: c.text,
              border: `1px solid ${c.border}`, borderRadius: 8,
              fontSize: 10, padding: '4px 6px', cursor: 'pointer',
            }}
          >
            <option value="auto">Auto</option>
            <option value="available">Available</option>
            <option value="dnd">DND</option>
            <option value="away">Away</option>
          </select>
          <button
            onClick={onOpenSettings}
            style={{
              background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
              color: c.text, cursor: 'pointer',
              width: 30, height: 28, borderRadius: 8, fontSize: 14,
            }}
            aria-label="Settings"
          >⚙</button>
        </div>
      </div>

      {sp.credError && (
        <div style={{
          position: 'relative', zIndex: 1,
          margin: '14px 16px 0',
          padding: '14px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(255,215,0,0.04))',
          border: '1px solid rgba(239,68,68,0.25)',
          boxShadow: '0 8px 24px -12px rgba(239,68,68,0.35)',
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'rgba(239,68,68,0.15)', color: c.red,
            fontSize: 16, fontWeight: 700,
          }}>!</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: c.red, fontSize: 12, fontWeight: 700, letterSpacing: 0.3, marginBottom: 2 }}>
              SIP not registered — calls disabled
            </div>
            <div style={{ color: c.text.secondary, fontSize: 11, lineHeight: 1.5 }}>
              {sp.credError}
            </div>
          </div>
        </div>
      )}

      {/* CONTENT */}
      <div className="lemtel-scroll" style={{
        flex: 1, overflowY: 'auto', position: 'relative', zIndex: 1,
        padding: ringing || inCall ? 0 : '20px 16px 12px',
      }}>
        {/* Incoming */}
        {sp.snap.callState === 'ringing-in' && (
          <IncomingCall
            who={sp.snap.remoteIdentity || sp.snap.remoteNumber || 'Unknown'}
            number={sp.snap.remoteNumber}
            onAnswer={sp.answer}
            onDecline={sp.hangup}
          />
        )}

        {/* Outgoing */}
        {sp.snap.callState === 'ringing-out' && (
          <CallingState
            who={sp.snap.remoteNumber || dial}
            onHangup={sp.hangup}
          />
        )}

        {/* Active / Held */}
        {inCall && (
          <ActiveCall
            sp={sp}
            timer={fmt(timer)}
            showDTMF={showDTMF}
            toggleDTMF={() => setShowDTMF((v) => !v)}
            dialKeys={dialKeys}
            onTransfer={(m) => { setXferMode(m); setShowXfer(true); }}
          />
        )}

        {/* Idle — Dialer */}
        {!inCall && !ringing && tab === 'dial' && (
          <Dialer
            dial={dial} setDial={setDial}
            dialKeys={dialKeys}
            onCall={handleCall}
            canCall={!!dial && sp.snap.status === 'registered'}
            extension={creds.extension}
          />
        )}

        {!inCall && !ringing && tab === 'recents' && (
          <div style={{ animation: 'fadeIn .25s ease-out' }}>
            <RecentsList extension={creds.extension} onCall={(n) => { setDial(n); sp.call(n); }} />
          </div>
        )}
        {!inCall && !ringing && tab === 'contacts' && (
          <div style={{ animation: 'fadeIn .25s ease-out' }}>
            <ContactsList selfExtension={creds.extension} onCall={(n) => { setDial(n); sp.call(n); }} />
          </div>
        )}
        {!inCall && !ringing && tab === 'voicemail' && (
          <div style={{ animation: 'fadeIn .25s ease-out' }}>
            <VoicemailList extension={creds.extension} onCall={(n) => { setDial(n); sp.call(n); }} />
          </div>
        )}
        {!inCall && !ringing && tab === 'sms' && (
          <div style={{ animation: 'fadeIn .25s ease-out' }}>
            <SmsThreads />
          </div>
        )}
        {!inCall && !ringing && tab === 'recordings' && (
          <div style={{ animation: 'fadeIn .25s ease-out' }}>
            <RecordingsList />
          </div>
        )}
        {!inCall && !ringing && tab === 'ai' && (
          <div style={{ animation: 'fadeIn .25s ease-out' }}>
            <AIInsights />
          </div>
        )}
      </div>

      {/* BOTTOM TABS */}
      {!inCall && !ringing && (
        <div style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          display: 'flex', height: 68,
          background: 'linear-gradient(180deg, rgba(15,15,30,0.6) 0%, rgba(8,8,18,0.95) 100%)',
          borderTop: `1px solid ${c.border}`,
          backdropFilter: 'blur(14px)',
        }}>
          {(['dial', 'recents', 'contacts', 'voicemail', 'sms', 'recordings', 'ai'] as Tab[]).map((tk) => {
            const active = tab === tk;
            const { Icon, label } = TAB_META[tk];
            const isAI = tk === 'ai';
            const activeColor = isAI ? c.aiLight : c.gold;
            return (
              <button
                key={tk}
                onClick={() => setTab(tk)}
                style={{
                  flex: 1, background: 'none', border: 'none',
                  color: active ? activeColor : c.textSub,
                  cursor: 'pointer',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'color 180ms ease',
                  position: 'relative',
                  paddingTop: 4,
                }}
                onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = c.text; }}
                onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLButtonElement).style.color = c.textSub; }}
              >
                {active && <span className={`lemtel-tab-dot${isAI ? ' lemtel-tab-dot--ai' : ''}`} />}
                <Icon size={20} color={active ? activeColor : 'currentColor'} />
                <span style={{ fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: active ? 700 : 500 }}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      )}


      {/* Transfer modal */}
      {showXfer && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.65)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(8px)',
        }} onClick={() => setShowXfer(false)}>
          <div
            style={{
              background: 'rgba(15,15,30,0.95)', border: `1px solid ${c.borderGold}`,
              borderRadius: 16, padding: 20, width: 300,
              boxShadow: '0 25px 50px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: c.gold }}>
              {xferMode === 'blind' ? '↪ Blind transfer' : '↗ Attended transfer'}
            </div>
            <input
              autoFocus
              className="lemtel-input"
              value={xferTarget}
              onChange={(e) => setXferTarget(e.target.value)}
              placeholder="Extension or number"
              onKeyDown={(e) => e.key === 'Enter' && handleXferSubmit()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowXfer(false)} style={ghostBtn}>Cancel</button>
              <button onClick={handleXferSubmit} className="lemtel-btn-primary" style={{ ...ghostBtn, color: '#fff', border: 'none' }}>
                {xferMode === 'blind' ? 'Transfer' : 'Start consult'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div style={{
        position: 'relative', zIndex: 1, flexShrink: 0,
        padding: '14px 14px 16px',
        textAlign: 'center',
        borderTop: `1px solid ${c.border}`,
        background: c.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <LemtelLogo size="xs" glow />
        <div style={{ fontSize: 10, color: c.textDim, letterSpacing: 0.5 }}>
          v1.0.5 · Powered by{' '}
          <a
            onClick={(e) => { e.preventDefault(); window.electronAPI?.openExternal?.('https://assistantvirtualai.com'); }}
            href="#"
            style={{ color: c.gold, textDecoration: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            AVA Statistic · assistantvirtualai.com
          </a>
        </div>
      </div>
    </div>
  );
}


/* ============================================================
   Sub-components
   ============================================================ */

function Dialer({
  dial, setDial, dialKeys, onCall, canCall, extension,
}: {
  dial: string; setDial: (s: string | ((p: string) => string)) => void;
  dialKeys: [string, string][]; onCall: () => void; canCall: boolean; extension: string;
}) {
  return (
    <div style={{ animation: 'fadeIn .25s ease-out' }}>
      <CallForwarding extension={extension} />

      {/* Number display */}
      <div style={{
        textAlign: 'center', minHeight: 64, marginBottom: 18,
        fontFamily: 'JetBrains Mono, Menlo, monospace',
        fontSize: 32, letterSpacing: 4, fontWeight: 400,
        color: dial ? c.text : c.textDim,
        textShadow: dial ? '0 0 24px rgba(255,215,0,0.35)' : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {dial || '·  ·  ·  ·'}
      </div>

      {/* Dialpad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
        maxWidth: 272, margin: '0 auto 22px',
      }}>
        {dialKeys.map(([key, sub]) => (
          <button
            key={key}
            className="lemtel-key"
            onClick={() => setDial((p) => p + key)}
            style={{ height: 66, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1 }}
          >
            <span style={{ fontSize: 22, fontWeight: 500 }}>{key}</span>
            {sub && <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.32)', letterSpacing: 2 }}>{sub}</span>}
          </button>
        ))}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 28 }}>
        <button
          onClick={() => setDial('')}
          disabled={!dial}
          style={{
            background: 'none', border: 'none',
            color: dial ? c.textSub : 'transparent',
            fontSize: 11, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase',
            cursor: dial ? 'pointer' : 'default', padding: 8, width: 56,
          }}
          title="Clear"
        >Clear</button>

        <button
          onClick={onCall}
          disabled={!canCall}
          style={{
            width: 72, height: 72, borderRadius: '50%',
            background: canCall
              ? 'radial-gradient(circle at 30% 30%, #34D399 0%, #10B981 55%, #047857 100%)'
              : 'rgba(16,185,129,0.15)',
            border: canCall ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(16,185,129,0.2)',
            color: '#fff', fontSize: 28,
            cursor: canCall ? 'pointer' : 'not-allowed',
            boxShadow: canCall
              ? '0 8px 28px rgba(16,185,129,0.55), inset 0 1px 0 rgba(255,255,255,0.25)'
              : 'none',
            transition: 'transform .15s ease, box-shadow .15s ease',
            display: 'grid', placeItems: 'center',
          }}
          onMouseEnter={(e) => { if (canCall) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.07)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          aria-label="Call"
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.82.34 1.7.57 2.6.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>

        <button
          onClick={() => setDial((p) => p.slice(0, -1))}
          disabled={!dial}
          style={{
            background: 'none', border: 'none', color: dial ? c.textSub : 'transparent',
            fontSize: 20, cursor: dial ? 'pointer' : 'default', padding: 8, width: 56,
          }}
          aria-label="Backspace"
        >⌫</button>
      </div>
    </div>
  );
}

function CallingState({ who, onHangup }: { who: string; onHangup: () => void }) {
  return (
    <div style={callViewStyle}>
      <div style={{ position: 'relative', marginBottom: 22 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `2px solid ${c.gold}`,
            animation: `ripple 1.8s ${i * 0.6}s ease-out infinite`,
          }} />
        ))}
        <div style={{
          width: 110, height: 110, borderRadius: '50%',
          background: 'linear-gradient(135deg, #003DA6, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 42, color: '#fff', boxShadow: glow.blue,
          position: 'relative', zIndex: 1,
        }}>☏</div>
      </div>
      <div style={{ fontSize: 11, color: c.aiLight, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>Calling…</div>
      <div style={{ fontSize: 24, fontWeight: 600, marginBottom: 32, color: c.text }}>{who}</div>
      <button onClick={onHangup} style={hangupBtn}>📵</button>
    </div>
  );
}

function IncomingCall({ who, number, onAnswer, onDecline }: { who: string; number?: string; onAnswer: () => void; onDecline: () => void }) {
  return (
    <div style={{ ...callViewStyle, animation: 'slideDown .35s ease-out' }}>
      <div style={{ position: 'relative', marginBottom: 22 }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            position: 'absolute', inset: 0, borderRadius: '50%',
            border: `2px solid ${c.gold}`,
            animation: `ripple 1.6s ${i * 0.5}s ease-out infinite`,
          }} />
        ))}
        <div style={{
          width: 110, height: 110, borderRadius: '50%',
          background: 'linear-gradient(135deg, #003DA6, #7C3AED)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 44, color: '#fff', boxShadow: glow.ai,
          position: 'relative', zIndex: 1, fontWeight: 700,
        }}>{String(who).charAt(0).toUpperCase()}</div>
      </div>
      <div style={{ fontSize: 11, color: c.gold, letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 6 }}>Incoming Call</div>
      <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4, color: c.text }}>{who}</div>
      {number && number !== who && <div style={{ fontSize: 13, color: c.textSub, marginBottom: 32 }}>{number}</div>}
      <div style={{ display: 'flex', gap: 28, marginTop: 24 }}>
        <button onClick={onDecline} style={{
          ...hangupBtn, background: 'linear-gradient(135deg, #DC2626, #EF4444)', boxShadow: glow.red,
        }}>✕</button>
        <button onClick={onAnswer} style={{
          ...hangupBtn, background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: glow.green,
        }}>✓</button>
      </div>
    </div>
  );
}

function ActiveCall({
  sp, timer, showDTMF, toggleDTMF, dialKeys, onTransfer,
}: {
  sp: any; timer: string; showDTMF: boolean; toggleDTMF: () => void;
  dialKeys: [string, string][]; onTransfer: (m: 'blind' | 'attended') => void;
}) {
  const remote = sp.snap.remoteIdentity || sp.snap.remoteNumber || 'Unknown';

  return (
    <div style={{
      ...callViewStyle,
      background: 'linear-gradient(180deg, #050510 0%, #0a0015 100%)',
    }}>
      <div style={{
        width: 92, height: 92, borderRadius: '50%',
        background: 'linear-gradient(135deg, #003DA6, #7C3AED)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, fontWeight: 700, color: '#fff', boxShadow: glow.blue,
        marginBottom: 14,
      }}>
        {String(remote).charAt(0).toUpperCase()}
      </div>

      <div style={{ fontSize: 20, fontWeight: 600, marginBottom: 4, color: c.text }}>{remote}</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '3px 10px', borderRadius: 999,
        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)',
        color: c.green, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
        boxShadow: glow.green, marginBottom: 10,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.green }} />
        {sp.snap.onHold ? 'On Hold' : 'Active Call'}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: 22, fontWeight: 500,
        color: c.gold, letterSpacing: 2, marginBottom: 18,
      }}>{timer}</div>

      {/* Visualizer */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 32, marginBottom: 22 }}>
        {[0.6, 0.9, 0.4, 1, 0.7, 0.5, 0.85].map((h, i) => (
          <div key={i} style={{
            width: 4, height: `${h * 100}%`, borderRadius: 2,
            background: 'linear-gradient(180deg, #003DA6, #7C3AED)',
            animation: `wave ${0.7 + i * 0.1}s ease-in-out infinite`,
            transformOrigin: 'bottom',
          }} />
        ))}
      </div>

      {showDTMF && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
          marginBottom: 14, width: '100%', maxWidth: 240,
        }}>
          {dialKeys.map(([k]) => (
            <button key={k} className="lemtel-key" onClick={() => sp.sendDTMF(k)} style={{ padding: '10px 0', fontSize: 16 }}>{k}</button>
          ))}
        </div>
      )}

      {/* Controls grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
        width: '100%', maxWidth: 280, marginBottom: 12,
      }}>
        <ControlBtn icon="🎤" label={sp.snap.muted ? 'Unmute' : 'Mute'} active={sp.snap.muted} danger onClick={sp.snap.muted ? sp.unmute : sp.mute} />
        <ControlBtn icon="⏸" label={sp.snap.onHold ? 'Resume' : 'Hold'} active={sp.snap.onHold} warning onClick={sp.snap.onHold ? sp.unhold : sp.hold} />
        <ControlBtn icon="#" label="Keypad" active={showDTMF} onClick={toggleDTMF} />
        <ControlBtn icon="⏺" label={sp.recording ? 'Stop' : 'Record'} active={sp.recording} onClick={sp.toggleRecording} />
        <ControlBtn icon="↪" label="Blind Xfer" onClick={() => onTransfer('blind')} />
        <ControlBtn icon="↗" label="Attended" onClick={() => onTransfer('attended')} disabled={sp.hasConsult()} active={sp.hasConsult()} />
      </div>

      {sp.hasConsult() ? (
        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={sp.completeAttendedTransfer} className="lemtel-btn-primary" style={{
            height: 44, borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>✓ Complete Transfer</button>
          <button onClick={sp.cancelAttendedConsult} style={endCallBtn}>✕ Cancel Consult</button>
        </div>
      ) : (
        <button onClick={sp.hangup} style={endCallBtn}>📵 End Call</button>
      )}
    </div>
  );
}

function ControlBtn({
  icon, label, onClick, active, danger, warning, disabled,
}: {
  icon: string; label: string; onClick: () => void;
  active?: boolean; danger?: boolean; warning?: boolean; disabled?: boolean;
}) {
  const bg = active
    ? danger ? 'rgba(239,68,68,0.18)' : warning ? 'rgba(245,158,11,0.18)' : 'rgba(255,215,0,0.15)'
    : 'rgba(255,255,255,0.05)';
  const bd = active
    ? danger ? 'rgba(239,68,68,0.5)' : warning ? 'rgba(245,158,11,0.5)' : c.borderGold
    : c.border;
  const col = active
    ? danger ? c.red : warning ? c.yellow : c.gold
    : c.text;
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 44, borderRadius: 12,
        background: bg, border: `1px solid ${bd}`, color: col,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.4 : 1,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        fontSize: 11, fontWeight: 600, letterSpacing: 0.3,
        transition: 'all .15s ease',
        boxShadow: active ? `0 0 12px ${col}33` : 'none',
      }}
    >
      <span style={{ fontSize: 14 }}>{icon}</span>
      {label}
    </button>
  );
}

/* ===== shared styles ===== */

const callViewStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', minHeight: 'calc(100vh - 130px)',
  padding: '28px 20px', textAlign: 'center',
  animation: 'fadeIn .3s ease-out',
};

const hangupBtn: React.CSSProperties = {
  width: 64, height: 64, borderRadius: '50%',
  background: 'linear-gradient(135deg, #DC2626, #EF4444)',
  border: 'none', color: '#fff', fontSize: 22, cursor: 'pointer',
  boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
};

const endCallBtn: React.CSSProperties = {
  width: '100%', maxWidth: 280, height: 52, borderRadius: 14,
  background: 'linear-gradient(135deg, #DC2626, #EF4444)',
  border: 'none', color: '#fff', fontSize: 14, fontWeight: 700, letterSpacing: 0.5,
  cursor: 'pointer', boxShadow: '0 4px 20px rgba(239,68,68,0.5)',
  marginTop: 4,
};

const ghostBtn: React.CSSProperties = {
  flex: 1, height: 40, borderRadius: 10,
  background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
  color: c.text, fontSize: 13, fontWeight: 600, cursor: 'pointer',
};
