import React, { useEffect, useRef, useState } from 'react';
import { useSoftphone, ManualStatus } from '@/hooks/useSoftphone';
import RecentsList from './RecentsList';
import ContactsList from './ContactsList';
import VoicemailList from './VoicemailList';
import SmsThreads from './SmsThreads';
import CallForwarding from './CallForwarding';
import LemtelLogo from './LemtelLogo';
import BrandTagline from './BrandTagline';
import RecordingsList from './RecordingsList';
import AIInsights from './AIInsights';
import { theme } from '../lib/theme';
import {
  PhoneIcon, ClockIcon, UsersIcon, VoicemailIcon,
  MessageIcon, DiscIcon, SparkleIcon,
} from './TabIcons';
import OutputDevicePicker from './OutputDevicePicker';
import { watchA11y } from '../lib/a11yAudit';

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
  hideTabs = false,
}: {
  creds: Creds;
  onOpenSettings: () => void;
  hideTabs?: boolean;
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  const prevCallStateRef = useRef(false);
  const [tab, setTab] = useState<Tab>('dial');
  const [dial, setDial] = useState('');
  const [timer, setTimer] = useState(0);
  const [showXfer, setShowXfer] = useState(false);
  const [xferTarget, setXferTarget] = useState('');
  const [xferMode, setXferMode] = useState<'blind' | 'attended'>('blind');
  const [showDTMF, setShowDTMF] = useState(false);
  const [paneWidth, setPaneWidth] = useState<number>(() =>
    typeof window !== 'undefined' ? window.innerWidth : 480
  );
  const [activeOutputLabel, setActiveOutputLabel] = useState('System default');
  const [autoResetOutput, setAutoResetOutput] = useState<boolean>(() => {
    try { return localStorage.getItem('lemtel.autoResetOutput') === 'true'; } catch { return false; }
  });

  useEffect(() => { sp.setAudioEl(audioRef.current); }, [sp]);

  // Track container width for responsive header/tabs/footer
  useEffect(() => {
    if (!rootRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w) setPaneWidth(w);
    });
    ro.observe(rootRef.current);
    return () => ro.disconnect();
  }, []);

  const compact = paneWidth < 440;
  const ultraCompact = paneWidth < 360;

  // Dev-only a11y audit on every DOM mutation inside the pane.
  useEffect(() => {
    if (!rootRef.current) return;
    return watchA11y(rootRef.current, 'SoftphonePane');
  }, []);

  // ---- In-call keyboard shortcuts ----------------------------------------
  // M = mute/unmute · H = hold/resume · K = toggle DTMF · T = blind transfer
  // Shift+T = attended transfer · E or Esc = end call · 0-9 * # = DTMF tone
  useEffect(() => {
    const inActiveCall = sp.snap.callState === 'active' || sp.snap.callState === 'held';
    if (!inActiveCall && sp.snap.callState !== 'ringing-in') return;

    const onKey = (e: KeyboardEvent) => {
      // Ignore when typing in inputs/selects/textareas/contenteditable.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Incoming ring → Enter answers, Esc declines (already wired globally,
      // but we keep a local fallback so the pane works in isolation).
      if (sp.snap.callState === 'ringing-in') {
        if (e.key === 'Enter') { e.preventDefault(); sp.answer(); }
        else if (e.key === 'Escape') { e.preventDefault(); sp.hangup(); }
        return;
      }

      const k = e.key;
      if (k === 'm' || k === 'M') {
        e.preventDefault();
        sp.snap.muted ? sp.unmute() : sp.mute();
      } else if (k === 'h' || k === 'H') {
        e.preventDefault();
        sp.snap.onHold ? sp.unhold() : sp.hold();
      } else if (k === 'k' || k === 'K') {
        e.preventDefault();
        setShowDTMF((v) => !v);
      } else if (k === 'e' || k === 'E' || k === 'Escape') {
        e.preventDefault();
        sp.hangup();
      } else if (k === 't') {
        e.preventDefault();
        setXferMode('blind'); setShowXfer(true);
      } else if (k === 'T') {
        e.preventDefault();
        setXferMode('attended'); setShowXfer(true);
      } else if (/^[0-9*#]$/.test(k)) {
        e.preventDefault();
        sp.sendDTMF(k);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sp.snap.callState, sp.snap.muted, sp.snap.onHold, sp]);


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

  // Reset audio output to default when call ends if auto-reset is enabled
  useEffect(() => {
    const isInCall = sp.snap.callState === 'active' || sp.snap.callState === 'held';
    if (prevCallStateRef.current && !isInCall && autoResetOutput) {
      const el = audioRef.current as HTMLAudioElement & { setSinkId?: (id: string) => Promise<void> } | null;
      if (el && typeof el.setSinkId === 'function') {
        el.setSinkId('default').catch(() => {});
      }
      setActiveOutputLabel('System default');
    }
    prevCallStateRef.current = isInCall;
  }, [sp.snap.callState, autoResetOutput]);

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

  // Global "dial now" shortcut (⌘/Ctrl + Enter) wires in from useShortcuts.
  useEffect(() => {
    const onDial = () => handleCall();
    window.addEventListener('lemtel:dial-now', onDial);
    return () => window.removeEventListener('lemtel:dial-now', onDial);
  }, [dial, sp.snap.status]);

  // Custom protocol (lemtel://call/<number>) from Chrome extension / OS
  useEffect(() => {
    const api = (window as unknown as { electronAPI?: { onProtocolCall?: (cb: (d: { number: string }) => void) => void } }).electronAPI;
    api?.onProtocolCall?.(({ number }) => {
      if (!number) return;
      setDial(number);
      setTimeout(() => {
        if (sp.snap.status === 'registered') sp.call(number);
      }, 1000);
    });
  }, []);

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
    <div ref={rootRef} style={{
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
        gap: compact ? 6 : 10,
        padding: compact ? '8px 10px' : '10px 14px',
        height: compact ? 46 : 52, boxSizing: 'border-box',
        background: 'rgba(0,0,0,0.3)',
        borderBottom: `1px solid ${c.border}`,
        backdropFilter: 'blur(12px)',
      }}>
        {/* Extension badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
          padding: compact ? '3px 8px' : '4px 10px', borderRadius: 999,
          background: c.goldDim, border: `1px solid ${c.borderGold}`,
          color: c.gold, fontSize: compact ? 10 : 11, fontWeight: 700, letterSpacing: 0.5,
          boxShadow: glow.gold,
        }}>
          Ext {creds.extension}
        </div>

        {!ultraCompact && (
          <div style={{
            fontSize: compact ? 11 : 12, fontWeight: 500, color: c.text, opacity: 0.85,
            flex: 1, minWidth: 0, textAlign: 'center',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {creds.displayName || creds.email}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: compact ? 5 : 8, flexShrink: 0 }}>
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
              fontSize: 10, padding: compact ? '3px 4px' : '4px 6px', cursor: 'pointer',
              maxWidth: compact ? 70 : 'none',
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
              width: compact ? 26 : 30, height: compact ? 24 : 28, borderRadius: 8, fontSize: 14,
            }}
            aria-label="Settings"
          >⚙</button>
        </div>
      </div>

      {sp.credError && (
        <div style={{
          position: 'relative', zIndex: 1,
          margin: compact ? '10px 12px 0' : '14px 16px 0',
          padding: compact ? '10px 12px' : '14px 16px',
          borderRadius: 14,
          background: 'linear-gradient(135deg, rgba(239,68,68,0.08), rgba(255,215,0,0.04))',
          border: '1px solid rgba(239,68,68,0.25)',
          boxShadow: '0 8px 24px -12px rgba(239,68,68,0.35)',
          display: 'flex', gap: compact ? 10 : 12, alignItems: 'flex-start',
        }}>
          <div style={{
            width: compact ? 26 : 32, height: compact ? 26 : 32, borderRadius: 10, flexShrink: 0,
            display: 'grid', placeItems: 'center',
            background: 'rgba(239,68,68,0.15)', color: c.red,
            fontSize: compact ? 14 : 16, fontWeight: 700,
          }}>!</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ color: c.red, fontSize: compact ? 11 : 12, fontWeight: 700, letterSpacing: 0.3, marginBottom: 2 }}>
              SIP not registered — calls disabled
            </div>
            <div style={{ color: c.textSub, fontSize: compact ? 10 : 11, lineHeight: 1.5 }}>
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
            compact={compact}
            audioEl={audioRef.current}
            activeOutputLabel={activeOutputLabel}
            autoResetOutput={autoResetOutput}
            onAutoResetChange={(v: boolean) => {
              setAutoResetOutput(v);
              try { localStorage.setItem('lemtel.autoResetOutput', String(v)); } catch {}
            }}
            onActiveOutputLabel={setActiveOutputLabel}
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
      {!inCall && !ringing && !hideTabs && (
        <div className={compact ? 'lemtel-tabbar-wrap' : undefined} style={{
          position: 'relative', zIndex: 1, flexShrink: 0,
          background: 'linear-gradient(180deg, rgba(15,15,30,0.6) 0%, rgba(8,8,18,0.95) 100%)',
          borderTop: `1px solid ${c.border}`,
          backdropFilter: 'blur(14px)',
        }}>
          <div className={compact ? 'lemtel-tabbar' : undefined} style={{
            display: 'flex',
            height: ultraCompact ? 56 : compact ? 62 : 68,
            ...(compact ? {} : { width: '100%' }),
          }}>
            {(['dial', 'recents', 'contacts', 'voicemail', 'sms', 'recordings', 'ai'] as Tab[]).map((tk) => {
              const active = tab === tk;
              const { Icon, label } = TAB_META[tk];
              const isAI = tk === 'ai';
              const activeColor = isAI ? c.aiLight : c.gold;
              // High-contrast inactive color so tabs are clearly readable on dark glass bar
              const inactiveColor = 'rgba(235,240,255,0.82)';
              const hoverColor = '#FFFFFF';
              return (
                <button
                  key={tk}
                  onClick={() => setTab(tk)}
                  title={label}
                  aria-label={label}
                  className={`lemtel-glass${isAI ? ' lemtel-glass--ai' : ''}`}
                  style={{
                    ...(compact
                      ? { flex: '0 0 auto', minWidth: 68, padding: '6px 10px' }
                      : { flex: 1, minWidth: 0, padding: '4px 4px 0' }),
                    background: active
                      ? (isAI
                          ? 'linear-gradient(180deg, rgba(157,111,240,0.18), rgba(157,111,240,0.04))'
                          : 'linear-gradient(180deg, rgba(255,215,0,0.18), rgba(255,215,0,0.04))')
                      : 'rgba(255,255,255,0.04)',
                    border: active
                      ? `1px solid ${isAI ? 'rgba(157,111,240,0.55)' : 'rgba(255,215,0,0.55)'}`
                      : '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 12,
                    margin: compact ? '6px 3px 6px' : '6px 3px',
                    color: active ? activeColor : inactiveColor,
                    textShadow: active
                      ? `0 0 10px ${isAI ? 'rgba(157,111,240,0.55)' : 'rgba(255,215,0,0.55)'}`
                      : '0 1px 2px rgba(0,0,0,0.5)',
                    cursor: 'pointer',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: compact ? 3 : 6,
                    transition: 'color 180ms ease, background 180ms ease, border-color 180ms ease, box-shadow 180ms ease',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    if (!active) {
                      el.style.color = hoverColor;
                      el.style.background = 'rgba(255,255,255,0.09)';
                      el.style.borderColor = 'rgba(255,215,0,0.35)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    const el = e.currentTarget as HTMLButtonElement;
                    if (!active) {
                      el.style.color = inactiveColor;
                      el.style.background = 'rgba(255,255,255,0.04)';
                      el.style.borderColor = 'rgba(255,255,255,0.08)';
                    }
                  }}
                >
                  {active && <span className={`lemtel-tab-dot${isAI ? ' lemtel-tab-dot--ai' : ''}`} />}
                  <Icon size={compact ? 19 : 20} color={active ? activeColor : 'currentColor'} />
                  <span style={{
                    fontSize: compact ? 9 : 10,
                    letterSpacing: compact ? 0.7 : 1.2,
                    textTransform: 'uppercase',
                    fontWeight: active ? 800 : 600,
                    maxWidth: '100%',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {label}
                  </span>
                </button>
              );
            })}
          </div>
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
        padding: compact ? '8px 10px 10px' : '12px 14px 14px',
        textAlign: 'center',
        borderTop: `1px solid ${c.border}`,
        background: c.bg,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: compact ? 3 : 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <LemtelLogo size="xs" glow />
          <BrandTagline size="sm" showPoweredBy={false} style={{ marginTop: 0 }} />
        </div>
        <div style={{ fontSize: compact ? 9 : 10, color: c.textDim, letterSpacing: 0.5 }}>
          v1.0.6 {ultraCompact ? '' : '· Powered by '}
          <a
            onClick={(e) => { e.preventDefault(); window.electronAPI?.openExternal?.('https://assistantvirtualai.com'); }}
            href="#"
            style={{ color: c.gold, textDecoration: 'none', cursor: 'pointer', fontWeight: 600 }}
          >
            {ultraCompact ? 'AVA Statistic' : 'AVA Statistic · assistantvirtualai.com'}
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
    <div style={{ animation: 'fadeIn .25s ease-out', padding: '4px 4px 8px' }}>
      <CallForwarding extension={extension} />

      {/* Number display — premium glass tile */}
      <div style={{
        margin: '4px auto 22px', maxWidth: 320,
        padding: '18px 20px', borderRadius: 18,
        background: 'linear-gradient(180deg, rgba(0,82,204,0.10), rgba(10,21,48,0.40))',
        border: `1px solid ${c.border}`,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), 0 8px 28px -16px rgba(0,82,204,0.5)',
        textAlign: 'center', minHeight: 64,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
      }}>
        <div style={{
          fontFamily: 'JetBrains Mono, Menlo, monospace',
          fontSize: 30, letterSpacing: 3, fontWeight: 500,
          color: dial ? c.textIce : c.textDim,
          textShadow: dial ? '0 0 22px rgba(255,215,0,0.35)' : 'none',
          minHeight: 36,
        }}>
          {dial || 'Enter a number'}
        </div>
        {dial && (
          <div style={{ fontSize: 10, color: c.signalGold, letterSpacing: 1.6, textTransform: 'uppercase', fontWeight: 700 }}>
            Ready to dial · ext {extension}
          </div>
        )}
      </div>

      {/* Dialpad */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14,
        maxWidth: 296, margin: '0 auto 26px',
      }}>
        {dialKeys.map(([key, sub]) => (
          <button
            key={key}
            className="lemtel-key lemtel-glass"
            onClick={() => setDial((p) => p + key)}
            style={{
              height: 72, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 2,
              borderRadius: 16,
              background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.01))',
              border: `1px solid ${c.border}`,
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
              cursor: 'pointer', color: c.textIce,
              willChange: 'transform',
            }}
          >
            <span style={{ fontSize: 24, fontWeight: 500, letterSpacing: 0.5 }}>{key}</span>
            {sub && <span style={{ fontSize: 9, color: 'rgba(159,179,214,0.55)', letterSpacing: 2, fontWeight: 700 }}>{sub}</span>}
          </button>
        ))}
      </div>

      {/* Action row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 32 }}>
        <button
          onClick={() => setDial('')}
          disabled={!dial}
          style={{
            background: 'none', border: 'none',
            color: dial ? c.textSub : 'transparent',
            fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: 'uppercase',
            cursor: dial ? 'pointer' : 'default', padding: 8, width: 56,
            transition: 'color 120ms ease',
          }}
          title="Clear"
        >Clear</button>

        <button
          onClick={onCall}
          disabled={!canCall}
          className={canCall ? 'lemtel-glass' : undefined}
          style={{
            width: 78, height: 78, borderRadius: '50%',
            background: canCall
              ? 'radial-gradient(circle at 30% 28%, #6EE7B7 0%, #10B981 55%, #047857 100%)'
              : 'rgba(16,185,129,0.12)',
            border: canCall ? '1px solid rgba(255,255,255,0.22)' : '1px solid rgba(16,185,129,0.18)',
            color: '#fff', fontSize: 28,
            cursor: canCall ? 'pointer' : 'not-allowed',
            boxShadow: canCall
              ? '0 12px 36px rgba(16,185,129,0.55), 0 0 0 6px rgba(16,185,129,0.10), inset 0 1px 0 rgba(255,255,255,0.32)'
              : 'none',
            transition: 'transform .18s ease, box-shadow .18s ease',
            display: 'grid', placeItems: 'center',
          }}
          onMouseEnter={(e) => { if (canCall) (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1.08)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          aria-label="Call"
        >
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.9.36 1.78.7 2.6a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.82.34 1.7.57 2.6.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </button>

        <button
          onClick={() => setDial((p) => p.slice(0, -1))}
          disabled={!dial}
          style={{
            background: 'none', border: 'none', color: dial ? c.textSub : 'transparent',
            fontSize: 22, cursor: dial ? 'pointer' : 'default', padding: 8, width: 56,
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
        <button onClick={onDecline} className="lemtel-glass lemtel-focus" aria-label="Decline incoming call" style={{
          ...hangupBtn, background: 'linear-gradient(135deg, #DC2626, #EF4444)', boxShadow: glow.red,
        }}>✕</button>
        <button onClick={onAnswer} className="lemtel-glass lemtel-focus" aria-label="Answer incoming call" style={{
          ...hangupBtn, background: 'linear-gradient(135deg, #059669, #10B981)', boxShadow: glow.green,
        }}>✓</button>
      </div>
    </div>
  );
}

function ActiveCall({
  sp, timer, showDTMF, toggleDTMF, dialKeys, onTransfer, compact = false, audioEl = null,
  activeOutputLabel, autoResetOutput, onAutoResetChange, onActiveOutputLabel,
}: {
  sp: any; timer: string; showDTMF: boolean; toggleDTMF: () => void;
  dialKeys: [string, string][]; onTransfer: (m: 'blind' | 'attended') => void;
  compact?: boolean; audioEl?: HTMLAudioElement | null;
  activeOutputLabel: string; autoResetOutput: boolean;
  onAutoResetChange: (v: boolean) => void;
  onActiveOutputLabel: (label: string) => void;
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
        boxShadow: glow.green, marginBottom: 6,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.green }} />
        {sp.snap.onHold ? 'On Hold' : 'Active Call'}
      </div>
      <div style={{
        fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: 22, fontWeight: 500,
        color: c.gold, letterSpacing: 2, marginBottom: 4,
      }}>{timer}</div>
      <div style={{
        fontSize: 10, color: c.textSub, letterSpacing: 0.6,
        marginBottom: 18, display: 'flex', alignItems: 'center', gap: 4,
      }}>
        <span style={{ fontSize: 10 }}>🔊</span>
        {activeOutputLabel}
      </div>

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
        <div role="group" aria-label="DTMF keypad" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6,
          marginBottom: 14, width: '100%', maxWidth: 240,
        }}>
          {dialKeys.map(([k]) => (
            <button
              key={k}
              className="lemtel-key lemtel-glass lemtel-focus"
              onClick={() => sp.sendDTMF(k)}
              aria-label={`Send DTMF tone ${k}`}
              style={{ padding: '10px 0', fontSize: 16 }}
            >{k}</button>
          ))}
        </div>
      )}

      {/* Audio output selector */}
      <OutputDevicePicker
        audioEl={audioEl}
        compact={compact}
        onActiveLabel={onActiveOutputLabel}
        autoReset={autoResetOutput}
        onAutoResetChange={onAutoResetChange}
      />

      {/* Controls — vertical grid normally, continuous swipe strip when compact
          so every button stays reachable at very small widths. */}
      <div
        role="toolbar"
        aria-label="Call controls"
        aria-keyshortcuts="M H K T E"
        className={compact ? 'lemtel-control-strip' : 'lemtel-scroll'}
        style={compact ? {
          width: '100%', marginBottom: 12,
        } : {
          display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
          width: '100%', maxWidth: 280, marginBottom: 12,
          maxHeight: '38vh', overflowY: 'auto', paddingRight: 2,
        }}
      >
        <ControlBtn icon="🎤" label={sp.snap.muted ? 'Unmute' : 'Mute'} ariaLabel={`${sp.snap.muted ? 'Unmute microphone' : 'Mute microphone'} (shortcut M)`} active={sp.snap.muted} danger onClick={sp.snap.muted ? sp.unmute : sp.mute} />
        <ControlBtn icon="⏸" label={sp.snap.onHold ? 'Resume' : 'Hold'} ariaLabel={`${sp.snap.onHold ? 'Resume call' : 'Place call on hold'} (shortcut H)`} active={sp.snap.onHold} warning onClick={sp.snap.onHold ? sp.unhold : sp.hold} />
        <ControlBtn icon="#" label="Keypad" ariaLabel={`${showDTMF ? 'Hide DTMF keypad' : 'Show DTMF keypad'} (shortcut K)`} active={showDTMF} onClick={toggleDTMF} />
        <ControlBtn icon="⏺" label={sp.recording ? 'Stop' : 'Record'} ariaLabel={sp.recording ? 'Stop recording call' : 'Start recording call'} active={sp.recording} onClick={sp.toggleRecording} />
        <ControlBtn icon="↪" label="Blind Xfer" ariaLabel="Blind transfer call (shortcut T)" onClick={() => onTransfer('blind')} />
        <ControlBtn icon="↗" label="Attended" ariaLabel="Attended transfer call (shortcut Shift+T)" onClick={() => onTransfer('attended')} disabled={sp.hasConsult()} active={sp.hasConsult()} />
      </div>


      {sp.hasConsult() ? (
        <div style={{ width: '100%', maxWidth: 280, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button onClick={sp.completeAttendedTransfer} className="lemtel-btn-primary lemtel-glass lemtel-focus" aria-label="Complete attended transfer" style={{
            height: 44, borderRadius: 12, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>✓ Complete Transfer</button>
          <button onClick={sp.cancelAttendedConsult} className="lemtel-glass lemtel-focus" aria-label="Cancel attended transfer consult" style={endCallBtn}>✕ Cancel Consult</button>
        </div>
      ) : (
        <button onClick={sp.hangup} className="lemtel-glass lemtel-focus" aria-label="End call" style={endCallBtn}>📵 End Call</button>
      )}
    </div>
  );
}

function ControlBtn({
  icon, label, ariaLabel, onClick, active, danger, warning, disabled,
}: {
  icon: string; label: string; ariaLabel?: string; onClick: () => void;
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
      aria-label={ariaLabel || label}
      aria-pressed={active ? true : undefined}
      className={`lemtel-focus${disabled ? '' : ' lemtel-glass'}`}
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
      <span aria-hidden="true" style={{ fontSize: 14 }}>{icon}</span>
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
