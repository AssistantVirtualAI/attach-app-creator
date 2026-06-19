import React, { useState } from 'react';
import { ImpactStyle } from '@capacitor/haptics';
import Dialpad from '../components/Dialpad';
import { audit } from '../lib/audit';
import { mobileApi } from '../lib/mobileApi';
import { showMobileToast } from '../lib/mobileToast';

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

  const statusColor =
    sp.snap.status === 'registered' ? 'var(--success)' :
    sp.snap.status === 'error' ? 'var(--danger)' : 'var(--warning)';

  const startCall = async () => {
    if (!num || dialing) return;
    await haptic(ImpactStyle.Medium);
    audit('call.originated', null, { destination: num, sipStatus: sp.snap.status });
    setDialing(true);
    setError(null);
    try {
      if (sp.snap.status === 'registered') {
        const ok = sp.call(num);
        if (ok !== false) return;
      }
      const res = await mobileApi.startCall(num, 'click_to_call');
      showMobileToast(`Deskphone call requested: ${res?.from || 'extension'} → ${res?.to || num}`, 'success');
    } catch (e: any) {
      const msg = e?.message || 'Unable to start call';
      setError(msg);
      showMobileToast(msg, 'error');
    } finally {
      setDialing(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={headerStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: 4, background: statusColor }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
            {sp.snap.status || 'connecting'}
          </span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Lemtel Telecom</div>
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
            disabled={!num || dialing}
            onClick={startCall}
            style={{
              width: 72, height: 72, borderRadius: '50%',
              background: !num || dialing ? 'rgba(34, 197, 94, 0.3)' : 'linear-gradient(135deg, #22c55e, #15803d)',
              border: 'none', cursor: 'pointer', color: 'white', fontSize: 30,
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
