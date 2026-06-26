import React, { useEffect, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import Dialpad from '../components/Dialpad';
import WssDiagnostics from '../components/WssDiagnostics';
import { audit } from '../lib/audit';
import { showMobileToast } from '../lib/mobileToast';

export default function DialerScreen({ sp, haptic, preferClickToCall: _preferClickToCall = false }: { sp: any; haptic: (s?: ImpactStyle) => Promise<void>; preferClickToCall?: boolean }) {
  const [num, setNum] = useState('');
  const [dialing, setDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const status: string = sp.sipStatus || sp.snap?.status || 'connecting';
  const sipError: string = sp.sipError || sp.snap?.error || '';
  const isRegistered = status === 'registered';
  const isRetrying = status === 'connecting' || status === 'retrying';
  const isFailed = status === 'error';
  const retryAttempt: number = sp.retryAttempt || 0;
  const nextRetryAt: number | null = sp.nextRetryAt || null;
  const [countdown, setCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (!nextRetryAt) { setCountdown(null); return; }
    const tick = () => setCountdown(Math.max(0, Math.round((nextRetryAt - Date.now()) / 1000)));
    tick(); const id = setInterval(tick, 500); return () => clearInterval(id);
  }, [nextRetryAt]);
  const sslLikely = /ssl|certificate|cert|tls|handshake|wss connection failed/i.test(sipError);
  const bannerBg = isRegistered ? 'rgba(34,197,94,0.12)' : isRetrying ? 'rgba(245,158,11,0.12)' : 'rgba(239,68,68,0.12)';
  const bannerColor = isRegistered ? '#22c55e' : isRetrying ? '#f59e0b' : '#ef4444';
  const retryLimitReached: boolean = !!sp.retryLimitReached;
  const bannerTitle = isRegistered
    ? `✅ SIP enregistré — Extension ${sp.sipConfig?.extension || ''}`.trim()
    : isRetrying
      ? (countdown !== null && retryAttempt > 0 ? `🟡 SIP en connexion — nouvelle tentative dans ${countdown}s (essai ${retryAttempt})…` : '🟡 SIP en connexion…')
      : `🔴 SIP indisponible${sipError ? ` (${sipError})` : ''}`;
  const startCall = async () => {
    if (!num || dialing || !isRegistered) return;
    await haptic(ImpactStyle.Medium);
    audit('call.originated', null, { destination: num, sipStatus: status });
    setDialing(true); setError(null);
    try {
      const ok = sp.call(num);
      if (ok === false) { setError("Impossible de lancer l'appel SIP"); showMobileToast("Impossible de lancer l'appel SIP", 'error'); }
    } catch (e: any) {
      const msg = e?.message || "Impossible de lancer l'appel";
      setError(msg); showMobileToast(msg, 'error');
    } finally { setDialing(false); }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflowY: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <style>{dialerButtonCss}</style>
      {diagOpen && <WssDiagnostics config={sp.sipConfig || null} onClose={() => setDiagOpen(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: bannerColor }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{status}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lemtel Télécom</div>
      </div>
      {isFailed && (
        <div style={{ margin: '10px 16px 0', padding: '10px 12px', borderRadius: 12, background: bannerBg, border: `1px solid ${bannerColor}55`, color: bannerColor, fontSize: 12, flexShrink: 0 }}>
          <div style={{ fontWeight: 700 }}>{bannerTitle}</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button className="dialer-glass-pill" onClick={() => { haptic(); sp.reconnect?.(); }} style={{ ['--accent' as any]: bannerColor }}>Reconnecter</button>
            <button className="dialer-glass-pill" onClick={() => { haptic(); setDiagOpen(true); }} style={{ ['--accent' as any]: '#23d6ff' }}>Diagnostics WSS</button>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 24, flexShrink: 0 }}>
        <div style={{ textAlign: 'center', padding: '16px 24px 8px', minHeight: 64 }}>
          <div style={{ fontSize: num.length > 12 ? 28 : 38, fontWeight: 300, letterSpacing: 1, color: 'white', minHeight: 48, wordBreak: 'break-all' }}>
            {num || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Entrer un numéro</span>}
          </div>
        </div>
        <Dialpad onPress={(d) => { haptic(ImpactStyle.Light); setNum((n) => n + d); }} onLongPressZero={() => setNum((n) => n.slice(0, -1) + '+')} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', padding: '16px 24px 8px' }}>
          <div style={{ width: 64 }} />
          <button className="dialer-call-orb" disabled={!num || dialing || !isRegistered} onClick={startCall}>{dialing ? '…' : '☏'}</button>
          <button className="dialer-backspace" onClick={() => { haptic(); setNum((n) => n.slice(0, -1)); }} disabled={!num}>⌫</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 12, padding: '0 24px 10px' }}>{error}</div>}
      </div>
    </div>
  );
}

const dialerButtonCss = `
.dialer-glass-pill,.dialer-call-orb,.dialer-backspace{position:relative;overflow:hidden;isolation:isolate;-webkit-tap-highlight-color:transparent;backdrop-filter:blur(18px) saturate(180%);-webkit-backdrop-filter:blur(18px) saturate(180%);transition:transform .18s cubic-bezier(.2,.8,.2,1),box-shadow .18s ease,border-color .18s ease,opacity .18s ease;}
.dialer-glass-pill{border:1px solid color-mix(in srgb,var(--accent) 58%,white);background:radial-gradient(circle at 25% 0%,rgba(255,255,255,.34),rgba(255,255,255,.10) 45%,rgba(255,255,255,.045)),linear-gradient(135deg,color-mix(in srgb,var(--accent) 34%,transparent),rgba(255,255,255,.05));color:#fff;padding:7px 13px;border-radius:999px;font-size:12px;font-weight:800;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.34),0 12px 26px -18px var(--accent);}
.dialer-call-orb{width:78px;height:78px;border-radius:50%;border:1px solid rgba(255,255,255,.30);background:radial-gradient(circle at 30% 18%,rgba(255,255,255,.48),rgba(34,197,94,.88) 32%,rgba(21,128,61,.96) 100%);color:white;font-size:31px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.46),inset 0 -22px 34px rgba(0,0,0,.25),0 18px 46px -12px rgba(34,197,94,.86),0 0 30px -14px rgba(34,197,94,.95);}
.dialer-backspace{width:64px;height:48px;border-radius:24px;background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);color:white;font-size:22px;cursor:pointer;box-shadow:inset 0 1px 0 rgba(255,255,255,.18);}
.dialer-glass-pill::before,.dialer-call-orb::before,.dialer-backspace::before{content:"";position:absolute;inset:-45%;background:linear-gradient(115deg,transparent 35%,rgba(255,255,255,.72) 49%,transparent 63%);transform:translateX(-78%) rotate(8deg);opacity:.55;transition:transform .42s ease;pointer-events:none;}
.dialer-glass-pill:hover:not(:disabled),.dialer-call-orb:hover:not(:disabled),.dialer-backspace:hover:not(:disabled){transform:translateY(-3px) scale(1.035);}
.dialer-glass-pill:hover:not(:disabled)::before,.dialer-call-orb:hover:not(:disabled)::before,.dialer-backspace:hover:not(:disabled)::before{transform:translateX(78%) rotate(8deg);}
.dialer-glass-pill:active:not(:disabled),.dialer-call-orb:active:not(:disabled),.dialer-backspace:active:not(:disabled){transform:translateY(1px) scale(.94);}
.dialer-call-orb:disabled{opacity:.42;cursor:not-allowed;filter:saturate(.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),inset 0 -18px 28px rgba(0,0,0,.25);}
.dialer-backspace:disabled{opacity:0;color:transparent;cursor:default;}
@media (prefers-reduced-motion:reduce){.dialer-glass-pill,.dialer-call-orb,.dialer-backspace,.dialer-glass-pill::before,.dialer-call-orb::before,.dialer-backspace::before{transition:none;}}
`;
