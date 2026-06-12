import { useCallback, useEffect, useState } from 'react';
import { theme } from '../../lib/theme';
import { supabase } from '../../lib/supabaseClient';
import PageHeader, { ListSkeleton, EmptyState } from './PageHeader';

const { colors: c } = theme;

type Agent = {
  id: string;
  name: string;
  description: string | null;
  elevenlabs_agent_id: string | null;
  extension: string | null;
  status: string | null;
  total_calls: number | null;
  avg_duration: number | null;
  escalation_rate: number | null;
};

type Binding = {
  id: string;
  voice_agent_id: string;
  binding_type: string;
  target_ref: string | null;
  priority: number | null;
  active: boolean;
};

export default function VoiceAgentsView() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [bindings, setBindings] = useState<Binding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [{ data: ag, error: e1 }, { data: bd, error: e2 }] = await Promise.all([
        supabase.from('lemtel_voice_agents').select('id,name,description,elevenlabs_agent_id,extension,status,total_calls,avg_duration,escalation_rate').order('name'),
        supabase.from('voice_agent_bindings').select('id,voice_agent_id,binding_type,target_ref,priority,active'),
      ]);
      if (e1) throw e1;
      if (e2) console.warn(e2);
      setAgents((ag || []) as Agent[]);
      setBindings((bd || []) as Binding[]);
    } catch (e: any) {
      setError(e?.message || 'Failed to load voice agents');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const bindingsFor = (agentId: string) => bindings.filter((b) => b.voice_agent_id === agentId);

  return (
    <div style={{ padding: '24px 28px', overflowY: 'auto', height: '100%' }}>
      <PageHeader
        eyebrow="AI Telephony"
        title="Voice Agents"
        subtitle="ElevenLabs conversational agents bound to extensions, DIDs, or IVR options."
        accent={c.avaViolet}
        icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 1a4 4 0 0 0-4 4v6a4 4 0 0 0 8 0V5a4 4 0 0 0-4-4zM5 11a7 7 0 0 0 14 0M12 18v4"/></svg>}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button onClick={load} style={{ padding: '8px 14px', borderRadius: 9, background: 'transparent', border: `1px solid ${c.border}`, color: c.textIce, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>↻ Refresh</button>
      </div>

      {error && <div style={{ padding: 14, color: c.danger, background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 10, marginBottom: 12 }}>{error}</div>}
      {loading && <ListSkeleton rows={5} />}
      {!loading && agents.length === 0 && (
        <EmptyState icon="◉" title="No voice agents" hint="Create an agent in ElevenLabs and bind it via the platform's API Explorer." accent={c.avaViolet} />
      )}
      {!loading && agents.length > 0 && (
        <div style={{ display: 'grid', gap: 10 }}>
          {agents.map((a) => {
            const bs = bindingsFor(a.id);
            return (
              <div key={a.id} style={{ background: c.bgCard, border: `1px solid ${c.border}`, borderRadius: 12, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: c.textIce }}>{a.name}</div>
                    <div style={{ fontSize: 11, color: c.mutedSilver, marginTop: 2 }}>{a.description || '—'}</div>
                    <div style={{ fontSize: 10.5, color: c.mutedSilver, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>
                      EL: {a.elevenlabs_agent_id || '—'} · Ext: {a.extension || '—'}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1, color: a.status === 'active' ? c.success : c.mutedSilver, textTransform: 'uppercase' }}>
                      ● {a.status || 'unknown'}
                    </span>
                    <span style={{ fontSize: 10.5, color: c.mutedSilver, fontFamily: 'JetBrains Mono, monospace' }}>
                      {a.total_calls ?? 0} calls · {Math.round(a.avg_duration || 0)}s avg · esc {Math.round((a.escalation_rate || 0) * 100)}%
                    </span>
                  </div>
                </div>
                <div style={{ marginTop: 12, borderTop: `1px solid ${c.border}`, paddingTop: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, color: c.mutedSilver, textTransform: 'uppercase', marginBottom: 6 }}>
                    Bindings ({bs.length})
                  </div>
                  {bs.length === 0 ? (
                    <div style={{ fontSize: 11.5, color: c.mutedSilver }}>No bindings yet — agent will not receive calls.</div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {bs.map((b) => (
                        <span key={b.id} style={{
                          padding: '4px 10px', borderRadius: 999, fontSize: 11,
                          background: b.active ? 'rgba(35,214,255,0.08)' : 'transparent',
                          color: b.active ? c.avaCyan : c.mutedSilver,
                          border: `1px solid ${b.active ? c.avaCyan + '55' : c.border}`,
                          fontFamily: 'JetBrains Mono, monospace',
                        }}>{b.binding_type}: {b.target_ref || '—'}{b.priority ? ` · p${b.priority}` : ''}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
