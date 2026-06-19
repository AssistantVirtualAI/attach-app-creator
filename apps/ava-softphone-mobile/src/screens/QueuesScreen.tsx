import React, { useEffect, useMemo, useState } from 'react';
import { LogIn, LogOut, Pause, Play, Search } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { colors, font, radius, gradients } from '../lib/theme';
import { mobileApi, QueueRow } from '../lib/mobileApi';
import { Card, Chip, SectionTitle, EmptyState, Skeleton } from '../components/ui/Primitives';
import { useAutoSync } from '../hooks/useAutoSync';
import { getCredentials } from '../lib/creds';
import { showMobileToast } from '../lib/mobileToast';

const SUPABASE_URL = 'https://gejxisrqtvxavbrfcoxz.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdlanhpc3JxdHZ4YXZicmZjb3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE1MDMxNzQsImV4cCI6MjA3NzA3OTE3NH0.kaO-GslE99OCNrZ4_AMnbzGqya2azqz_UMZR34zZvvo';

let _qClient: ReturnType<typeof createClient> | null = null;
function qClient(token?: string | null) {
  if (!_qClient) _qClient = createClient(SUPABASE_URL, SUPABASE_ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  if (token) _qClient.realtime.setAuth(token);
  return _qClient;
}

type AgentState = { id: string; queue_id: string; queue_name: string | null; paused: boolean; joined_at: string };

export default function QueuesScreen() {
  const { data, loading, error, refresh, lastSyncedAt } = useAutoSync<QueueRow[]>(
    () => mobileApi.queues(),
    { intervalMs: 30_000 },
  );
  const [q, setQ] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [states, setStates] = useState<Record<string, AgentState>>({}); // keyed by queue_id (text)
  const [busy, setBusy] = useState<string | null>(null);

  const loadStates = async (tok: string, uid: string) => {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/pbx_queue_agent_state?select=id,queue_id,queue_name,paused,joined_at&user_id=eq.${uid}`, {
      headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${tok}` },
    });
    if (!r.ok) return;
    const rows: AgentState[] = await r.json();
    const map: Record<string, AgentState> = {};
    rows.forEach((s) => { map[s.queue_id] = s; });
    setStates(map);
  };

  useEffect(() => {
    let channel: any = null;
    let cancelled = false;
    (async () => {
      const c = await getCredentials();
      if (!c?.accessToken || !c.userId) return;
      if (cancelled) return;
      setUserId(c.userId); setToken(c.accessToken); setOrgId((c as any).organizationId || null);
      await loadStates(c.accessToken, c.userId);
      const client = qClient(c.accessToken);
      channel = client
        .channel('queue-state-mobile')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_queue_agent_state', filter: `user_id=eq.${c.userId}` } as any,
          () => { if (!cancelled) loadStates(c.accessToken!, c.userId!); })
        .subscribe();
    })();
    return () => { cancelled = true; try { channel && _qClient?.removeChannel(channel); } catch {} };
  }, []);

  const join = async (queue: QueueRow) => {
    if (!token || !userId || !orgId) { showMobileToast('Not signed in', 'error'); return; }
    setBusy(queue.id);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pbx_queue_agent_state`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json', Prefer: 'return=representation,resolution=merge-duplicates',
        },
        body: JSON.stringify({
          user_id: userId, organization_id: orgId,
          queue_id: queue.id, queue_name: queue.name, paused: false, joined_at: new Date().toISOString(),
        }),
      });
      if (!r.ok) throw new Error(await r.text());
      showMobileToast(`Joined ${queue.name}`, 'success');
    } catch (e: any) {
      showMobileToast(`Join failed — ${e?.message?.slice(0, 80) || 'error'}`, 'error');
    } finally { setBusy(null); }
  };

  const leave = async (queue: QueueRow) => {
    if (!token || !userId) return;
    setBusy(queue.id);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pbx_queue_agent_state?user_id=eq.${userId}&queue_id=eq.${encodeURIComponent(queue.id)}`, {
        method: 'DELETE',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}` },
      });
      if (!r.ok) throw new Error(await r.text());
      showMobileToast(`Left ${queue.name}`, 'success');
    } catch (e: any) {
      showMobileToast(`Leave failed — ${e?.message?.slice(0, 80) || 'error'}`, 'error');
    } finally { setBusy(null); }
  };

  const togglePause = async (queue: QueueRow) => {
    if (!token || !userId) return;
    const cur = states[queue.id];
    if (!cur) return;
    setBusy(queue.id);
    try {
      const r = await fetch(`${SUPABASE_URL}/rest/v1/pbx_queue_agent_state?id=eq.${cur.id}`, {
        method: 'PATCH',
        headers: { apikey: SUPABASE_ANON, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ paused: !cur.paused }),
      });
      if (!r.ok) throw new Error(await r.text());
    } catch (e: any) {
      showMobileToast(`Update failed — ${e?.message?.slice(0, 80) || 'error'}`, 'error');
    } finally { setBusy(null); }
  };

  const filtered = useMemo(() => {
    if (!data) return data;
    const t = q.trim().toLowerCase();
    if (!t) return data;
    return data.filter((x) => x.name.toLowerCase().includes(t) || x.extension?.includes(t));
  }, [data, q]);

  const joinedCount = Object.values(states).filter((s) => !s.paused).length;

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '14px 14px 20px' }}>
      <SectionTitle eyebrow="Live PBX" title="Call queues" />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 10px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.7)', border: `1px solid ${colors.border}` }}>
          <Search size={14} color={colors.mutedSilver} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search queues…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 13, color: colors.textIce }} />
        </div>
        <button onClick={refresh} disabled={loading} style={{
          padding: '8px 12px', borderRadius: 999, border: `1px solid ${colors.border}`,
          background: 'rgba(255,255,255,0.7)', color: colors.lemtelBlue,
          fontSize: 11, fontWeight: 800, letterSpacing: 0.8, cursor: 'pointer',
        }}>{loading ? '…' : '↻'}</button>
      </div>

      <div style={{ fontSize: font.xs, color: colors.mutedSilver, margin: '0 2px 10px' }}>
        {joinedCount} active · {Object.keys(states).length} joined · live sync
        {lastSyncedAt ? ` · ${new Date(lastSyncedAt).toLocaleTimeString()}` : ''}
      </div>

      {error && <Card accent="gold" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: font.sm, color: colors.danger, fontWeight: 700 }}>Couldn't load queues</div>
        <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 4 }}>{error.message}</div>
      </Card>}

      {!data && !error && [1, 2, 3].map(i => (
        <Card key={i} style={{ marginBottom: 8 }}>
          <Skeleton w="60%" h={14} /><div style={{ height: 6 }} /><Skeleton w="40%" h={10} />
        </Card>
      ))}

      {data && data.length === 0 && (
        <EmptyState icon="⇉" title="No queues configured" hint="Once your administrator adds call queues they'll appear here." />
      )}

      {filtered && filtered.map((queue) => (
        <QueueCard
          key={queue.id}
          q={queue}
          state={states[queue.id]}
          busy={busy === queue.id}
          onJoin={() => join(queue)}
          onLeave={() => leave(queue)}
          onTogglePause={() => togglePause(queue)}
        />
      ))}

      <div style={{ height: 80 }} />
    </div>
  );
}

function QueueCard({ q, state, busy, onJoin, onLeave, onTogglePause }: {
  q: QueueRow; state?: AgentState; busy: boolean;
  onJoin: () => void; onLeave: () => void; onTogglePause: () => void;
}) {
  const slaTone = q.slaPct >= 85 ? colors.success : q.slaPct >= 70 ? colors.warning : colors.danger;
  const joined = !!state;
  const paused = !!state?.paused;
  return (
    <Card style={{ marginBottom: 8 }} padded={true}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce }}>{q.name}</div>
            {joined && (
              <span style={{
                fontSize: 9, fontWeight: 800, letterSpacing: 0.8, padding: '2px 6px', borderRadius: 999,
                background: paused ? 'rgba(245,158,11,0.18)' : 'rgba(34,211,154,0.18)',
                color: paused ? colors.warning : colors.success,
              }}>{paused ? 'PAUSED' : 'ACTIVE'}</span>
            )}
          </div>
          <div style={{ fontSize: font.xs, color: colors.mutedSilver, marginTop: 2, fontFamily: 'JetBrains Mono, monospace' }}>
            Ext {q.extension || '—'} · {q.strategy || 'default'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: slaTone, fontFamily: 'JetBrains Mono, monospace' }}>{q.slaPct}%</div>
          <div style={{ fontSize: 9.5, color: colors.mutedSilver, letterSpacing: 1 }}>SLA TODAY</div>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
        <Chip tone="cyan">{q.waiting} waiting</Chip>
        <Chip tone="gold">{q.agentsOnline} agents online</Chip>
        <Chip tone="violet">{q.callsToday} calls today</Chip>
        {q.avgWaitSec > 0 && <Chip>Wait {Math.round(q.avgWaitSec)}s</Chip>}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        {!joined ? (
          <button onClick={onJoin} disabled={busy} style={pillBtn(colors.success, busy)}>
            <LogIn size={12} /> {busy ? '…' : 'Join'}
          </button>
        ) : (
          <>
            <button onClick={onTogglePause} disabled={busy} style={pillBtn(paused ? colors.success : colors.warning, busy)}>
              {paused ? <Play size={12} /> : <Pause size={12} />} {paused ? 'Resume' : 'Pause'}
            </button>
            <button onClick={onLeave} disabled={busy} style={pillBtn(colors.danger, busy)}>
              <LogOut size={12} /> Leave
            </button>
          </>
        )}
      </div>
    </Card>
  );
}

function pillBtn(color: string, busy: boolean): React.CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    padding: '6px 12px', borderRadius: 999, border: 'none',
    background: color, color: '#fff',
    fontSize: 11, fontWeight: 800, letterSpacing: 0.6,
    cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1,
  };
}
