import React, { useEffect, useState, useCallback } from 'react';
import { ava, VoicemailItem } from '@/lib/avaApi';
import { useRealtimeRefresh } from '@/lib/useRealtimeRefresh';
import { useOrgId } from '@/lib/useOrgId';
import { audit } from '@/lib/audit';

interface Props {
  extension: string;
  onCall: (n: string) => void;
}

function fmtTime(iso: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function VoicemailList({ extension, onCall }: Props) {
  const [rows, setRows] = useState<VoicemailItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [audio, setAudio] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await ava.voicemails(50);
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setErr(e?.message || 'Unable to load voicemail.');
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

  // Realtime: new voicemails for this tenant trigger a refetch.
  const orgId = useOrgId();
  useRealtimeRefresh({ table: 'pbx_voicemails', organizationId: orgId }, load);
  useRealtimeRefresh({ table: 'pbx_call_records', organizationId: orgId }, load);


  const togglePlay = async (r: VoicemailItem) => {
    if (playing === r.id) { setPlaying(null); return; }
    if (!audio[r.id]) {
      const url = await ava.getRecordingAudioUrl(r);
      if (!url) { setErr('No voicemail audio available yet'); return; }
      setAudio((a) => ({ ...a, [r.id]: url }));
    }
    audit('voicemail.played', r.id, { from: r.from, duration: r.durationSec });
    setPlaying(r.id);
  };

  if (loading) return <div style={center}>Loading voicemail…</div>;
  if (err) return <div style={{ ...center, color: '#ff8a8a' }}>{err}<br /><button onClick={load} style={refreshBtn}>Retry</button></div>;
  if (rows.length === 0) return <div style={center}>No voicemail</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 11, opacity: 0.6 }}>{rows.length} message{rows.length > 1 ? 's' : ''}</span>
        <button onClick={load} style={refreshBtn}>↻</button>
      </div>
      {rows.map((r) => {
        const peer = r.from || '?';
        const name = r.customer || peer;
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
                  {fmtTime(r.receivedAt)}{r.durationSec ? ` · ${r.durationSec}s` : ''}
                </div>
              </div>
              <button onClick={() => togglePlay(r)} style={iconAct}>{expanded ? '⏸' : '▶'}</button>
              <button onClick={() => onCall(peer)} style={iconAct}>📞</button>
            </div>
            {expanded && audio[r.id] && (
              <audio src={audio[r.id]} controls autoPlay style={{ width: '100%', marginTop: 8, height: 32 }} />
            )}
            {r.transcript && (
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6, padding: 6, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }}>
                {r.transcript}
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
