import React, { useEffect, useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import Dialpad from '../components/Dialpad';
import WssDiagnostics from '../components/WssDiagnostics';
import { audit } from '../lib/audit';
import { showMobileToast } from '../lib/mobileToast';
import { mobileApi } from '../lib/mobileApi';

// Click-to-call availability is gated server-side by
// /functions/v1/mobile-click-to-call-status. Default OFF until the PBX admin
// grants command_add/command_edit and flips CLICK_TO_CALL_ENABLED=1.
const CLICK_TO_CALL_FALLBACK_REASON =
  'Server-side originate is disabled: the FusionPBX API user lacks the ' +
  '“command_add / command_edit” permission. Ask the PBX admin to grant it, ' +
  'then enable click-to-call.';

export default function DialerScreen({
  sp,
  haptic,
}: {
  sp: any;
  haptic: (s?: ImpactStyle) => Promise<void>;
}) {
  const [num, setNum] = useState('');
  const [dialing, setDialing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diagOpen, setDiagOpen] = useState(false);
  const [c2c, setC2c] = useState<{ enabled: boolean; reason: string | null }>({
    enabled: false,
    reason: CLICK_TO_CALL_FALLBACK_REASON,
  });

  useEffect(() => {
    let cancelled = false;
    mobileApi.clickToCallStatus()
      .then((r) => { if (!cancelled) setC2c({ enabled: !!r.enabled, reason: r.reason || null }); })
      .catch((e) => { if (!cancelled) setC2c({ enabled: false, reason: e?.message || CLICK_TO_CALL_FALLBACK_REASON }); });
    return () => { cancelled = true; };
  }, []);

  const status: string = sp.snap.status || 'connecting';
  const sipError: string = sp.snap.error || '';
  const isRegistered = status === 'registered';
  const isRetrying = status === 'connecting' || status === 'retrying';
  const isFailed = status === 'error';

  const sslLikely = /ssl|certificate|cert|tls|handshake|wss connection failed/i.test(sipError);

  const bannerBg = isRegistered
    ? 'rgba(34,197,94,0.12)'
    : isRetrying
      ? 'rgba(245,158,11,0.12)'
      : 'rgba(239,68,68,0.12)';
  const bannerColor = isRegistered ? '#22c55e' : isRetrying ? '#f59e0b' : '#ef4444';

  const bannerTitle = isRegistered
    ? `✅ Registered — Extension ${sp.sipConfig?.extension || ''}`.trim()
    : isRetrying
      ? '🔄 Connecting...'
      : `❌ Registration failed${sipError ? ` — ${sipError}` : ''}`;

  const startCall = async () => {
    if (!num || dialing) return;
    await haptic(ImpactStyle.Medium);
    audit('call.originated', null, { destination: num, sipStatus: status });
    setDialing(true);
    setError(null);
    try {
      if (!isRegistered) {
        const msg = sipError || 'SIP not registered yet — wait for the green status or tap Retry.';
        setError(msg);
        showMobileToast(msg, 'error');
        return;
      }
      const ok = sp.call(num);
      if (ok === false) {
        const msg = 'Unable to start call via SIP';
        setError(msg);
        showMobileToast(msg, 'error');
      }
    } catch (e: any) {
      const msg = e?.message || 'Unable to start call';
      setError(msg);
      showMobileToast(msg, 'error');
    } finally {
      setDialing(false);
    }
  };

  const startClickToCall = async () => {
    if (!num || !c2c.enabled) return;
    await haptic(ImpactStyle.Medium);
    setError(null);
    try {
      await mobileApi.startCall(num, 'click_to_call' as any);
      showMobileToast('Click-to-call requested — your phone will ring.', 'success');
    } catch (e: any) {
      const msg = e?.message || 'Click-to-call failed';
      setError(msg);
      showMobileToast(msg, 'error');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {diagOpen && <WssDiagnostics config={sp.sipConfig || null} onClose={() => setDiagOpen(false)} />}
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: bannerColor }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {status}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lemtel Telecom</div>
      </div>

      <div style={{ margin: '10px 16px 0', padding: '10px 12px', borderRadius: 12,
        background: bannerBg, border: `1px solid ${bannerColor}55`, color: bannerColor, fontSize: 12,
      }}>
        <div style={{ fontWeight: 700, marginBottom: sipError && !isFailed ? 4 : 0 }}>{bannerTitle}</div>
        {sipError && !isFailed && <div style={{ fontWeight: 400, opacity: 0.9, lineHeight: 1.4 }}>{sipError}</div>}
        {sslLikely && (
          <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8, color: '#fde68a', fontSize: 11, lineHeight: 1.45 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>⚠ SSL certificate problem detected</div>
            Mobile browsers refuse self-signed certificates on WSS. Admin: install a
            CA-signed cert on port 7443, e.g.:
            <pre style={{ margin: '4px 0 0', fontSize: 10, whiteSpace: 'pre-wrap' }}>
{`sudo certbot certonly --standalone -d node.lemtelcloud.net
# point WSS (FreeSWITCH/Kamailio :7443) to fullchain.pem + privkey.pem
# then restart the service`}
            </pre>
          </div>
        )}
        {(isFailed || sslLikely || isRetrying) && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => { haptic(); sp.reconnect?.(); }}
              style={{ background: bannerColor, color: '#fff', border: 'none', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Retry connection
            </button>
            <button
              onClick={() => { haptic(); setDiagOpen(true); }}
              style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', border: '1px solid rgba(255,255,255,0.18)', padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}
            >
              Run WSS diagnostics
            </button>
          </div>
        )}
      </div>


      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', paddingBottom: 16 }}>
        <div style={{ textAlign: 'center', padding: '24px 24px 16px', minHeight: 80 }}>
          <div style={{
            fontSize: num.length > 12 ? 28 : 38,
            fontWeight: 300,
            letterSpacing: 1,
            color: 'white',
            minHeight: 48,
            wordBreak: 'break-all',
          }}>
            {num || <span style={{ color: 'rgba(255,255,255,0.2)' }}>Enter number</span>}
          </div>
        </div>

        <Dialpad
          onPress={(d) => { haptic(ImpactStyle.Light); setNum((n) => n + d); }}
          onLongPressZero={() => setNum((n) => n.slice(0, -1) + '+')}
        />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-evenly', padding: '24px 24px 8px' }}>
          <div style={{ width: 64 }} />
          <button
            disabled={!num || dialing || !isRegistered}
            onClick={startCall}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: !num || dialing || !isRegistered ? 'rgba(34, 197, 94, 0.3)' : 'linear-gradient(135deg, #22c55e, #15803d)',
              border: 'none', cursor: !isRegistered ? 'not-allowed' : 'pointer', color: 'white', fontSize: 30,
              boxShadow: '0 10px 30px rgba(34, 197, 94, 0.4)',
            }}
          >
            {dialing ? '…' : '☏'}
          </button>
          <button
            onClick={() => { haptic(); setNum((n) => n.slice(0, -1)); }}
            disabled={!num}
            style={{
              width: 64, height: 48, borderRadius: 24,
              background: 'transparent', border: 'none', color: num ? 'white' : 'transparent',
              fontSize: 22, cursor: 'pointer',
            }}
          >
            ⌫
          </button>
        </div>

        {(!isRegistered || sslLikely) && (
          <div style={{ padding: '0 24px 8px' }}>
            <button
              onClick={startClickToCall}
              disabled={!num || !c2c.enabled}
              title={!c2c.enabled ? (c2c.reason || CLICK_TO_CALL_FALLBACK_REASON) : 'Ring your desk phone, then connect'}
              style={{
                width: '100%', padding: '12px 14px', borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.16)',
                background: c2c.enabled && num ? 'rgba(59,130,246,0.18)' : 'rgba(255,255,255,0.06)',
                color: c2c.enabled ? '#93c5fd' : 'rgba(255,255,255,0.55)',
                fontWeight: 700, fontSize: 13,
                cursor: c2c.enabled && num ? 'pointer' : 'not-allowed',
              }}
            >
              {c2c.enabled ? 'Use click-to-call instead' : 'Click-to-call unavailable'}
            </button>
            {!c2c.enabled && (
              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                {c2c.reason || CLICK_TO_CALL_FALLBACK_REASON}
              </div>
            )}
          </div>
        )}

        {error && <div style={{ color: 'var(--danger)', textAlign: 'center', fontSize: 12, padding: '0 24px 10px' }}>{error}</div>}
      </div>

    </div>
  );
}

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 20px 8px',
  borderBottom: '1px solid var(--border)',
};
