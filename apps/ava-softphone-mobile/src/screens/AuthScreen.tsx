import React, { useEffect, useState } from 'react';
import type { Creds } from '../lib/creds';
import SipConfigScreen from './SipConfigScreen';

type Mode = 'extension' | 'email';
type Screen = 'login' | 'sip' | 'forgot';
type ForgotStep = 'form' | 'confirm' | 'sent';
type Accent = 'gold-cyan' | 'cyan-gold';

const ACCENT_KEY = 'lemtel-auth-accent';
const loadAccent = (): Accent => {
  try {
    const v = localStorage.getItem(ACCENT_KEY);
    return v === 'cyan-gold' ? 'cyan-gold' : 'gold-cyan';
  } catch { return 'gold-cyan'; }
};
const saveAccent = (a: Accent) => { try { localStorage.setItem(ACCENT_KEY, a); } catch {} };
const accentGradient = (a: Accent) =>
  a === 'cyan-gold'
    ? 'linear-gradient(135deg, #0BB5D6 0%, #FFD700 100%)'
    : 'linear-gradient(135deg, #FFD700 0%, #0BB5D6 100%)';

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
  green: '#22C55E',
  red: '#EF4444',
};

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.trim());

const mapAuthError = (raw: string): string => {
  const m = (raw || '').toLowerCase();
  if (m.includes('invalid_credentials') || m.includes('invalid login')) return 'Wrong email or password.';
  if (m.includes('extension_not_found')) return 'Extension not found.';
  if (m.includes('app_access_disabled') || m.includes('mobile_access_disabled')) return 'Mobile access has not been enabled for this extension. Contact your admin.';
  if (m.includes('ambiguous_extension')) return 'Multiple extensions match — please enter the SIP domain.';
  if (m.includes('rate') && m.includes('limit')) return 'Too many attempts. Please wait a moment and try again.';
  if (m.includes('network') || m.includes('failed to fetch')) return 'Network error — check your connection.';
  if (m.includes('session') || m.includes('jwt')) return 'Your session expired. Please sign in again.';
  return raw || 'Something went wrong. Please try again.';
};

export default function AuthScreen({ onAuthenticated }: { onAuthenticated: (c: Creds) => void }) {
  const [screen, setScreen] = useState<Screen>('login');
  const [mode, setMode] = useState<Mode>('extension');
  const [extension, setExtension] = useState('');
  const [sipDomain, setSipDomain] = useState('lemtel.lemtel.tel');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [portalUrl, setPortalUrl] = useState('https://avastatistic.ca');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [accent, setAccent] = useState<Accent>(loadAccent);

  // Persist + cascade accent gradient as a CSS variable.
  useEffect(() => {
    saveAccent(accent);
    document.documentElement.style.setProperty('--auth-accent', accentGradient(accent));
  }, [accent]);

  if (screen === 'sip') {
    return <SipConfigScreen onSaved={onAuthenticated} onCancel={() => setScreen('login')} />;
  }
  if (screen === 'forgot') {
    return <ForgotPasswordScreen initialEmail={email} accent={accent} onBack={() => setScreen('login')} />;
  }

  const base = portalUrl.replace(/\/$/, '');

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (mode === 'email') {
      if (!email.trim()) errs.email = 'Email is required.';
      else if (!isEmail(email)) errs.email = 'Enter a valid email address.';
      if (!password) errs.password = 'Password is required.';
      else if (password.length < 6) errs.password = 'Password must be at least 6 characters.';
    } else {
      if (!extension.trim()) errs.extension = 'Extension is required.';
      if (!password) errs.password = 'SIP password is required.';
    }
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitEmail = async () => {
    const res = await fetch(`${base}/functions/v1/softphone-auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Sign-in failed');
    onAuthenticated({ ...data, portalUrl, email: email.trim() });
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
      throw new Error(data?.error || 'Sign-in failed');
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
    if (!validate()) return;
    setBusy(true);
    try {
      if (mode === 'email') await submitEmail();
      else await submitExtension();
    } catch (e: any) {
      setError(mapAuthError(e?.message));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = mode === 'email' ? !!email && !!password : !!extension && !!password;

  return (
    <div style={wrap}>
      <AccentSwitch accent={accent} onChange={setAccent} />
      <GoldGlow />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        <Brand />

        <div style={cardStyle}>
          <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <ModeToggle mode={mode} accent={accent} onChange={(m) => { setMode(m); setError(null); setFieldErrors({}); }} />


            <Field label="Portal URL" value={portalUrl} onChange={setPortalUrl} type="url" />
            {mode === 'email' ? (
              <>
                <Field label="Email" value={email} onChange={(v) => { setEmail(v); setFieldErrors((f) => ({ ...f, email: '' })); }} type="email" placeholder="you@company.com" autoFocus error={fieldErrors.email} />
                <Field label="Password" value={password} onChange={(v) => { setPassword(v); setFieldErrors((f) => ({ ...f, password: '' })); }} type="password" placeholder="••••••••" error={fieldErrors.password} />
              </>
            ) : (
              <>
                <Field label="Extension" value={extension} onChange={(v) => { setExtension(v); setFieldErrors((f) => ({ ...f, extension: '' })); }} placeholder="e.g. 1001" autoFocus error={fieldErrors.extension} />
                <Field label="SIP Domain" value={sipDomain} onChange={setSipDomain} placeholder="lemtel.lemtel.tel" />
                <Field label="SIP Password" value={password} onChange={(v) => { setPassword(v); setFieldErrors((f) => ({ ...f, password: '' })); }} type="password" placeholder="••••••••" error={fieldErrors.password} />
              </>
            )}

            {error && <ErrorBanner>{error}</ErrorBanner>}

            <button
              type="submit"
              disabled={busy || !canSubmit}
              className="lemtel-btn-primary"
              style={{ marginTop: 6, height: 50, borderRadius: 14, fontSize: 14, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
            >
              {busy && <Spinner />}
              {busy ? 'Connecting…' : 'Sign in'}
            </button>

            {mode === 'email' && (
              <button
                type="button"
                onClick={() => setScreen('forgot')}
                style={ghostLink}
              >
                Forgot your password?
              </button>
            )}

            <button
              type="button"
              onClick={() => setScreen('sip')}
              style={ghostBtn}
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

      <Footer />
    </div>
  );
}

/* ====== Forgot password screen ====== */
const RESEND_COOLDOWN_SECONDS = 30;

function ForgotPasswordScreen({ initialEmail, accent, onBack }: { initialEmail: string; accent: Accent; onBack: () => void }) {
  const [step, setStep] = useState<ForgotStep>('form');
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErr, setFieldErr] = useState<string>('');
  const [cooldown, setCooldown] = useState(0);
  const [resentInfo, setResentInfo] = useState<string | null>(null);

  // Cooldown countdown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const goConfirm = () => {
    setError(null);
    if (!email.trim()) { setFieldErr('Email is required.'); return; }
    if (!isEmail(email)) { setFieldErr('Enter a valid email address.'); return; }
    setFieldErr('');
    setStep('confirm');
  };

  const sendReset = async (opts?: { resend?: boolean }) => {
    if (busy || cooldown > 0) return; // multi-click guard
    setBusy(true); setError(null); setResentInfo(null);
    try {
      const redirectTo = 'https://avastatistic.ca/reset-password';
      const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ email: email.trim(), redirect_to: redirectTo }),
      });
      if (!res.ok) {
        let detail: any = null; try { detail = await res.json(); } catch {}
        throw new Error(detail?.msg || detail?.error || `HTTP ${res.status}`);
      }
      setCooldown(RESEND_COOLDOWN_SECONDS);
      if (opts?.resend) setResentInfo('Reset email sent again.');
      setStep('sent');
    } catch (e: any) {
      setError(mapAuthError(e?.message));
      if (!opts?.resend) setStep('form');
    } finally { setBusy(false); }
  };

  return (
    <div style={wrap}>
      <GoldGlow />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        <Brand />
        <div style={cardStyle}>
          {step === 'form' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h2 style={headingStyle}>Reset password</h2>
                <p style={subheadingStyle}>Enter your account email and we’ll send you a reset link.</p>
              </div>
              <Field
                label="Email"
                value={email}
                onChange={(v) => { setEmail(v); setFieldErr(''); }}
                type="email"
                placeholder="you@company.com"
                autoFocus
                error={fieldErr}
              />
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                type="button"
                onClick={goConfirm}
                disabled={!email}
                className="lemtel-btn-primary"
                style={{ height: 50, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}
              >
                Continue
              </button>
              <button type="button" onClick={onBack} style={ghostBtn}>Back to sign in</button>
            </div>
          )}

          {step === 'confirm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <h2 style={headingStyle}>Send reset link?</h2>
                <p style={subheadingStyle}>We’ll email a one-time password reset link to:</p>
                <div style={{ marginTop: 8, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, color: C.textIce, fontWeight: 600, fontSize: 14, wordBreak: 'break-all' }}>{email}</div>
              </div>
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                type="button"
                onClick={() => sendReset()}
                disabled={busy}
                className="lemtel-btn-primary"
                style={{ height: 50, borderRadius: 14, fontSize: 14, cursor: busy ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                {busy && <Spinner />}
                {busy ? 'Sending…' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => setStep('form')} style={ghostBtn} disabled={busy}>Cancel</button>
            </div>
          )}

          {step === 'sent' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%', margin: '4px auto 0',
                background: 'rgba(34,197,94,0.14)', border: `1px solid rgba(34,197,94,0.35)`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: C.green, fontSize: 26, fontWeight: 800,
              }}>✓</div>
              <h2 style={{ ...headingStyle, textAlign: 'center' }}>Check your inbox</h2>
              <p style={{ ...subheadingStyle, textAlign: 'center' }}>
                If an account exists for <strong style={{ color: C.textIce }}>{email}</strong>, you’ll receive a reset link shortly. Open it on this device or a desktop browser to set a new password.
              </p>
              {resentInfo && (
                <div style={{
                  fontSize: 12, color: C.green,
                  padding: '8px 12px', borderRadius: 10,
                  background: 'rgba(34,197,94,0.10)',
                  border: '1px solid rgba(34,197,94,0.25)',
                }}>{resentInfo}</div>
              )}
              {error && <ErrorBanner>{error}</ErrorBanner>}
              <button
                type="button"
                onClick={() => sendReset({ resend: true })}
                disabled={busy || cooldown > 0}
                style={{
                  height: 44, borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: 'rgba(255,255,255,0.04)',
                  color: cooldown > 0 ? C.textDim : C.textIce,
                  fontSize: 13, fontWeight: 700, letterSpacing: 0.3,
                  cursor: (busy || cooldown > 0) ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  opacity: (busy || cooldown > 0) ? 0.7 : 1,
                  transition: 'opacity .15s ease',
                }}
              >
                {busy && <Spinner />}
                {busy
                  ? 'Sending…'
                  : cooldown > 0
                    ? `Resend email in ${cooldown}s`
                    : 'Resend email'}
              </button>
              <button type="button" onClick={onBack} className="lemtel-btn-primary" style={{ height: 50, borderRadius: 14, fontSize: 14, cursor: 'pointer' }}>
                Back to sign in
              </button>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}

/* ====== Reusable parts ====== */
function GoldGlow() {
  return (
    <div style={{
      position: 'absolute', top: '10%', left: '50%',
      width: 420, height: 420, borderRadius: '50%',
      background: 'radial-gradient(circle, rgba(255,215,0,0.22) 0%, rgba(255,215,0,0.05) 40%, transparent 70%)',
      filter: 'blur(36px)', animation: 'authGlow 6s ease-in-out infinite',
      pointerEvents: 'none', transform: 'translateX(-50%)',
    }} />
  );
}

function Brand() {
  return (
    <div style={{ textAlign: 'center', marginBottom: 24 }}>
      <div style={logoStyle}>
        <img src="/ava-logo.png" alt="Lemtel" width={72} height={72} style={{ display: 'block', borderRadius: 16 }} />
      </div>
      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: C.textIce, letterSpacing: 0.2 }}>Lemtel</div>
      <div style={{ marginTop: 4, fontSize: 11, color: C.textSub, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>AI Business Phone System</div>
    </div>
  );
}

function Footer() {
  return (
    <div style={{
      padding: '14px 16px calc(20px + var(--safe-bottom))', textAlign: 'center',
      fontSize: 11, color: C.textDim, letterSpacing: 0.4,
      position: 'relative', zIndex: 1,
    }}>
      Built by <span style={{ color: C.gold, fontWeight: 600 }}>AVA Statistic · assistantvirtualai.com</span>
    </div>
  );
}

function ModeToggle({ mode, onChange }: { mode: Mode; onChange: (m: Mode) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}` }}>
      {(['extension', 'email'] as Mode[]).map((m) => {
        const active = mode === m;
        return (
          <button
            key={m}
            type="button"
            onClick={() => onChange(m)}
            style={{
              flex: 1, padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
              fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase',
              border: 'none',
              background: active ? `linear-gradient(135deg, ${C.gold}, ${C.avaCyan})` : 'transparent',
              color: active ? '#0b1530' : C.textSub,
              transition: 'background .15s ease, color .15s ease',
            }}
          >
            {m === 'extension' ? 'Extension' : 'Email'}
          </button>
        );
      })}
    </div>
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 12, color: C.red,
      padding: '10px 14px', borderRadius: 10,
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.22)',
    }}>{children}</div>
  );
}

function Spinner() {
  return (
    <span
      aria-hidden
      style={{
        width: 14, height: 14, borderRadius: '50%',
        border: '2px solid rgba(11,21,48,0.25)', borderTopColor: '#0b1530',
        animation: 'spin 0.7s linear infinite', display: 'inline-block',
      }}
    />
  );
}

function Field({ label, value, onChange, type = 'text', autoFocus, placeholder, error }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; autoFocus?: boolean; placeholder?: string; error?: string;
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
        style={error ? { borderColor: 'rgba(239,68,68,0.55)' } : undefined}
      />
      {error && <span style={{ fontSize: 11, color: C.red, marginTop: 2 }}>{error}</span>}
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

const cardStyle: React.CSSProperties = {
  width: '100%', maxWidth: 360,
  background: C.bgCard,
  border: `1px solid ${C.border}`,
  borderRadius: 22, padding: 22,
  boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
  backdropFilter: 'blur(18px)',
  WebkitBackdropFilter: 'blur(18px)',
  animation: 'fadeIn .4s ease-out',
};

const ghostBtn: React.CSSProperties = {
  marginTop: 2, height: 38, borderRadius: 12,
  border: `1px solid ${C.border}`,
  background: 'transparent', color: C.textSub,
  fontSize: 12, fontWeight: 600, letterSpacing: 0.4, cursor: 'pointer',
};

const ghostLink: React.CSSProperties = {
  height: 30, border: 'none', background: 'transparent',
  color: C.avaCyan, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  textDecoration: 'underline', textUnderlineOffset: 3,
};

const headingStyle: React.CSSProperties = {
  margin: 0, fontSize: 18, fontWeight: 800, color: C.textIce, letterSpacing: 0.2,
};

const subheadingStyle: React.CSSProperties = {
  margin: '6px 0 0', fontSize: 12.5, color: C.textSub, lineHeight: 1.5,
};
