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
      {diagOpen && <WssDiagnostics config={sp.sipConfig || null} onClose={() => setDiagOpen(false)} />}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 8px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: bannerColor }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>{status}</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lemtel Télécom</div>
      </div>
      <div style={{ margin: '10px 16px 0', padding: '10px 12px', borderRadius: 12, background: bannerBg, border: `1px solid ${bannerColor}55`, color: bannerColor, fontSize: 12, flexShrink: 0 }}>
        <div style={{ fontWeight: 700 }}>{bannerTitle}</div>
        {sipError && !isFailed && <div style={{ fontWeight: 400, opacity: 0.9, lineHeight: 1.4 }}>{sipError}</div>}
        {isRegistered && (sp.negotiatedCodec || (sp.offeredCodecs && sp.offeredCodecs.length > 0)) && (
          <div style={{ fontWeight: 400, opacity: 0.85, marginTop: 4, fontSize: 11 }}>
            {sp.negotiatedCodec
              ? `🎙 Codec actif : ${sp.negotiatedCodec}`
              : `🎙 Codecs offerts : ${(sp.offeredCodecs as string[]).join(', ')}`}
          </div>
        )}
        {(isFailed || sslLikely || isRetrying) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button onClick={() => { haptic(); sp.reconnect?.(); }} style={{ background: bannerColor, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Reconnecter</button>
            <button onClick={() => { haptic(); setDiagOpen(true); }} style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>Diagnostics WSS</button>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', paddingBottom: 24, flexShrink: 0 }}>
        <div style={{ textAlign: 'center', padding: '16px 24px 8px', minHeight: 64 }}>
          <div style={{ fontSize: num.length > 12 ? 28 : 38, fontWeight: 300, letterSpacing: 1, color: 'white', minHeight: 48, wordBreak: 'break-all' }}>
            {num || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Entrer un numéro</span>}
          </div>
        </div>
        <Dialpad onPress={(d) => { haptic(ImpactStyle.Light); setNum((n) => n + d); }} onLongPressZero={() => setNum((n) => n.slice(0, -1) + '+')} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', padding: '16px 24px 8px' }}>
          <div style={{ width: 64 }} />
          <button disabled={!num || dialing || !isRegistered} onClick={startCall} style={{ width: 72, height: 72, borderRadius: '50%', background: (!num || dialing || !isRegistered) ? 'rgba(34,197,94,0.3)' : 'linear-gradient(135deg,#22c55e,#15803d)', border: 'none', cursor: (!num || dialing || !isRegistered) ? 'not-allowed' : 'pointer', color: 'white', fontSize: 30, boxShadow: '0 10px 30px rgba(34,197,94,0.4)' }}>{dialing ? '…' : '☏'}</button>
          <button onClick={() => { haptic(); setNum((n) => n.slice(0, -1)); }} disabled={!num} style={{ width: 64, height: 48, borderRadius: 24, background: 'transparent', border: 'none', color: num ? 'white' : 'transparent', fontSize: 22, cursor: 'pointer' }}>⌫</button>
        </div>
        {error && <div style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 12, padding: '0 24px 10px' }}>{error}</div>}
      </div>
    </div>
  );
}
