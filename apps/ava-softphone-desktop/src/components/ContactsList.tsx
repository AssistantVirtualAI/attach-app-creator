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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search contacts…"
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
            : 'rgba(255,255,255,0.25)';
          const name = e.effective_cid_name || e.description || `Extension ${e.extension}`;
          return (
            <button
              key={e.id}
              onClick={() => onCall(e.extension)}
              style={rowBtn}
              title={dnd ? 'Do not disturb' : st}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name}
                </div>
                <div style={{ fontSize: 10, opacity: 0.55 }}>
                  Ext. {e.extension}{dnd ? ' · DND' : ''}
                </div>
              </div>
              <span style={{ fontSize: 14, opacity: 0.6 }}>📞</span>
            </button>
          );
        })
      )}
    </div>
  );
}

const center: React.CSSProperties = { textAlign: 'center', padding: 40, opacity: 0.5, fontSize: 12 };
const rowBtn: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: 8, padding: '8px 10px', cursor: 'pointer', color: '#fff',
};
const search: React.CSSProperties = {
  width: '100%', background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
  color: '#fff', padding: '8px 10px', fontSize: 12, outline: 'none',
  marginBottom: 8, boxSizing: 'border-box',
};
