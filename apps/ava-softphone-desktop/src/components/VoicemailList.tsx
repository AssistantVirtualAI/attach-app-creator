import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface VmRow {
  id: string;
  caller_name: string | null;
  caller_number: string | null;
  destination_number?: string | null;
  start_at: string | null;
  duration_seconds: number | null;
  recording_url: string | null;
  recording_path: string | null;
  voicemail_message: string | null;
  missed_call?: boolean | null;
}

interface Props {
  extension: string;
  onCall: (n: string) => void;
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function hasMessage(r: VmRow) {
  const msg = String(r.voicemail_message ?? '').trim().toLowerCase();
  return !!r.recording_url || !!r.recording_path || (!!msg && msg !== 'false' && msg !== 'null') || !!r.missed_call;
}

export default function VoicemailList({ extension, onCall }: Props) {
  const [rows, setRows] = useState<VmRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from('pbx_call_records')
      .select('id,caller_name,caller_number,destination_number,start_at,duration_seconds,recording_url,recording_path,voicemail_message,missed_call')
      .or('hangup_cause.eq.NO_ANSWER,voicemail_message.not.is.null,missed_call.eq.true')
      .order('start_at', { ascending: false })
      .limit(50);
    if (error) setErr(error.message);
    else setRows(((data as VmRow[]) || []).filter(hasMessage));
    setLoading(false);
  }, [extension]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const ch = supabase
      .channel(`vm-${extension}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_call_records' },
        (payload) => {
          const r = payload.new as VmRow & { missed_call?: boolean };
          if (hasMessage(r)) {
            setRows((prev) => [r, ...prev].slice(0, 50));
          }
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [extension]);

  if (loading) return <div style={center}>Loading voicemail…</div>;
  if (err) return <div style={{ ...center, color: '#ff8a8a' }}>{err}</div>;
  if (rows.length === 0) return <div style={center}>No voicemail</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{rows.length} message{rows.length > 1 ? 's' : ''}</span>
        <button onClick={load} style={refreshBtn}>↻</button>
      </div>
      {rows.map((r) => {
        const peer = r.caller_number || r.destination_number || '?';
        const name = r.caller_name || peer;
        const expanded = playing === r.id;
        return (
          <div key={r.id} style={rowBox}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ color: '#FFD700', fontSize: 16, width: 20 }}>✉</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>
                  {fmtTime(r.start_at)}{r.duration_seconds ? ` · ${r.duration_seconds}s` : ''}
                </div>
              </div>
              {r.recording_url && (
                <button onClick={() => setPlaying(expanded ? null : r.id)} style={iconAct}>
                  {expanded ? '⏸' : '▶'}
                </button>
              )}
              <button onClick={() => onCall(peer)} style={iconAct}>📞</button>
            </div>
            {expanded && r.recording_url && (
              <audio src={r.recording_url} controls autoPlay style={{ width: '100%', marginTop: 8, height: 32 }} />
            )}
            {r.voicemail_message && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                {r.voicemail_message}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const center: React.CSSProperties = { textAlign: 'center', padding: 40, opacity: 0.5, fontSize: 12 };
const rowBox: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8, padding: 10, color: '#fff',
};
const iconAct: React.CSSProperties = {
  background: 'rgba(255,255,255,0.08)', border: 'none', color: '#fff',
  borderRadius: 6, padding: '6px 10px', cursor: 'pointer', fontSize: 12,
};
const refreshBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer', fontSize: 14,
};
