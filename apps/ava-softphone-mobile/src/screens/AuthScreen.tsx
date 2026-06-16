import React, { useState } from 'react';
import type { Creds } from '../lib/creds';
import SipConfigScreen from './SipConfigScreen';

type Mode = 'extension' | 'email';

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (c: Creds) => void }) {
  const [screen, setScreen] = useState<'login' | 'sip'>('login');
  const [mode, setMode] = useState<Mode>('extension');
  const [extension, setExtension] = useState('');
  const [sipDomain, setSipDomain] = useState('');
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '32px 28px', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={logoStyle}>
            <img src="/ava-logo.png" alt="AVA Softphone" width={84} height={84} style={{ display: 'block', borderRadius: 22 }} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, margin: '24px 0 4px', letterSpacing: -0.5, color: '#0E1B3D' }}>Lemtel Telecom</h1>
          <p style={{ fontSize: 13, color: '#42547A', margin: 0 }}>AI Business Phone System</p>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 14, background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border)' }}>
          {(['extension', 'email'] as Mode[]).map((m) => {
            const active = mode === m;
            return (
              <button
                key={m}
                type="button"
                onClick={() => { setMode(m); setError(null); }}
                style={{
                  flex: 1, height: 38, borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 600,
                  background: active ? 'linear-gradient(180deg, #FFFFFF, #EEF4FE)' : 'transparent',
                  color: active ? '#0E1B3D' : '#42547A',
                  boxShadow: active ? '0 4px 12px -6px rgba(0,82,204,0.25)' : 'none',
                }}
              >
                {m === 'extension' ? 'Extension + SIP' : 'Email'}
              </button>
            );
          })}
        </div>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="Portal URL" value={portalUrl} onChange={setPortalUrl} type="url" />
          {mode === 'email' ? (
            <>
              <Field label="Email" value={email} onChange={setEmail} type="email" autoFocus />
              <Field label="Password" value={password} onChange={setPassword} type="password" />
            </>
          ) : (
            <>
              <Field label="Extension" value={extension} onChange={setExtension} type="text" autoFocus placeholder="e.g. 101" />
              <Field label="SIP Domain (optional)" value={sipDomain} onChange={setSipDomain} type="text" placeholder="leave blank if unsure" />
              <Field label="SIP Password" value={password} onChange={setPassword} type="password" />
            </>
          )}

          {error && (
            <div style={{ fontSize: 12, color: 'var(--danger)', padding: '8px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: 8 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={busy || !canSubmit} className="lemtel-shiny-btn" style={{
            marginTop: 8, height: 52, borderRadius: 26,
            fontSize: 16, fontWeight: 700, cursor: 'pointer', letterSpacing: 0.2,
            opacity: busy ? 0.7 : 1,
          }}>
            {busy ? 'Signing in…' : 'Sign In'}
          </button>
          <button type="button" onClick={() => setScreen('sip')} style={{
            marginTop: 4, height: 40, borderRadius: 20, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer',
          }}>
            Manual SIP setup
          </button>
          <p style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--text-muted)', textAlign: 'center' }}>
            {mode === 'extension'
              ? 'Any extension with mobile access enabled can sign in here.'
              : 'Sign in with your portal email and password.'}
          </p>
        </form>
      </div>

      <div style={{ textAlign: 'center', paddingBottom: 'calc(24px + var(--safe-bottom))', fontSize: 11, color: 'var(--text-muted)' }}>
        Powered by <span style={{ color: 'var(--brand-yellow)' }}>AVA Statistic</span> · assistantvirtualai.com
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', autoFocus, placeholder }: any) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</span>
      <input
        type={type}
        value={value}
        autoFocus={autoFocus}
        autoCapitalize="none"
        autoCorrect="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          height: 48, padding: '0 16px', borderRadius: 12,
          background: 'rgba(255,255,255,0.78)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 16, outline: 'none',
          backdropFilter: 'blur(10px)',
        }}
      />
    </label>
  );
}

const wrap: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', minHeight: '100vh',
  background: 'radial-gradient(900px 600px at 50% -10%, rgba(0,82,204,0.18), transparent 60%), linear-gradient(180deg, #F7FAFE 0%, #E8F0FA 100%)',
  paddingTop: 'var(--safe-top)',
};

const logoStyle: React.CSSProperties = {
  width: 92, height: 92, borderRadius: 26, margin: '0 auto',
  background: 'linear-gradient(135deg, rgba(255,255,255,0.92), rgba(235,243,253,0.7))',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  boxShadow: '0 24px 60px -18px rgba(0,82,204,0.40), inset 0 1px 0 rgba(255,255,255,0.9)',
  border: '1px solid rgba(0,61,166,0.10)',
  padding: 4,
};
