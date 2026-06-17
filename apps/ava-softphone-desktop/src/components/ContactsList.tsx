import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { ava } from '../lib/avaApi';
import { theme } from '../lib/theme';

const { colors: c } = theme;

interface ExtRow {
  id: string;
  extension: string;
  effective_cid_name: string | null;
  description: string | null;
  enabled: boolean | null;
  do_not_disturb: boolean | null;
  status?: string | null;
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
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
    const [extRows, presRes] = await Promise.all([
      ava.extensions().catch(() => [] as any[]),
      supabase
        .from('pbx_softphone_users')
        .select('extension,status,last_seen_at'),
    ]);
    setExts((extRows || []).map((e: any) => ({
      id: e.id,
      extension: String(e.extension),
      effective_cid_name: e.displayName || null,
      description: e.user || null,
      enabled: e.enabled !== false,
      do_not_disturb: !!e.doNotDisturb,
      status: e.status || null,
    })));
    if (!presRes.error && presRes.data) {
      const map: Record<string, string> = {};
      (presRes.data as PresenceRow[]).forEach((p) => { map[p.extension] = p.status || 'offline'; });
      (extRows || []).forEach((e: any) => { if (e.extension && e.status && !map[e.extension]) map[e.extension] = e.status; });
      setPresence(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

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

  const center: React.CSSProperties = {
    textAlign: 'center', padding: 40,
    color: c.mutedSilver, fontSize: 12,
  };

  const row: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px clamp(10px, 3vw, 16px)',
    background: c.bgCard,
    borderBottom: `1px solid ${c.border}`,
    cursor: 'default',
    transition: 'background 0.15s ease',
    minWidth: 0,
    width: '100%',
    boxSizing: 'border-box',
  };

  const search: React.CSSProperties = {
    width: '100%',
    background: c.bgCard,
    border: `1px solid ${c.border}`,
    borderRadius: 10,
    padding: '8px 12px 8px 36px',
    color: c.textIce, fontSize: 13, outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 150ms ease, background 150ms ease',
  };

  if (loading) return <div style={center}>Loading contacts…</div>;
  if (err) return <div style={{ ...center, color: c.danger }}>{err}</div>;

  return (
    <div className="lemtel-contacts-list" style={{ display: 'flex', flexDirection: 'column', gap: 0, position: 'relative', zIndex: 1, width: '100%', minWidth: 0 }}>
      <div style={{ position: 'relative', padding: '4px clamp(6px, 2.5vw, 8px) 10px' }}>
        <span aria-hidden style={{
          position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)',
          color: c.mutedSilver, fontSize: 14, pointerEvents: 'none',
        }}>🔍</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search contacts…"
          aria-label="Search contacts"
          style={search}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = c.borderGold;
            e.currentTarget.style.background = c.bgCardHover;
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = c.border;
            e.currentTarget.style.background = c.bgCard;
          }}
        />
      </div>
      {filtered.length === 0 ? (
        <div style={center}>No contacts found</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {filtered.map((e) => {
            const st = presence[e.extension] || 'offline';
            const dnd = !!e.do_not_disturb;
            const dotColor =
              dnd ? c.danger :
              st === 'oncall' || st === 'busy' ? c.warning :
              st === 'available' || st === 'online' ? c.success :
              st === 'away' ? c.warning :
              c.mutedSilver;
            const name = e.effective_cid_name || e.description || `Extension ${e.extension}`;
            const isOnline = (st === 'available' || st === 'online') && !dnd;
            return (
              <div
                key={e.id}
                role="row"
                className="lemtel-contact-row"
                style={row}
                onMouseEnter={(ev) => { (ev.currentTarget as HTMLDivElement).style.background = c.bgCardHover; }}
                onMouseLeave={(ev) => { (ev.currentTarget as HTMLDivElement).style.background = c.bgCard; }}
              >
                {/* Avatar */}
                <div style={{
                  width: 40, height: 40, borderRadius: '50%',
                  background: `linear-gradient(135deg, ${c.lemtelBlue}, ${c.avaViolet})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
                  border: dnd ? `2px solid ${c.danger}` : '2px solid transparent',
                  boxShadow: dnd ? `0 0 0 1px ${c.danger}66` : '0 2px 6px rgba(0,0,0,0.18)',
                  letterSpacing: 0.5,
                }}>
                  {initials(name)}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div className="lemtel-contact-name" style={{
                    color: c.textIce, fontSize: 14, fontWeight: 700,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{name}</div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center',
                      background: `${c.signalGold}1f`, color: c.signalGold,
                      border: `1px solid ${c.signalGold}40`,
                      borderRadius: 4, padding: '1px 6px',
                      fontSize: 11, fontWeight: 600, flexShrink: 0,
                    }}>Ext {e.extension}</span>
                    {dnd && <span style={{ fontSize: 10, color: c.danger, fontWeight: 600 }}>DND</span>}
                  </div>
                </div>

                {/* Status dot */}
                <span
                  aria-label={dnd ? 'Do not disturb' : st}
                  title={dnd ? 'Do not disturb' : st}
                  style={{
                    width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0,
                    boxShadow: `0 0 6px ${dotColor}`,
                    animation: isOnline ? 'statusPulse 2s ease-in-out infinite' : 'none',
                  }}
                />

                {/* Call button — always visible */}
                <button
                  onClick={() => onCall(e.extension)}
                  aria-label={`Call ${name}, extension ${e.extension}`}
                  className="lemtel-contact-call"
                  style={{
                    width: 38, height: 38, borderRadius: '50%',
                    background: `linear-gradient(135deg, ${c.success}, ${c.success}cc)`,
                    border: `1px solid ${c.success}59`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', flexShrink: 0,
                    boxShadow: `0 2px 8px ${c.success}4d`,
                    transition: 'transform 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(ev) => {
                    const b = ev.currentTarget;
                    b.style.transform = 'scale(1.1)';
                    b.style.boxShadow = `0 4px 16px ${c.success}8c`;
                  }}
                  onMouseLeave={(ev) => {
                    const b = ev.currentTarget;
                    b.style.transform = 'scale(1)';
                    b.style.boxShadow = `0 2px 8px ${c.success}4d`;
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                    <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" fill="white"/>
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
