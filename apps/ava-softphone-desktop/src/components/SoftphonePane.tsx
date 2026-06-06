import React, { useEffect, useRef, useState } from 'react';
import { useSoftphone, ManualStatus } from '@/hooks/useSoftphone';
import RecentsList from './RecentsList';
import ContactsList from './ContactsList';
import VoicemailList from './VoicemailList';
import SmsThreads from './SmsThreads';
import CallForwarding from './CallForwarding';
import { useTheme } from '../lib/theme';

interface Creds {
  extension: string;
  email: string;
  displayName?: string;
  sipDomain?: string;
  wssUrl?: string;
  accessToken?: string;
  refreshToken?: string;
}

type Tab = 'dial' | 'recents' | 'contacts' | 'voicemail' | 'sms';

const TAB_META: Record<Tab, { icon: string; label: string }> = {
  dial: { icon: '⌨', label: 'Dial' },
  recents: { icon: '⟲', label: 'Recents' },
  contacts: { icon: '☻', label: 'Contacts' },
  voicemail: { icon: '✉', label: 'Voicemail' },
  sms: { icon: '✦', label: 'SMS' },
};

export default function SoftphonePane({
  creds,
  onOpenSettings,
}: {
  creds: Creds;
  onOpenSettings: () => void;
}) {
  const { t, mode } = useTheme();
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

  useEffect(() => {
    if (sp.snap.callState !== 'active' && sp.snap.callState !== 'held') { setTimer(0); return; }
    if (!sp.snap.startedAt) return;
    const id = setInterval(() => {
      setTimer(Math.floor((Date.now() - (sp.snap.startedAt || Date.now())) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [sp.snap.callState, sp.snap.startedAt]);

  const dotColor =
    sp.snap.status === 'registered' ? t.success :
    sp.snap.status === 'error' ? t.danger : t.warning;

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

  const circleBtn = (bg: string, size = 56, glow?: string): React.CSSProperties => ({
    width: size, height: size, borderRadius: '50%', background: bg, border: 'none',
    color: '#fff', fontSize: size > 50 ? 22 : 18, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: glow || `0 8px 24px -8px ${bg}`,
    transition: 'transform 120ms ease',
  });

  const pillBtn = (active: boolean, danger = false): React.CSSProperties => ({
    background: danger
      ? 'rgba(239,68,68,0.12)'
      : active
        ? t.accentSoft
        : mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.04)',
    color: danger ? t.danger : active ? t.accent : t.text,
    border: `1px solid ${danger ? 'rgba(239,68,68,0.28)' : active ? 'rgba(99,102,241,0.35)' : t.border}`,
    borderRadius: 10, padding: '10px 8px', fontSize: 11, fontWeight: 600,
    cursor: 'pointer', transition: 'all 140ms ease',
  });

  const dtmfBtn: React.CSSProperties = {
    background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.04)',
    border: `1px solid ${t.border}`,
    borderRadius: 10, color: t.text, padding: '10px 0', cursor: 'pointer', fontSize: 16,
    transition: 'all 140ms ease',
  };

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100%',
      background: t.bgGradient, color: t.text,
    }}>
      <audio ref={audioRef} autoPlay />

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px', borderBottom: `1px solid ${t.border}`,
        background: t.surface, backdropFilter: 'blur(12px)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: t.accentGradient,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 14,
            boxShadow: t.accentGlow,
          }}>
            {(creds.displayName || creds.email).charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{creds.displayName || creds.email}</div>
            <div style={{ fontSize: 11, color: t.textMuted, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, boxShadow: `0 0 8px ${dotColor}` }} />
              Ext. {creds.extension}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={sp.manualStatus}
            onChange={(e) => sp.setManualStatus(e.target.value as ManualStatus)}
            style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.04)',
              color: t.text, border: `1px solid ${t.border}`,
              borderRadius: 8, fontSize: 11, padding: '6px 8px', cursor: 'pointer',
            }}
            title="Presence"
          >
            <option value="auto">Auto</option>
            <option value="available">Available</option>
            <option value="dnd">Do Not Disturb</option>
            <option value="away">Away</option>
          </select>
          <button
            onClick={onOpenSettings}
            style={{
              background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.04)',
              border: `1px solid ${t.border}`,
              color: t.text, cursor: 'pointer',
              width: 30, height: 30, borderRadius: 8, fontSize: 14,
            }}
            aria-label="Settings"
          >
            ⚙
          </button>
        </div>
      </div>

      {sp.credError && (
        <div style={{
          background: 'rgba(239,68,68,0.10)', color: t.danger,
          padding: '8px 14px', fontSize: 11,
          borderBottom: '1px solid rgba(239,68,68,0.2)',
        }}>
          {sp.credError}
        </div>
      )}

      {/* Tabs */}
      {!inCall && !ringing && (
        <div style={{ display: 'flex', borderBottom: `1px solid ${t.border}`, padding: '0 8px' }}>
          {(['dial', 'recents', 'contacts', 'voicemail', 'sms'] as Tab[]).map((tk) => {
            const active = tab === tk;
            return (
              <button
                key={tk}
                onClick={() => setTab(tk)}
                style={{
                  flex: 1, padding: '12px 4px', background: 'none', border: 'none',
                  borderBottom: active ? `2px solid ${t.accent}` : '2px solid transparent',
                  color: active ? t.accent : t.textMuted,
                  fontSize: 11, cursor: 'pointer',
                  fontWeight: active ? 700 : 500,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                  transition: 'color 140ms ease',
                }}
                title={TAB_META[tk].label}
              >
                <span style={{ fontSize: 16 }}>{TAB_META[tk].icon}</span>
                <span style={{ fontSize: 9, letterSpacing: 0.5, textTransform: 'uppercase' }}>{TAB_META[tk].label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Incoming */}
        {sp.snap.callState === 'ringing-in' && (
          <div style={{ textAlign: 'center', padding: 28 }}>
            <div style={{
              width: 90, height: 90, margin: '0 auto 18px', borderRadius: '50%',
              background: t.accentGradient,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 38, color: '#fff', boxShadow: t.accentGlow,
              animation: 'pulse 1.6s ease-in-out infinite',
            }}>📞</div>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>Incoming call</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>{sp.snap.remoteIdentity}</div>
            <div style={{ fontSize: 13, color: t.textMuted, marginBottom: 28 }}>{sp.snap.remoteNumber}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 24 }}>
              <button onClick={sp.hangup} style={circleBtn(t.danger, 60)}>📵</button>
              <button onClick={sp.answer} style={circleBtn(t.success, 60)}>📞</button>
            </div>
          </div>
        )}

        {/* Outgoing */}
        {sp.snap.callState === 'ringing-out' && (
          <div style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ fontSize: 12, color: t.textMuted, marginBottom: 4, letterSpacing: 0.8, textTransform: 'uppercase' }}>Calling…</div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 28 }}>{sp.snap.remoteNumber || dial}</div>
            <button onClick={sp.hangup} style={circleBtn(t.danger, 60)}>📵</button>
          </div>
        )}

        {/* Active / Held */}
        {inCall && (
          <div style={{ textAlign: 'center', padding: '8px 4px' }}>
            <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>{sp.snap.remoteIdentity || sp.snap.remoteNumber}</div>
            <div style={{
              fontSize: 32, fontFamily: 'JetBrains Mono, monospace', fontWeight: 500,
              color: sp.snap.onHold ? t.warning : t.success,
              marginBottom: 6, letterSpacing: 1,
            }}>
              {fmt(timer)}
            </div>
            <div style={{ fontSize: 11, color: t.textMuted, marginBottom: 18, letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {sp.snap.onHold ? 'On hold' : 'Active call'}
              {sp.hasConsult() && ' · consult ongoing'}
            </div>

            {showDTMF && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                {dialKeys.map(([k]) => (
                  <button key={k} onClick={() => sp.sendDTMF(k)} style={dtmfBtn}>{k}</button>
                ))}
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
              <button onClick={sp.snap.muted ? sp.unmute : sp.mute} style={pillBtn(sp.snap.muted)}>{sp.snap.muted ? '🔇 Unmute' : '🎤 Mute'}</button>
              <button onClick={sp.snap.onHold ? sp.unhold : sp.hold} style={pillBtn(sp.snap.onHold)}>{sp.snap.onHold ? '▶ Resume' : '⏸ Hold'}</button>
              <button onClick={() => setShowDTMF((v) => !v)} style={pillBtn(showDTMF)}>🔢 Keypad</button>
              <button onClick={() => { setXferMode('blind'); setShowXfer(true); }} style={pillBtn(false)}>↪ Blind</button>
              <button onClick={() => { setXferMode('attended'); setShowXfer(true); }} style={pillBtn(sp.hasConsult())} disabled={sp.hasConsult()}>↗ Attended</button>
              <button onClick={sp.toggleRecording} style={pillBtn(sp.recording)}>{sp.recording ? '⏺ Stop' : '⏺ Record'}</button>
            </div>

            {sp.hasConsult() ? (
              <>
                <button onClick={sp.completeAttendedTransfer} style={{ ...pillBtn(true), width: '100%', marginBottom: 8, padding: '12px' }}>✓ Complete transfer</button>
                <button onClick={sp.cancelAttendedConsult} style={{ ...pillBtn(false, true), width: '100%' }}>✕ Cancel consult</button>
              </>
            ) : (
              <button onClick={sp.hangup} style={{ ...circleBtn(t.danger, 60), marginTop: 8 }}>📵</button>
            )}
          </div>
        )}

        {/* Idle */}
        {!inCall && !ringing && tab === 'dial' && (
          <>
            <CallForwarding extension={creds.extension} />
            <div style={{
              textAlign: 'center', fontSize: 28, fontWeight: 600,
              minHeight: 44, marginBottom: 18, opacity: dial ? 1 : 0.35,
              fontFamily: 'JetBrains Mono, monospace', letterSpacing: 2,
              color: t.text,
            }}>
              {dial || 'Enter number'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 18 }}>
              {dialKeys.map(([key, sub]) => (
                <button
                  key={key}
                  onClick={() => setDial((p) => p + key)}
                  style={{
                    background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.03)',
                    border: `1px solid ${t.border}`,
                    borderRadius: 12, color: t.text,
                    padding: '16px 8px', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                    transition: 'all 140ms ease',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = t.accentSoft; e.currentTarget.style.borderColor = 'rgba(99,102,241,0.3)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.03)'; e.currentTarget.style.borderColor = t.border; }}
                >
                  <span style={{ fontSize: 22, fontWeight: 500 }}>{key}</span>
                  <span style={{ fontSize: 9, color: t.textSubtle }}>{sub}</span>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18 }}>
              <button
                onClick={() => setDial((p) => p.slice(0, -1))}
                style={{
                  background: 'none', border: 'none', color: t.textMuted,
                  fontSize: 20, cursor: 'pointer', padding: 8,
                }}
              >⌫</button>
              <button
                onClick={handleCall}
                disabled={!dial || sp.snap.status !== 'registered'}
                style={{
                  ...circleBtn(t.success, 60, '0 8px 24px -8px ' + t.success),
                  opacity: (!dial || sp.snap.status !== 'registered') ? 0.4 : 1,
                  cursor: (!dial || sp.snap.status !== 'registered') ? 'not-allowed' : 'pointer',
                }}
              >📞</button>
              <div style={{ width: 36 }} />
            </div>
          </>
        )}

        {!inCall && !ringing && tab === 'recents' && (
          <RecentsList extension={creds.extension} onCall={(n) => { setDial(n); sp.call(n); }} />
        )}
        {!inCall && !ringing && tab === 'contacts' && (
          <ContactsList selfExtension={creds.extension} onCall={(n) => { setDial(n); sp.call(n); }} />
        )}
        {!inCall && !ringing && tab === 'voicemail' && (
          <VoicemailList extension={creds.extension} onCall={(n) => { setDial(n); sp.call(n); }} />
        )}
        {!inCall && !ringing && tab === 'sms' && (
          <SmsThreads />
        )}
      </div>

      {/* Transfer modal */}
      {showXfer && (
        <div style={{
          position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
          backdropFilter: 'blur(8px)',
        }} onClick={() => setShowXfer(false)}>
          <div
            style={{
              background: t.surfaceElev, border: `1px solid ${t.borderStrong}`,
              borderRadius: 16, padding: 20, width: 300, boxShadow: t.shadow,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>
              {xferMode === 'blind' ? 'Blind transfer' : 'Attended transfer'}
            </div>
            <input
              autoFocus
              value={xferTarget}
              onChange={(e) => setXferTarget(e.target.value)}
              placeholder="Extension or number"
              style={{
                width: '100%',
                background: mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,18,28,0.03)',
                border: `1px solid ${t.border}`,
                borderRadius: 10, color: t.text,
                padding: '11px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleXferSubmit()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setShowXfer(false)} style={{ ...pillBtn(false), flex: 1, padding: '11px' }}>Cancel</button>
              <button onClick={handleXferSubmit} style={{ ...pillBtn(true), flex: 1, padding: '11px' }}>
                {xferMode === 'blind' ? 'Transfer' : 'Start consult'}
              </button>
            </div>
            {xferMode === 'attended' && (
              <div style={{ fontSize: 10, color: t.textSubtle, marginTop: 10 }}>
                Speak with the new party, then press ✓ Complete to connect them with the caller.
              </div>
            )}
          </div>
        </div>
      )}

      {/* AVA footer */}
      <div
        data-testid="ava-footer"
        style={{
          flexShrink: 0,
          padding: '10px 16px 12px',
          borderTop: `1px solid ${t.border}`,
          background: t.surface,
          backdropFilter: 'blur(12px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          fontSize: 10,
          color: t.textMuted,
          letterSpacing: 0.4,
        }}
      >
        <div style={{
          width: 14, height: 14, borderRadius: 4, background: t.accentGradient,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff', fontSize: 8, fontWeight: 800,
        }}>A</div>
        <span>App built by</span>
        <a
          href="https://avastatistic.ca"
          onClick={(e) => {
            e.preventDefault();
            window.electronAPI?.openExternal?.('https://avastatistic.ca');
          }}
          style={{ color: t.accent, fontWeight: 600, textDecoration: 'none', cursor: 'pointer' }}
        >
          AVA Statistics · avastatistic.ca
        </a>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.06); }
        }
      `}</style>
    </div>
  );
}
