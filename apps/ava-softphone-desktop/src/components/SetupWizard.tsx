import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';

type Step = 1 | 2 | 3;
type Creds = { portalUrl: string; email: string; extension: string };

export default function SetupWizard({
  onComplete,
}: {
  onComplete: (c: Creds) => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [portalUrl, setPortalUrl] = useState('https://avastatistic.ca');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [extension, setExtension] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [launchOnStartup, setLaunchOnStartup] = useState(true);

  async function connect() {
    setError(null);
    setLoading(true);
    try {
      const configRes = await fetch(`${portalUrl}/api/supabase-config`);
      if (!configRes.ok) {
        throw new Error('Portal not configured. Reinstall the app.');
      }
      const { supabase_url, supabase_anon_key } = await configRes.json();
      if (!supabase_url || !supabase_anon_key) {
        throw new Error('Portal not configured. Reinstall the app.');
      }
      const supabase = createClient(supabase_url, supabase_anon_key);
      const { data, error: signErr } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signErr || !data.user) throw signErr ?? new Error('Sign-in failed');

      const { data: row, error: rowErr } = await supabase
        .from('pbx_softphone_users')
        .select('extension')
        .eq('portal_user_id', data.user.id)
        .maybeSingle();
      if (rowErr) throw rowErr;
      if (!row?.extension) throw new Error('No extension assigned to this user.');

      setExtension(String(row.extension));
      await window.electronAPI.saveCredentials({
        portalUrl,
        email,
        extension: row.extension,
      });
      setStep(3);
    } catch (e: any) {
      setError(e?.message ?? 'Connection failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={wrap}>
      {step === 1 && (
        <>
          <div style={logo}>AVA</div>
          <h1 style={h1}>Welcome to AVA Softphone</h1>
          <p style={sub}>Your professional communication app</p>
          <button style={primary} onClick={() => setStep(2)}>
            Get Started →
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <h2 style={h2}>Connect Your Account</h2>
          <label style={lbl}>AVA Portal URL</label>
          <input
            style={input}
            value={portalUrl}
            onChange={(e) => setPortalUrl(e.target.value)}
          />
          <label style={lbl}>Email</label>
          <input
            style={input}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <label style={lbl}>Password</label>
          <input
            style={input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <div style={err}>{error}</div>}
          <button style={primary} disabled={loading} onClick={connect}>
            {loading ? 'Connecting…' : 'Connect & Sign In'}
          </button>
        </>
      )}

      {step === 3 && (
        <>
          <h2 style={h2}>You're all set</h2>
          <div style={ok}>✅ Connected to AVA Portal</div>
          <div style={ok}>✅ Extension: {extension} registered</div>
          <div style={ok}>✅ SIP: Connected to portal.lemtel.tel</div>
          <p style={sub}>Your softphone is ready.</p>

          <label style={{ ...lbl, display: 'flex', gap: 8, alignItems: 'center' }}>
            <input
              type="checkbox"
              checked={launchOnStartup}
              onChange={(e) => setLaunchOnStartup(e.target.checked)}
            />
            Launch AVA Softphone on startup
          </label>

          <button
            style={primary}
            onClick={async () => {
              await window.electronAPI.setLaunchOnStartup(launchOnStartup);
              onComplete({ portalUrl, email, extension });
            }}
          >
            Launch App →
          </button>
        </>
      )}
    </div>
  );
}

const wrap: React.CSSProperties = {
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 10,
  minHeight: 'calc(100vh - 32px)',
  justifyContent: 'center',
};
const logo: React.CSSProperties = {
  fontSize: 48,
  fontWeight: 800,
  letterSpacing: 4,
  textAlign: 'center',
  color: '#0023e6',
};
const h1: React.CSSProperties = { fontSize: 22, margin: 0, textAlign: 'center' };
const h2: React.CSSProperties = { fontSize: 18, margin: '0 0 12px' };
const sub: React.CSSProperties = {
  opacity: 0.7,
  fontSize: 13,
  textAlign: 'center',
  margin: 0,
};
const lbl: React.CSSProperties = { fontSize: 12, opacity: 0.8, marginTop: 8 };
const input: React.CSSProperties = {
  padding: '8px 10px',
  background: '#15151f',
  border: '1px solid #2a2a3a',
  borderRadius: 6,
  color: '#fff',
};
const primary: React.CSSProperties = {
  marginTop: 16,
  padding: '10px 14px',
  background: '#0023e6',
  border: 0,
  borderRadius: 6,
  color: '#fff',
  fontWeight: 600,
  cursor: 'pointer',
};
const err: React.CSSProperties = {
  color: '#ff6b6b',
  fontSize: 12,
  marginTop: 6,
};
const ok: React.CSSProperties = { fontSize: 14, margin: '4px 0' };
