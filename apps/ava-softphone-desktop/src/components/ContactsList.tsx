import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';

interface ExtRow {
  id: string;
  extension: string;
  effective_cid_name: string | null;
  description: string | null;
  enabled: boolean | null;
  do_not_disturb: boolean | null;
}

interface PresenceRow {
  extension: string;
  status: string | null;
  last_seen_at: string | null;
}

interface Props {
  selfExtension: string;
  onCall: (n: string) => void;
}

export default function ContactsList({ selfExtension, onCall }: Props) {
  const [exts, setExts] = useState<ExtRow[]>([]);
  const [presence, setPresence] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [extRes, presRes] = await Promise.all([
      supabase
        .from('pbx_extensions')
        .select('id,extension,effective_cid_name,description,enabled,do_not_disturb')
        .eq('enabled', true)
        .order('extension', { ascending: true })
        .limit(500),
      supabase
        .from('pbx_softphone_users')
        .select('extension,status,last_seen_at'),
    ]);
    if (extRes.error) setErr(extRes.error.message);
    else setExts((extRes.data as ExtRow[]) || []);
    if (!presRes.error && presRes.data) {
      const map: Record<string, string> = {};
      (presRes.data as PresenceRow[]).forEach((p) => { map[p.extension] = p.status || 'offline'; });
      setPresence(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Realtime presence
  useEffect(() => {
    const ch = supabase
      .channel('blf-presence')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pbx_softphone_users' },
        (payload) => {
          const row = (payload.new || payload.old) as PresenceRow;
          if (!row?.extension) return;
          setPresence((prev) => ({ ...prev, [row.extension]: (payload.new as PresenceRow)?.status || 'offline' }));
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return exts
      .filter((e) => e.extension !== selfExtension)
      .filter((e) => {
        if (!needle) return true;
        return (
          e.extension.toLowerCase().includes(needle) ||
          (e.effective_cid_name || '').toLowerCase().includes(needle) ||
          (e.description || '').toLowerCase().includes(needle)
        );
      });
  }, [exts, q, selfExtension]);

  if (loading) return <div style={center}>Loading contacts…</div>;
  if (err) return <div style={{ ...center, color: '#ff8a8a' }}>{err}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 1 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search contacts…"
        aria-label="Search contacts"
        style={search}
      />
      {filtered.length === 0 ? (
        <div style={center}>No contacts</div>
      ) : (
        filtered.map((e) => {
          const st = presence[e.extension] || 'offline';
          const dnd = e.do_not_disturb;
          const color = dnd ? '#ff5f56'
            : st === 'oncall' ? '#ff8a3c'
            : st === 'available' || st === 'online' ? '#28ca41'
            : 'rgba(255,255,255,0.45)';
          const name = e.effective_cid_name || e.description || `Extension ${e.extension}`;
          return (
            <button
              key={e.id}
              onClick={() => onCall(e.extension)}
              className="lemtel-contact-row"
              style={rowBtn}
              aria-label={`Call ${name}, extension ${e.extension}`}
              title={dnd ? 'Do not disturb' : st}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: color, flexShrink: 0, boxShadow: `0 0 6px ${color}` }} />
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#F4F7FF', textShadow: '0 1px 2px rgba(0,0,0,0.45)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(220,228,245,0.78)', textShadow: '0 1px 1px rgba(0,0,0,0.35)' }}>
                  Ext. {e.extension}{dnd ? ' · DND' : ''}
                </div>
              </div>
              <span
                className="lemtel-contact-call"
                aria-hidden
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: 'linear-gradient(135deg, #10B981, #047857)',
                  color: '#fff', fontSize: 14, boxShadow: '0 2px 8px rgba(16,185,129,0.45), inset 0 0 0 1px rgba(255,255,255,0.18)',
                }}
              >📞</span>
            </button>
          );
        })
      )}
    </div>
  );
}

const center: React.CSSProperties = { textAlign: 'center', padding: 40, color: 'rgba(235,240,255,0.8)', fontSize: 12, textShadow: '0 1px 2px rgba(0,0,0,0.4)' };
const rowBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: 'linear-gradient(180deg, rgba(12,18,38,0.72), rgba(8,12,28,0.78))',
  border: '1px solid rgba(120,150,210,0.28)',
  borderRadius: 10, padding: '10px 12px', cursor: 'pointer', color: '#fff',
  backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
  boxShadow: '0 1px 0 rgba(255,255,255,0.04) inset, 0 2px 6px rgba(0,0,0,0.25)',
  transition: 'background 160ms ease, border-color 160ms ease, transform 120ms ease, box-shadow 160ms ease',
};
const search: React.CSSProperties = {
  width: '100%',
  background: 'rgba(10,16,32,0.7)',
  border: '1px solid rgba(120,150,210,0.35)', borderRadius: 10,
  color: '#F4F7FF', padding: '10px 12px', fontSize: 13, outline: 'none',
  marginBottom: 8, boxSizing: 'border-box',
  backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
};
