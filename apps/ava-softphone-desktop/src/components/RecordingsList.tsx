import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { theme } from '../lib/theme';

const { colors: c, glow } = theme;
const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

interface CallRec {
  id: string;
  caller_number?: string | null;
  callee_number?: string | null;
  start_at?: string | null;
  duration_seconds?: number | null;
  recording_url?: string | null;
  has_recording?: boolean | null;
  transcribed?: boolean | null;
  raw_data?: any;
}

export default function RecordingsList({ onAnalyze }: { onAnalyze?: (id: string) => void }) {
  const [items, setItems] = useState<CallRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase
      .from('pbx_call_records' as any)
      .select('*')
      .eq('organization_id', LEMTEL_ORG)
      .order('start_at', { ascending: false })
      .limit(200);
    if (error) setError(error.message);
    else setItems(((data || []) as any[]).filter(r => r.has_recording || r.recording_url));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const analyze = async (id: string) => {
    setWorking(id);
    setError(null);
    try {
      const r1 = await supabase.functions.invoke('ai-transcribe-call', {
        body: { call_record_id: id, organization_id: LEMTEL_ORG },
      });
      if (r1.error) throw new Error(r1.error.message || 'Transcription failed');
      if (r1.data?.error === 'NO_RECORDING_YET') {
        setError('Recording is not yet available from the PBX. Please try again in a few moments.');
        return;
      }
      const r2 = await supabase.functions.invoke('ai-analyze-call', {
        body: {
          call_record_id: id,
          organization_id: LEMTEL_ORG,
          transcript_text: r1.data?.transcript_text || '',
        },
      });
      if (r2.error) throw new Error(r2.error.message || 'Analysis failed');
      onAnalyze?.(id);
      await load();
    } catch (e: any) {
      setError(e?.message || 'Analysis failed');
    } finally {
      setWorking(null);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 40, color: c.textSub }}>Loading recordings…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <div style={{ fontSize: 11, color: c.textSub, letterSpacing: 1, textTransform: 'uppercase' }}>
          {items.length} recording{items.length !== 1 ? 's' : ''}
        </div>
        <button onClick={load} style={{
          background: 'rgba(255,255,255,0.05)', border: `1px solid ${c.border}`,
          color: c.text, padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
        }}>↻ Refresh</button>
      </div>

      {error && (
        <div style={{ padding: 10, background: 'rgba(239,68,68,0.10)', color: c.red, fontSize: 11, borderRadius: 8 }}>
          {error}
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: c.textSub, fontSize: 12 }}>
          No recordings yet.
        </div>
      ) : items.map(r => {
        const sentiment = r.raw_data?.sentiment as string | undefined;
        const sentColor =
          sentiment?.includes('positive') ? c.green :
          sentiment?.includes('negative') ? c.red : c.yellow;
        return (
          <div key={r.id} style={{ ...theme.glass.card, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: c.text }}>
                  {r.caller_number || '—'} {r.callee_number ? `→ ${r.callee_number}` : ''}
                </div>
                <div style={{ fontSize: 10, color: c.textSub, marginTop: 2 }}>
                  {r.start_at ? new Date(r.start_at).toLocaleString() : ''} · {r.duration_seconds || 0}s
                </div>
              </div>
              {sentiment && (
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 6,
                  background: `${sentColor}22`, color: sentColor, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700,
                }}>{sentiment}</span>
              )}
            </div>

            {r.recording_url ? (
              <audio controls src={r.recording_url} style={{ width: '100%', marginTop: 8, height: 32 }} />
            ) : (
              <div style={{ fontSize: 10, color: c.textDim, padding: 6, textAlign: 'center' }}>
                Recording not yet available
              </div>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {!r.transcribed ? (
                <button
                  onClick={() => analyze(r.id)}
                  disabled={working === r.id}
                  style={{
                    flex: 1, padding: '6px 10px', borderRadius: 8,
                    border: `1px solid ${c.borderAI}`, background: 'rgba(124,58,237,0.15)',
                    color: c.aiLight, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    boxShadow: working === r.id ? glow.ai : 'none',
                  }}
                >
                  {working === r.id ? '✨ Analyzing…' : '✨ Transcribe & Analyze'}
                </button>
              ) : (
                <span style={{
                  fontSize: 10, padding: '4px 8px', borderRadius: 6,
                  background: 'rgba(16,185,129,0.15)', color: c.green, fontWeight: 600,
                }}>✓ Analyzed</span>
              )}
            </div>

            {r.raw_data?.summary && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8, fontSize: 11, color: c.textSub, lineHeight: 1.4 }}>
                {r.raw_data.summary}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
