/**
 * Embedded mobile-app surface, mounted at /m and loaded inside the
 * <MobilePreview /> iframe. This is a web-safe replica of the mobile
 * app's redesigned auth screen + a stub authenticated shell that
 * responds to `postMessage({ source: 'ava-preview', type: 'set-tab' })`
 * commands from the host. It avoids Capacitor-only imports so it can
 * run in the main web bundle.
 */
import { useEffect, useState } from 'react';

type Tab = 'home' | 'calls' | 'ava' | 'queues' | 'more';
type Mode = 'extension' | 'email';
type Accent = 'gold-cyan' | 'cyan-gold';

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
};

const ACCENT_KEY = 'lemtel-auth-accent';
const loadAccent = (): Accent => {
  try { return (localStorage.getItem(ACCENT_KEY) as Accent) || 'gold-cyan'; }
  catch { return 'gold-cyan'; }
};
const accentGradient = (a: Accent) =>
  a === 'cyan-gold'
    ? 'linear-gradient(135deg, #0BB5D6 0%, #FFD700 100%)'
    : 'linear-gradient(135deg, #FFD700 0%, #0BB5D6 100%)';

export default function MobileEmbed() {
  const [signedIn, setSignedIn] = useState(false);
  const [tab, setTab] = useState<Tab>('home');
  const [subpage, setSubpage] = useState<string | null>(null);
  const [accent, setAccent] = useState<Accent>(loadAccent);
  const [mode, setMode] = useState<Mode>('extension');

  // Apply accent CSS var (used by primary button gradient).
  useEffect(() => {
    document.documentElement.style.setProperty('--auth-accent', accentGradient(accent));
  }, [accent]);

  // Forwarded navigation from /mobile-preview host.
  useEffect(() => {
    const onMsg = (e: MessageEvent) => {
      const d = e.data;
      if (!d || d.source !== 'ava-preview') return;
      if (d.type === 'set-tab' && typeof d.tab === 'string') {
        setSignedIn(true);
        setTab(d.tab as Tab);
        setSubpage(null);
      }
      if (d.type === 'set-subpage' && typeof d.subpage === 'string') {
        setSignedIn(true);
        setTab('more');
        setSubpage(d.subpage);
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  // Auto-skip auth when host says so (?tab=…/?subpage=… already provided).
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      if (sp.get('tab') || sp.get('subpage')) setSignedIn(true);
      const t = sp.get('tab');
      if (t === 'home' || t === 'calls' || t === 'ava' || t === 'queues' || t === 'more') setTab(t);
      const s = sp.get('subpage');
      if (s) { setTab('more'); setSubpage(s); }
    } catch {}
  }, []);

  return (
    <div style={{
      minHeight: '100vh',
      background: `radial-gradient(900px 600px at 50% -10%, rgba(11,181,214,0.10), transparent 60%), ${C.bg}`,
      color: C.text,
      fontFamily: 'Inter, -apple-system, "SF Pro Text", system-ui, sans-serif',
      WebkitFontSmoothing: 'antialiased',
      display: 'flex', flexDirection: 'column',
    }}>
      {signedIn
        ? <SignedInShell tab={tab} subpage={subpage} onTab={(t) => { setTab(t); setSubpage(null); }} onSignOut={() => setSignedIn(false)} />
        : <AuthView mode={mode} setMode={setMode} accent={accent} setAccent={setAccent} onSignIn={() => setSignedIn(true)} />
      }
    </div>
  );
}

/* ===== Auth view (mirrors apps/ava-softphone-mobile/src/screens/AuthScreen.tsx) ===== */
function AuthView({ mode, setMode, accent, setAccent, onSignIn }: {
  mode: Mode; setMode: (m: Mode) => void;
  accent: Accent; setAccent: (a: Accent) => void;
  onSignIn: () => void;
}) {
  return (
    <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Accent switch */}
      <div style={{
        position: 'absolute', top: 8, right: 10, zIndex: 2,
        display: 'flex', gap: 4, padding: 3, borderRadius: 999,
        background: 'rgba(16,26,48,0.65)', border: `1px solid ${C.border}`,
        backdropFilter: 'blur(10px)',
      }}>
        {(['gold-cyan', 'cyan-gold'] as Accent[]).map((a) => {
          const active = accent === a;
          return (
            <button key={a} type="button" onClick={() => { setAccent(a); try { localStorage.setItem(ACCENT_KEY, a); } catch {} }}
              style={{
                border: 'none', cursor: 'pointer',
                padding: '5px 10px', borderRadius: 999,
                fontSize: 10, fontWeight: 800, letterSpacing: 0.6,
                background: active ? accentGradient(a) : 'transparent',
                color: active ? '#0b1530' : C.textSub,
              }}>
              {a === 'gold-cyan' ? 'G→C' : 'C→G'}
            </button>
          );
        })}
      </div>

      {/* Gold glow */}
      <div style={{
        position: 'absolute', top: '10%', left: '50%',
        width: 420, height: 420, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(255,215,0,0.22) 0%, rgba(255,215,0,0.05) 40%, transparent 70%)',
        filter: 'blur(36px)', pointerEvents: 'none', transform: 'translateX(-50%)',
      }} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 20px', position: 'relative', zIndex: 1 }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            width: 84, height: 84, borderRadius: 20, margin: '0 auto',
            background: 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(11,181,214,0.18))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 24px 60px -18px rgba(255,215,0,0.40), inset 0 1px 0 rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,215,0,0.20)', padding: 6,
          }}>
            <img src="/ava-logo.png" alt="Lemtel" width={72} height={72} style={{ borderRadius: 16, display: 'block' }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }} />
          </div>
          <div style={{ marginTop: 14, fontSize: 22, fontWeight: 800, color: C.textIce }}>Lemtel</div>
          <div style={{ marginTop: 4, fontSize: 11, color: C.textSub, letterSpacing: 1.4, textTransform: 'uppercase', fontWeight: 600 }}>AI Business Phone System</div>
        </div>

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 360,
          background: C.bgCard, border: `1px solid ${C.border}`,
          borderRadius: 22, padding: 22,
          boxShadow: '0 25px 60px rgba(0,0,0,0.55)',
          backdropFilter: 'blur(18px)',
        }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', gap: 6, padding: 4, borderRadius: 12, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, marginBottom: 14 }}>
            {(['extension', 'email'] as Mode[]).map((m) => {
              const active = mode === m;
              return (
                <button key={m} type="button" onClick={() => setMode(m)}
                  style={{
                    flex: 1, padding: '9px 10px', borderRadius: 9, cursor: 'pointer',
                    fontSize: 11, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', border: 'none',
                    background: active ? accentGradient(accent) : 'transparent',
                    color: active ? '#0b1530' : C.textSub,
                  }}>
                  {m === 'extension' ? 'Extension' : 'Email'}
                </button>
              );
            })}
          </div>

          {mode === 'email' ? (
            <>
              <PreviewField label="Email" placeholder="you@company.com" />
              <PreviewField label="Password" placeholder="••••••••" type="password" />
            </>
          ) : (
            <>
              <PreviewField label="Extension" placeholder="e.g. 1001" />
              <PreviewField label="SIP Domain" placeholder="lemtel.lemtel.tel" />
              <PreviewField label="SIP Password" placeholder="••••••••" type="password" />
            </>
          )}

          <button onClick={onSignIn}
            style={{
              marginTop: 14, width: '100%', height: 50, borderRadius: 14, border: 'none',
              color: '#0b1530', fontWeight: 800, fontSize: 14, letterSpacing: 0.4, cursor: 'pointer',
              background: accentGradient(accent),
              boxShadow: '0 18px 40px -16px rgba(255,215,0,0.45), inset 0 1px 0 rgba(255,255,255,0.45)',
            }}>
            Sign in
          </button>
          <div style={{ marginTop: 10, fontSize: 10.5, color: C.textDim, lineHeight: 1.5, textAlign: 'center' }}>
            Preview mode — this is a visual mirror of the mobile auth screen.
          </div>
        </div>
      </div>

      <div style={{ padding: '14px 16px 20px', textAlign: 'center', fontSize: 11, color: C.textDim, position: 'relative', zIndex: 1 }}>
        Built by <span style={{ color: C.gold, fontWeight: 600 }}>AVA Statistic · assistantvirtualai.com</span>
      </div>
    </div>
  );
}

function PreviewField({ label, placeholder, type = 'text' }: { label: string; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 10, color: C.textSub, textTransform: 'uppercase', letterSpacing: 1.6, fontWeight: 700 }}>{label}</span>
      <input
        type={type}
        placeholder={placeholder}
        style={{
          height: 48, padding: '0 14px', borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#E8EEFB', fontSize: 15, outline: 'none',
        }}
      />
    </label>
  );
}

/* ===== Stub signed-in shell to visualize tab/subpage navigation ===== */
const TAB_INFO: Record<Tab, { label: string; emoji: string; desc: string }> = {
  home:   { label: 'Home',     emoji: '🏠', desc: 'Dashboard with sync status, KPIs, recent activity.' },
  calls:  { label: 'Calls',    emoji: '📞', desc: 'Recent calls, dialer, contacts.' },
  ava:    { label: 'AVA Chat', emoji: '🤖', desc: 'AI assistant chat & insights.' },
  queues: { label: 'Queues',   emoji: '🎧', desc: 'Live queues, agents status, wait times.' },
  more:   { label: 'More',     emoji: '⋯',  desc: 'Settings, privacy, audit, support.' },
};

function SignedInShell({ tab, subpage, onTab, onSignOut }: {
  tab: Tab; subpage: string | null;
  onTab: (t: Tab) => void; onSignOut: () => void;
}) {
  const info = TAB_INFO[tab];
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: C.textSub, textTransform: 'uppercase', letterSpacing: 1.2, fontWeight: 700 }}>{subpage ? 'More → Subpage' : 'Tab'}</div>
          <div style={{ fontSize: 17, fontWeight: 800, color: C.textIce }}>{subpage ? subpage : info.label}</div>
        </div>
        <button onClick={onSignOut} style={{ background: 'transparent', border: `1px solid ${C.border}`, color: C.textSub, fontSize: 11, padding: '6px 10px', borderRadius: 999, cursor: 'pointer' }}>Sign out</button>
      </header>

      <div style={{ flex: 1, padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{
          padding: 18, borderRadius: 16,
          background: C.bgCard, border: `1px solid ${C.border}`,
          boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
        }}>
          <div style={{ fontSize: 32 }}>{info.emoji}</div>
          <div style={{ marginTop: 6, fontSize: 16, fontWeight: 800, color: C.textIce }}>
            {subpage ? subpage[0].toUpperCase() + subpage.slice(1) : info.label}
          </div>
          <div style={{ marginTop: 4, fontSize: 13, color: C.textSub, lineHeight: 1.5 }}>
            {subpage
              ? `Mobile subpage preview — "${subpage}" content renders here in the real app.`
              : info.desc}
          </div>
        </div>

        <div style={{ fontSize: 11, color: C.textDim, lineHeight: 1.5 }}>
          This is a preview shell. Use the tab + subpage buttons in the host to navigate.
        </div>
      </div>

      <nav style={{
        display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 4, padding: '6px 8px 14px',
        borderTop: `1px solid ${C.border}`,
        background: 'rgba(10,20,41,0.85)',
        backdropFilter: 'blur(12px)',
      }}>
        {(Object.keys(TAB_INFO) as Tab[]).map((t) => {
          const active = t === tab && !subpage;
          return (
            <button key={t} onClick={() => onTab(t)}
              style={{
                background: 'transparent', border: 'none', cursor: 'pointer',
                padding: '8px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                color: active ? C.gold : C.textSub,
                fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
              }}>
              <span style={{ fontSize: 16 }}>{TAB_INFO[t].emoji}</span>
              {TAB_INFO[t].label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
