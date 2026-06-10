import React, { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ava } from '@/lib/avaApi';
import { ArrowUpRight, ArrowDownLeft, PhoneMissed, PhoneCall } from './RowIcons';

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
    try {
      await ava.calls(100);
      const { data, error } = await supabase
        .from('pbx_call_records')
        .select('id,direction,call_status,caller_number,caller_name,destination_number,destination,start_at,duration_seconds,missed_call')
        .order('start_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      setRows((data as CallRow[]) || []);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load live call records.');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [extension]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const onSync = () => { void load(); };
    window.addEventListener('lemtel:phone-sync-complete', onSync);
    return () => window.removeEventListener('lemtel:phone-sync-complete', onSync);
  }, [load]);

  // Realtime: new CDR rows visible to this signed-in desktop user
  useEffect(() => {
    const ch = supabase
      .channel(`cdr-${extension}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'pbx_call_records' },
        (payload) => {
          setRows((prev) => [payload.new as CallRow, ...prev].slice(0, 100));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [extension]);

  if (loading) return <div style={center}>Loading recents…</div>;
  if (err) return <div style={{ ...center, color: '#ff8a8a' }}>{err}<br /><button onClick={load} style={refreshBtn}>Retry</button></div>;
  if (rows.length === 0) return <div style={center}>No recent calls</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, padding: '0 2px' }}>
        <span style={{ fontSize: 10, opacity: 0.5, letterSpacing: 1.2, textTransform: 'uppercase', fontWeight: 600 }}>
          {rows.length} call{rows.length > 1 ? 's' : ''}
        </span>
        <button onClick={load} style={refreshBtn} title="Refresh">↻</button>
      </div>
      {rows.map((r) => {
        const outbound = r.direction === 'outbound' || r.direction === 'local';
        const peer = outbound
          ? (r.destination_number || r.destination || '?')
          : (r.caller_number || '?');
        const name = !outbound ? r.caller_name : null;
        const missed = r.missed_call || r.call_status === 'no_answer' || r.call_status === 'missed';
        const iconColor = missed ? '#EF4444' : outbound ? '#FFD700' : '#10B981';
        const initial = (name || peer || '?').toString().charAt(0).toUpperCase();
        return (
          <button key={r.id} onClick={() => onCall(peer)} className="lemtel-row">
            <div className="lemtel-avatar" style={{
              background: missed
                ? 'linear-gradient(135deg, #7F1D1D 0%, #DC2626 100%)'
                : outbound
                  ? 'linear-gradient(135deg, #C9A84C 0%, #FFD700 100%)'
                  : 'linear-gradient(135deg, #003DA6 0%, #7C3AED 100%)',
            }}>
              {initial}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: 600, overflow: 'hidden',
                textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                color: missed ? '#FCA5A5' : '#F5F5F7',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>
                <span style={{ color: iconColor, display: 'inline-flex' }}>
                  {missed ? <PhoneMissed size={13} /> : outbound ? <ArrowUpRight size={13} /> : <ArrowDownLeft size={13} />}
                </span>
                {name || peer}
              </div>
              <div style={{ fontSize: 10.5, opacity: 0.5, marginTop: 2, letterSpacing: 0.2 }}>
                {fmtTime(r.start_at)}{r.duration_seconds ? ` · ${fmtDur(r.duration_seconds)}` : ''}
              </div>
            </div>
            <span style={{ color: 'rgba(255,215,0,0.6)', display: 'inline-flex' }}>
              <PhoneCall size={16} />
            </span>
          </button>
        );
      })}
    </div>
  );
}

const center: React.CSSProperties = { textAlign: 'center', padding: 48, opacity: 0.5, fontSize: 12, letterSpacing: 0.5 };
const refreshBtn: React.CSSProperties = {
  background: 'rgba(255,215,0,0.08)', border: '1px solid rgba(255,215,0,0.2)',
  color: '#FFD700', borderRadius: 8, width: 28, height: 28,
  cursor: 'pointer', fontSize: 13,
};
