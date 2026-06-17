import React, { useState } from 'react';
import type { Creds } from '../lib/creds';
import SipConfigScreen from './SipConfigScreen';

type Mode = 'extension' | 'email';

// Desktop-parity palette
const C = {
  bg: '#0A1429',
  bgCard: 'rgba(16,26,48,0.78)',
  border: 'rgba(255,255,255,0.08)',
  text: '#E8EEFB',
  textIce: '#F4F8FF',
  textSub: 'rgba(232,238,251,0.62)',
  textDim: 'rgba(232,238,251,0.42)',
  gold: '#FFD700',
  avaCyan: '#0BB5D6',
  red: '#EF4444',
};

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (c: Creds) => void }) {
  const [screen, setScreen] = useState<'login' | 'sip'>('login');
  const [mode, setMode] = useState<Mode>('extension');
  const [extension, setExtension] = useState('');
  const [sipDomain, setSipDomain] = useState('lemtel.lemtel.tel');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [portalUrl, setPortalUrl] = useState('https://avastatistic.ca');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (screen === 'sip') {
    return <SipConfigScreen onSaved={onAuthenticated} onCancel={() => setScreen('login')} />;
  }

  const base = portalUrl.replace(/\/$/, '');

  const submitEmail = async () => {
    const res = await fetch(`${base}/functions/v1/softphone-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Sign-in failed');
    onAuthenticated({ ...data, portalUrl, email });
  };

  const submitExtension = async () => {
    const res = await fetch(`${base}/functions/v1/extension-signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        extension: extension.trim(),
        password,
        sip_domain: sipDomain.trim() || undefined,
        platform: 'mobile',
      }),
    });
    const data = await res.json();
    if (!res.ok || !data?.access_token) {
      const friendly =
        data?.error === 'invalid_credentials' ? 'Wrong extension or password.' :
        data?.error === 'extension_not_found' ? 'Extension not found.' :
        data?.error === 'app_access_disabled' || data?.error === 'mobile_access_disabled'
          ? 'Mobile access has not been enabled for this extension. Contact your admin.' :
        data?.error === 'ambiguous_extension' ? 'Multiple extensions match — please enter the SIP domain.' :
        (data?.error || 'Sign-in failed');
      throw new Error(friendly);
    }
    onAuthenticated({
      portalUrl,
      email: data.email,
      extension: data.extension,
      displayName: data.display_name,
      sipDomain: data.sip_domain,
      wssUrl: data.wss_url,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      userId: data.user_id,
      organizationId: data.organization_id,
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'email') await submitEmail();
      else await submitExtension();
    } catch (e: any) {
      setError(e?.message || 'Unable to sign in');
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = mode === 'email' ? !!email && !!password : !!extension && !!password;

  return (
    <div style={wrap}>
      {/* Gold radial glow */}
      <div style={{
        position: 'absolute',
        top: '10%', left: '50%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.22) 0%, rgba(255,215,0,0.05) 40%, transparent 70%)',
        filter: 'blur(36px)',
        animation: 'authGlow 6s ease-in-out infinite',
        pointerEvents: 'none',
        transform: 'translateX(-50%)',
      }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={logoStyle}>
            <img src="/ava-logo.png" alt="Lemtel" width={72} height={72} style={{ display: 'block', borderRadius: 16 }} />
          </div>
          <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: C.textIce, letterSpacing: 0.2 }}>Lemtel</div>
          <div style={{ marginTop: 4, fontSize: 11, color: C.textSub, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>AI Business Phone System</div>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 360,
          background: C.bgCard,
          border: `1px solid ${C.border}`,
          borderRadius: 22, padding: 22,
          boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          animation: 'fadeIn .4s ease-out',
        }}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
              {(['extension', 'email'] as Mode[]).map((m) => {
                const active = mode === m;
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => { setMode(m); setError(null); }}
                    style={{
                      flex: 1, padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
                      fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
                      border: 'none',
                      background: active ? `linear-gradient(135deg, ${C.gold}, ${C.avaCyan})` : 'transparent',
                      color: active ? '#0b1530' : C.textSub,
                    }}
                  >
                    {m === 'extension' ? 'Extension' : 'Email'}
                  </button>
                );
              })}
            </div>

            <Field label="Portal URL" value={portalUrl} onChange={setPortalUrl} type="url" />
            {mode === 'email' ? (
              <>
                <Field label="Email" value={email} onChange={setEmail} type="email" placeholder="you@company.com" autoFocus />
                <Field label="Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
              </>
            ) : (
              <>
                <Field label="Extension" value={extension} onChange={setExtension} placeholder="e.g. 1001" autoFocus />
                <Field label="SIP Domain" value={sipDomain} onChange={setSipDomain} placeholder="lemtel.lemtel.tel" />
                <Field label="SIP Password" value={password} onChange={setPassword} type="password" placeholder="••••••••" />
              </>
            )}

            {error && (
              <div style={{
                fontSize: 12, color: C.red,
                padding: '10px 14px', borderRadius: 10,
                background: 'rgba(239,68,68,0.10)',
                border: '1px solid rgba(239,68,68,0.22)',
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="lemtel-btn-primary"
              style={{ marginTop: 6, height: 50, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
            >
              {busy ? 'Connecting…' : 'Sign in'}
            </button>

            <button
              type="button"
              onClick={() => setScreen('sip')}
              style={{
                marginTop: 2, height: 38, borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: 'transparent', color: C.textSub,
                fontSize: 12, fontWeight: 600, letterSpacing: 0.4, cursor: 'pointer',
              }}
            >
              Manual SIP setup
            </button>

            <div style={{ fontSize: 10.5, color: C.textDim, lineHeight: 1.5, textAlign: 'center', marginTop: 2 }}>
              {mode === 'extension'
                ? 'Use the same SIP password defined on your extension in the portal (or in FusionPBX). If you don\u2019t have one, ask your administrator to set it on your extension.'
                : 'Sign in with the email and password tied to your Lemtel portal account.'}
            </div>
          </form>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '14px 16px calc(20px + var(--safe-bottom))', textAlign: 'center',
        fontSize: 11, color: C.textDim, letterSpacing: 0.4,
        position: 'relative', zIndex: 1,
      }}>
        Built by <span style={{ color: C.gold, fontWeight: 600 }}>AVA Statistic · assistantvirtualai.com</span>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', autoFocus, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; autoFocus?: boolean; placeholder?: string;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 10, color: C.textSub, textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 700 }}>{label}</span>
      <input
        className="lemtel-input"
        type={type}
        value={value}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', minHeight: '100vh',
  background: `radial-gradient(900px 600px at 50% -10%, rgba(11,181,214,0.10), transparent 60%), ${C.bg}`,
  color: C.text,
  paddingTop: 'var(--safe-top)',
  position: 'relative', overflow: 'hidden',
};

const logoStyle: React.CSSProperties = {
  width: 84, height: 84, borderRadius: 20, margin: '0 auto',
  background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(11,181,214,0.18))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 24px 60px -18px rgba(255,215,0,0.40), inset 0 1px 0 rgba(255,255,255,0.18)',
  border: '1px solid rgba(255,215,0,0.20)',
  padding: 6,
};
