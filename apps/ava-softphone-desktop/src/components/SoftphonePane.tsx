import React, { useEffect, useRef, useState } from 'react';
import { useSoftphone, ManualStatus } from '@/hooks/useSoftphone';
import { supabase } from '@/lib/supabaseClient';
import RecentsList from './RecentsList';
import ContactsList from './ContactsList';
import VoicemailList from './VoicemailList';
import SmsThreads from './SmsThreads';
import CallForwarding from './CallForwarding';
import lemtelLogo from '../assets/lemtel-logo.png';

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

  // Call duration timer
  useEffect(() => {
    if (sp.snap.callState !== 'active' && sp.snap.callState !== 'held') {
      setTimer(0);
      return;
    }
    if (!sp.snap.startedAt) return;
    const id = setInterval(() => {
      setTimer(Math.floor((Date.now() - (sp.snap.startedAt || Date.now())) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [sp.snap.callState, sp.snap.startedAt]);

  const dotColor =
    sp.snap.status === 'registered' ? '#28ca41' :
    sp.snap.status === 'error' ? '#ff5f56' : '#ffbd2e';

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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a1a', color: '#fff' }}>
      <audio ref={audioRef} autoPlay />

      {/* Header */}
      <div style={hdr}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>{creds.displayName || creds.email}</div>
          <div style={{ fontSize: 11, opacity: 0.6 }}>Ext. {creds.extension}</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <select
            value={sp.manualStatus}
            onChange={(e) => sp.setManualStatus(e.target.value as ManualStatus)}
            style={statusSelect}
            title="Presence"
          >
            <option value="auto">🟢 Auto</option>
            <option value="available">🟢 Available</option>
            <option value="dnd">⛔ DND</option>
            <option value="away">🌙 Away</option>
          </select>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor }} />
          <button onClick={onOpenSettings} style={iconBtn} aria-label="Settings">⚙️</button>
        </div>
      </div>

      {sp.credError && (
        <div style={{ background: 'rgba(255,0,0,0.1)', color: '#ff8a8a', padding: '8px 14px', fontSize: 11 }}>
          {sp.credError}
        </div>
      )}

      {/* Tabs (hidden during ringing/active so the call view takes full space) */}
      {!inCall && !ringing && (
        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
          {(['dial', 'recents', 'contacts', 'voicemail', 'sms'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1,
                padding: '10px 4px',
                background: 'none',
                border: 'none',
                borderBottom: tab === t ? '2px solid #FFD700' : '2px solid transparent',
                color: tab === t ? '#FFD700' : 'rgba(255,255,255,0.5)',
                fontSize: 11,
                cursor: 'pointer',
                fontWeight: tab === t ? 600 : 400,
              }}
              title={t}
            >
              {t === 'dial' ? '📞' : t === 'recents' ? '📋' : t === 'contacts' ? '👤' : t === 'voicemail' ? '✉' : '💬'}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {/* Incoming ring */}
        {sp.snap.callState === 'ringing-in' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Incoming call</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 4 }}>{sp.snap.remoteIdentity}</div>
            <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 24 }}>{sp.snap.remoteNumber}</div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
              <button onClick={sp.hangup} style={circleBtn('#ff5f56')}>📵</button>
              <button onClick={sp.answer} style={circleBtn('#28ca41')}>📞</button>
            </div>
          </div>
        )}

        {/* Outgoing ring */}
        {sp.snap.callState === 'ringing-out' && (
          <div style={{ textAlign: 'center', padding: 24 }}>
            <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 4 }}>Calling…</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginBottom: 24 }}>{sp.snap.remoteNumber || dial}</div>
            <button onClick={sp.hangup} style={circleBtn('#ff5f56')}>📵</button>
          </div>
        )}

        {/* Active / Held */}
        {inCall && (
          <div style={{ textAlign: 'center', padding: '16px 8px' }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{sp.snap.remoteIdentity || sp.snap.remoteNumber}</div>
            <div style={{ fontSize: 28, fontFamily: 'monospace', color: sp.snap.onHold ? '#ffbd2e' : '#28ca41', marginBottom: 6 }}>
              {fmt(timer)}
            </div>
            <div style={{ fontSize: 11, opacity: 0.6, marginBottom: 16 }}>
              {sp.snap.onHold ? 'On hold' : 'Active call'}
              {sp.hasConsult() && ' • consult ongoing'}
            </div>

            {/* In-call DTMF panel */}
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
              <button onClick={sp.toggleRecording} style={pillBtn(sp.recording)}>{sp.recording ? '⏺ Stop rec' : '⏺ Record'}</button>
              {sp.hasConsult() ? (
                <button onClick={sp.completeAttendedTransfer} style={pillBtn(true)}>✓ Complete</button>
              ) : (
                <button onClick={sp.hangup} style={circleBtn('#ff5f56', 44)}>📵</button>
              )}
            </div>

            {sp.hasConsult() && (
              <button onClick={sp.cancelAttendedConsult} style={{ ...pillBtn(false), marginBottom: 10 }}>
                ✕ Cancel consult
              </button>
            )}

            {!sp.hasConsult() && (
              <button onClick={sp.hangup} style={{ ...circleBtn('#ff5f56'), marginTop: 8 }}>📵 Hang up</button>
            )}
          </div>
        )}

        {/* Idle: dial / recents / contacts */}
        {!inCall && !ringing && tab === 'dial' && (
          <>
            <CallForwarding extension={creds.extension} />
            <div style={{ textAlign: 'center', fontSize: 24, fontWeight: 500, minHeight: 36, marginBottom: 16, opacity: dial ? 1 : 0.3 }}>
              {dial || 'Enter number'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {dialKeys.map(([key, sub]) => (
                <button
                  key={key}
                  onClick={() => setDial((p) => p + key)}
                  style={{
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    color: '#fff',
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
              <button onClick={() => setDial((p) => p.slice(0, -1))} style={iconBtnLg}>⌫</button>
              <button onClick={handleCall} disabled={!dial || sp.snap.status !== 'registered'} style={{ ...circleBtn('#28ca41'), opacity: (!dial || sp.snap.status !== 'registered') ? 0.4 : 1 }}>📞</button>
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
        <div style={modalBackdrop} onClick={() => setShowXfer(false)}>
          <div style={modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              {xferMode === 'blind' ? 'Blind transfer' : 'Attended transfer'}
            </div>
            <input
              autoFocus
              value={xferTarget}
              onChange={(e) => setXferTarget(e.target.value)}
              placeholder="Extension or number"
              style={input}
              onKeyDown={(e) => e.key === 'Enter' && handleXferSubmit()}
            />
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={() => setShowXfer(false)} style={{ ...pillBtn(false), flex: 1 }}>Cancel</button>
              <button onClick={handleXferSubmit} style={{ ...pillBtn(true), flex: 1 }}>
                {xferMode === 'blind' ? 'Transfer' : 'Start consult'}
              </button>
            </div>
            <div style={{ fontSize: 10, opacity: 0.5, marginTop: 10 }}>
              {xferMode === 'attended' && 'Speak with the new party, then press ✓ Complete to connect them with the caller.'}
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          padding: '10px 16px 12px',
          borderTop: '1px solid rgba(255,215,0,0.12)',
          background:
            'linear-gradient(180deg, rgba(0,90,255,0.05) 0%, rgba(0,0,0,0.4) 100%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <img
          src={lemtelLogo}
          alt="Lemtel"
          style={{
            height: 22,
            width: 'auto',
            opacity: 0.95,
            filter: 'drop-shadow(0 0 10px rgba(255,215,0,0.35))',
          }}
        />
        <div style={{ fontSize: 9, letterSpacing: 1.5, color: 'rgba(125,211,252,0.7)', textTransform: 'uppercase' }}>
          Powered by AVA AI · assistantvirtualai.com
        </div>
      </div>
    </div>
  );
}

// styles ----------------------------------------------------
const hdr: React.CSSProperties = {
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)',
};
const iconBtn: React.CSSProperties = { background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 16 };
const iconBtnLg: React.CSSProperties = { background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', fontSize: 20, cursor: 'pointer', padding: 8 };
const statusSelect: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', color: '#fff', border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 6, fontSize: 11, padding: '4px 6px', cursor: 'pointer',
};
const circleBtn = (bg: string, size = 56): React.CSSProperties => ({
  width: size, height: size, borderRadius: '50%', background: bg, border: 'none',
  color: '#fff', fontSize: size > 50 ? 22 : 18, cursor: 'pointer',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
});
const pillBtn = (active: boolean): React.CSSProperties => ({
  background: active ? '#FFD700' : 'rgba(255,255,255,0.08)',
  color: active ? '#0a0a1a' : '#fff',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, padding: '10px 8px', fontSize: 11, fontWeight: 600,
  cursor: 'pointer',
});
const dtmfBtn: React.CSSProperties = {
  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8, color: '#fff', padding: '10px 0', cursor: 'pointer', fontSize: 16,
};
const emptyState: React.CSSProperties = { textAlign: 'center', padding: 40, opacity: 0.5 };
const modalBackdrop: React.CSSProperties = {
  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};
const modal: React.CSSProperties = {
  background: '#13132a', border: '1px solid rgba(255,215,0,0.3)',
  borderRadius: 12, padding: 18, width: 280,
};
const input: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.08)',
  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 8,
  color: '#fff', padding: '10px 12px', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
