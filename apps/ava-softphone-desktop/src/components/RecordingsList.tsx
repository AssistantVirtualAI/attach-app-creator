import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { theme } from '../lib/theme';
import { ava, RecordingItem } from '../lib/avaApi';

const { colors: c, glow } = theme;

function displayError(e: any) {
  const text = String(e?.context?.error || e?.message || e?.details || e?.error || 'Analysis failed');
  if (/MISSING_SECRET/i.test(text)) return 'AI analysis is not configured yet.';
  if (/Unauthorized|Forbidden/i.test(text)) return 'You do not have permission to analyze this recording.';
  if (/required fields missing/i.test(text)) return 'A transcript is required before AI analysis can run.';
  return text;
}

export default function RecordingsList({ onAnalyze }: { onAnalyze?: (id: string) => void }) {
  const [items, setItems] = useState<RecordingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await ava.recordings();
      setItems(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setError(e?.message || 'Unable to load recordings.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onSync = () => { void load(); };
    window.addEventListener('lemtel:phone-sync-complete', onSync);
    return () => window.removeEventListener('lemtel:phone-sync-complete', onSync);
  }, [load]);

  const analyze = async (r: RecordingItem) => {
    setWorking(r.id); setError(null);
    try {
      const organization_id = r.organization_id || '71755d33-ed64-4ad5-a828-61c9d2029eb7';
      let transcript_text = String(r.transcript_text || '').trim();
      const r1 = await supabase.functions.invoke('ai-transcribe-call', {
        body: {
          callId: r.callId || r.id,
          call_record_id: r.callId || r.id,
          organization_id,
          recording_path: r.recording_path,
          recording_name: r.recording_name,
        },
      });
      if (r1.error) throw r1.error;
      transcript_text = transcript_text || String((r1.data as any)?.transcript_text || '').trim();
      if (!transcript_text) throw new Error('No transcript available for AI analysis yet');
      const r2 = await supabase.functions.invoke('ai-analyze-call', {
        body: {
          callId: r.callId || r.id,
          call_record_id: r.callId || r.id,
          organization_id,
          recording_path: r.recording_path,
          recording_name: r.recording_name,
          transcript_text,
        },
      });
      if (r2.error) throw r2.error;
      onAnalyze?.(r.id);
      await load();
    } catch (e: any) {
      setError(displayError(e));
    } finally {
      setWorking(null);
    }
  };

  const play = async (r: RecordingItem) => {
    setError(null);
    if (audio[r.id]) return;
    // Try direct FusionPBX URL first (works in Electron without CORS)
    if (r.recording_path && r.recording_name) {
      const direct = `https://pbxnode.lemtel.tel/app/api/7/recordings/${r.recording_name}?key=1fzetTwb0VC1BiHjUgWfHE7y78THXTNX&username=mhassoun&path=${encodeURIComponent(r.recording_path)}`;
      setAudio((a) => ({ ...a, [r.id]: direct }));
      return;
    }
    const url = await ava.getRecordingAudioUrl(r);
    if (!url) { setError('Recording file not available from PBX yet'); return; }
    setAudio((a) => ({ ...a, [r.id]: url }));
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
        const sentiment = r.sentiment;
        const sentColor =
          sentiment?.includes('positive') ? c.green :
          sentiment?.includes('negative') ? c.red : c.yellow;
        return (
          <div key={r.id} style={{ ...theme.glass.card, padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: c.text }}>
                  {r.from || '—'} {r.to ? `→ ${r.to}` : ''}
                </div>
                <div style={{ fontSize: 10, color: c.textSub, marginTop: 2 }}>
                  {r.recordedAt ? new Date(r.recordedAt).toLocaleString() : ''} · {r.durationSec || 0}s
                </div>
              </div>
              {sentiment && (
                <span style={{
                  fontSize: 9, padding: '2px 6px', borderRadius: 6,
                  background: `${sentColor}22`, color: sentColor, textTransform: 'uppercase', letterSpacing: 1, fontWeight: 700,
                }}>{sentiment}</span>
              )}
            </div>

            {audio[r.id] ? (
              <audio controls src={audio[r.id]} style={{ width: '100%', marginTop: 8, height: 32 }} />
            ) : (
              <button onClick={() => play(r)} style={{ marginTop: 8, width: '100%', padding: 7, borderRadius: 8, background: 'rgba(255,255,255,0.06)', border: `1px solid ${c.border}`, color: c.text, fontSize: 11, cursor: 'pointer' }}>▶ Load PBX audio{r.recording_name ? ` · ${r.recording_name}` : ''}</button>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {!(r as any).analyzed ? (
                <button
                  onClick={() => analyze(r)}
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

            {r.summary && (
              <div style={{ marginTop: 8, padding: 8, background: 'rgba(0,0,0,0.25)', borderRadius: 8, fontSize: 11, color: c.textSub, lineHeight: 1.4 }}>
                {r.summary}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
