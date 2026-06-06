import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface CallRow {
  id: string;
  direction: string | null;
  call_status: string | null;
  caller_number: string | null;
  caller_name: string | null;
  destination_number: string | null;
  destination: string | null;
  start_at: string | null;
  duration_seconds: number | null;
  missed_call: boolean | null;
}

interface Props {
  extension: string;
  onCall: (n: string) => void;
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

function fmtDur(s: number | null) {
  if (!s) return '';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
}

export default function RecentsList({ extension, onCall }: Props) {
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const { data, error } = await supabase
      .from('pbx_call_records')
      .select('id,direction,call_status,caller_number,caller_name,destination_number,destination,start_at,duration_seconds,missed_call')
      .eq('extension', extension)
      .order('start_at', { ascending: false })
      .limit(100);
    if (error) setErr(error.message);
    else setRows((data as CallRow[]) || []);
    setLoading(false);
  }, [extension]);

  useEffect(() => { load(); }, [load]);

  // Realtime: new CDR rows for this extension
  useEffect(() => {
    const ch = supabase
      .channel(`cdr-${extension}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_call_records', filter: `extension=eq.${extension}` },
        (payload) => {
          setRows((prev) => [payload.new as CallRow, ...prev].slice(0, 100));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [extension]);

  if (loading) return <div style={center}>Loading recents…</div>;
  if (err) return <div style={{ ...center, color: '#ff8a8a' }}>{err}</div>;
  if (rows.length === 0) return <div style={center}>No recent calls</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{rows.length} call{rows.length > 1 ? 's' : ''}</span>
        <button onClick={load} style={refreshBtn}>↻</button>
      </div>
      {rows.map((r) => {
        const outbound = r.direction === 'outbound' || r.direction === 'local';
        const peer = outbound
          ? (r.destination_number || r.destination || '?')
          : (r.caller_number || '?');
        const name = !outbound ? r.caller_name : null;
        const missed = r.missed_call || r.call_status === 'no_answer' || r.call_status === 'missed';
        const icon = missed ? '✗' : outbound ? '↗' : '↙';
        const iconColor = missed ? '#ff5f56' : outbound ? '#FFD700' : '#28ca41';
        return (
          <button
            key={r.id}
            onClick={() => onCall(peer)}
            style={rowBtn}
          >
            <span style={{ color: iconColor, fontSize: 16, width: 20 }}>{icon}</span>
            <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: missed ? '#ff8a8a' : '#fff' }}>
                {name || peer}
              </div>
              <div style={{ fontSize: 10, opacity: 0.55 }}>
                {fmtTime(r.start_at)}{r.duration_seconds ? ` · ${fmtDur(r.duration_seconds)}` : ''}
              </div>
            </div>
            <span style={{ fontSize: 14, opacity: 0.6 }}>📞</span>
          </button>
        );
      })}
    </div>
  );
}

const center: React.CSSProperties = { textAlign: 'center', padding: 40, opacity: 0.5, fontSize: 12 };
const rowBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#fff',
};
const refreshBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)',
  cursor: 'pointer', fontSize: 14,
};
