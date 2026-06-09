import React, { useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';

const { colors: c } = theme;

type Action = {
  id: string;
  prompt: string;
  interpreted_action: string | null;
  proposed_changes_json: any;
  confirmation_status: 'pending' | 'confirmed' | 'rejected';
  execution_status: 'pending' | 'success' | 'failed';
  execution_result_json: any;
  created_at: string;
  executed_at: string | null;
};

async function callAgent(body: any) {
  const { data, error } = await supabase.functions.invoke('telecom-admin-ai-agent', { body });
  if (error) throw error;
  if (data?.error) throw new Error(data.detail || data.error);
  return data;
}

export default function AdminAIChatView() {
  const [prompt, setPrompt] = useState('');
  const [actions, setActions] = useState<Action[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) { setIsAdmin(false); return; }
      const { data: roles } = await supabase.from('user_roles')
        .select('role').eq('user_id', u.user.id)
        .in('role', ['org_admin', 'super_admin']);
      setIsAdmin((roles?.length ?? 0) > 0);
      const { data: a } = await supabase.from('telecom_admin_ai_actions')
        .select('*').order('created_at', { ascending: false }).limit(20);
      setActions((a as Action[]) ?? []);
    })();
  }, []);

  const propose = async () => {
    if (!prompt.trim()) return;
    setLoading(true); setErr(null);
    try {
      const r = await callAgent({ mode: 'propose', prompt: prompt.trim() });
      setActions((a) => [r.action, ...a]);
      setPrompt('');
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const confirm = async (id: string) => {
    setLoading(true); setErr(null);
    try {
      const r = await callAgent({ mode: 'execute', action_id: id });
      setActions((arr) => arr.map((x) => x.id === id ? r.action : x));
    } catch (e: any) { setErr(e.message); }
    finally { setLoading(false); }
  };

  const reject = async (id: string) => {
    await supabase.from('telecom_admin_ai_actions').update({ confirmation_status: 'rejected' }).eq('id', id);
    setActions((arr) => arr.map((x) => x.id === id ? { ...x, confirmation_status: 'rejected' } : x));
  };

  if (isAdmin === false) {
    return <div style={{ padding: 32, color: c.mutedSilver, fontSize: 13 }}>Admin-only area.</div>;
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <header style={{ padding: '18px 28px', borderBottom: `1px solid ${c.border}` }}>
        <h1 style={{ fontSize: 20, color: c.textIce, margin: 0 }}>AVA AI · Telecom Admin</h1>
        <div style={{ fontSize: 12, color: c.mutedSilver, marginTop: 4 }}>
          Ask AVA to manage business hours, holidays, IVRs, users, DIDs, queues. Every change requires explicit confirmation.
        </div>
      </header>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        {err && <div style={{ padding: 10, marginBottom: 14, background: 'rgba(239,68,68,0.12)', border: `1px solid ${c.danger}55`, borderRadius: 8, color: c.danger, fontSize: 12 }}>{err}</div>}

        {actions.length === 0 && (
          <div style={{ color: c.mutedSilver, fontSize: 12, textAlign: 'center', marginTop: 40 }}>
            Try: <i>"Set business hours Mon–Fri 9 to 5"</i> · <i>"Create a Christmas holiday Dec 24–26"</i>
          </div>
        )}

        {actions.map((a) => (
          <article key={a.id} style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 11, color: c.signalGold, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                  {a.interpreted_action ?? 'Proposed action'}
                </div>
                <div style={{ fontSize: 13, color: c.textIce, marginTop: 4 }}>{a.prompt}</div>
              </div>
              <Status conf={a.confirmation_status} exec={a.execution_status} />
            </div>
            <pre style={{
              marginTop: 12, padding: 12, borderRadius: 8, background: 'rgba(0,0,0,0.35)',
              color: c.mutedSilver, fontSize: 11, overflow: 'auto', maxHeight: 200,
              fontFamily: 'JetBrains Mono, monospace',
            }}>{JSON.stringify(a.proposed_changes_json, null, 2)}</pre>
            {a.execution_result_json && (
              <pre style={{
                marginTop: 8, padding: 12, borderRadius: 8,
                background: a.execution_status === 'success' ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
                color: c.textIce, fontSize: 11, overflow: 'auto', maxHeight: 160,
                fontFamily: 'JetBrains Mono, monospace',
              }}>{JSON.stringify(a.execution_result_json, null, 2)}</pre>
            )}
            {a.confirmation_status === 'pending' && (
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button onClick={() => confirm(a.id)} disabled={loading} style={primaryBtn}>Confirm & execute</button>
                <button onClick={() => reject(a.id)} disabled={loading} style={ghostBtn}>Reject</button>
              </div>
            )}
          </article>
        ))}
      </div>

      <div style={{ padding: 14, borderTop: `1px solid ${c.border}`, display: 'flex', gap: 8 }}>
        <input value={prompt} onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') propose(); }}
          placeholder="Tell AVA what to change…"
          disabled={loading}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 9, border: `1px solid ${c.border}`, background: 'rgba(140,180,255,0.06)', color: c.textIce, fontSize: 13 }} />
        <button onClick={propose} disabled={loading || !prompt.trim()} style={{
          ...primaryBtn, opacity: loading || !prompt.trim() ? 0.5 : 1,
        }}>{loading ? '…' : 'Propose'}</button>
      </div>
    </div>
  );
}

function Status({ conf, exec }: { conf: string; exec: string }) {
  const map: Record<string, [string, string]> = {
    'pending|pending': ['Awaiting confirm', c.signalGold],
    'confirmed|pending': ['Executing…', c.signalGold],
    'confirmed|success': ['Executed ✓', c.success],
    'confirmed|failed': ['Failed', c.danger],
    'rejected|pending': ['Rejected', c.mutedSilver],
  };
  const k = `${conf}|${exec}`;
  const [label, color] = map[k] ?? [`${conf}/${exec}`, c.mutedSilver];
  return <span style={{ fontSize: 11, fontWeight: 700, color, letterSpacing: 0.6 }}>{label}</span>;
}

const primaryBtn: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 9, border: 'none', cursor: 'pointer', color: '#fff', fontWeight: 700, fontSize: 12,
  background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
};
const ghostBtn: React.CSSProperties = {
  padding: '9px 14px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 600,
  background: 'transparent', color: c.mutedSilver, border: `1px solid ${c.border}`,
};
