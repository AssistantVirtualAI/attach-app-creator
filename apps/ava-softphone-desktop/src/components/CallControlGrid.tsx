import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { theme } from '../lib/theme';
import { useTranslation } from '../lib/i18n';

const { colors: c } = theme;

type Member = {
  user_id: string;
  extension: string | null;
  status: string;
  call_state: string;
  display_name?: string | null;
};

interface Props {
  organizationId: string;
  onDial?: (number: string) => void;
  onTransfer?: (number: string) => void;
}

/**
 * Advanced call-control grid (Phase 5).
 * 3-column layout: Active lines | Hold/Park | BLF (busy-lamp field).
 * Click-to-call and click-to-transfer from BLF rows.
 * Keyboard shortcuts handled by parent (useShortcuts hook).
 */
function CallControlGridImpl({ organizationId, onDial, onTransfer }: Props) {
  const { t } = useTranslation();
  const [members, setMembers] = useState<Member[]>([]);
  const [activeLines, setActiveLines] = useState<any[]>([]);
  const [parked, setParked] = useState<any[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    let cancelled = false;

    const load = async () => {
      const { data: presence } = await supabase
        .from('user_presence')
        .select('user_id, extension, status, call_state')
        .eq('organization_id', organizationId);

      const ids = (presence || []).map((p: any) => p.user_id);
      let profiles: any[] = [];
      if (ids.length) {
        const { data } = await supabase.from('profiles').select('id, full_name').in('id', ids);
        profiles = data || [];
      }
      if (cancelled) return;
      const map = new Map(profiles.map((p) => [p.id, p]));
      setMembers((presence || []).map((p: any) => ({ ...p, display_name: map.get(p.user_id)?.full_name })));
    };

    load();
    const channel = supabase
      .channel(`call-control-${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_presence', filter: `organization_id=eq.${organizationId}` }, load)
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [organizationId]);

  // Poll parked + active lines from PBX. Backs off on repeated failures and
  // pauses while the tab is hidden so the polling doesn't stack up during
  // long active calls (was contributing to wide-layout dialer freezes).
  useEffect(() => {
    let timer: any;
    let cancelled = false;
    let failures = 0;
    let inFlight = false; // single-flight guard — prevents overlapping polls
    const tick = async () => {
      if (cancelled) return;
      if (typeof document !== 'undefined' && document.hidden) {
        timer = setTimeout(tick, 8000);
        return;
      }
      if (inFlight) {
        console.debug('[AVA] call-state poll skipped — previous request still in flight');
        timer = setTimeout(tick, 2000);
        return;
      }
      inFlight = true;
      const startedAt = Date.now();
      let delay = 4000;
      try {
        const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', { body: { action: 'call-state' } });
        if (error) throw error;
        setActiveLines(data?.active || []);
        setParked(data?.parked || []);
        const tookMs = Date.now() - startedAt;
        if (tookMs > 1500) console.warn('[AVA] call-state poll slow', { tookMs, active: data?.active?.length, parked: data?.parked?.length });
        else console.debug('[AVA] call-state poll ok', { tookMs, active: data?.active?.length, parked: data?.parked?.length });
        failures = 0;
      } catch (err) {
        failures = Math.min(failures + 1, 6);
        delay = Math.min(4000 * 2 ** failures, 60_000); // exponential backoff, cap 60s
        console.warn('[AVA] call-state poll failed', { failures, nextDelayMs: delay, err });
      } finally {
        inFlight = false;
      }
      if (!cancelled) timer = setTimeout(tick, delay);
    };
    tick();
    return () => { cancelled = true; clearTimeout(timer); };
  }, []);

  const statusColor = (s: string) => ({
    online: '#22c55e', busy: '#ef4444', away: '#f59e0b', offline: '#64748b',
  } as Record<string, string>)[s] || '#64748b';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, padding: 12, height: '100%', color: '#e2e8f0' }}>
      <Panel title={`Active Lines (${activeLines.length})`}>
        {activeLines.length === 0 && <Empty>No active calls</Empty>}
        {activeLines.map((l: any, i) => (
          <Row key={i}>
            <strong>{l.caller_number || l.from}</strong>
            <span style={{ fontSize: 11, opacity: 0.7 }}>{l.duration || '00:00'}</span>
          </Row>
        ))}
      </Panel>

      <Panel title={`Parked / Hold (${parked.length})`}>
        {parked.length === 0 && <Empty>Nothing parked</Empty>}
        {parked.map((p: any, i) => (
          <Row key={i}>
            <span>Slot {p.slot || i + 1} · {p.caller}</span>
            <button onClick={() => onDial?.(p.slot)} style={btnStyle}>Pickup</button>
          </Row>
        ))}
      </Panel>

      <Panel title={`Team (${members.length})`}>
        {members.map((m) => (
          <Row key={m.user_id}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusColor(m.status) }} />
              {m.display_name || m.extension}
              <span style={{ fontSize: 11, opacity: 0.6 }}>{m.extension}</span>
            </span>
            <span style={{ display: 'flex', gap: 4 }}>
              <button onClick={() => m.extension && onDial?.(m.extension)} style={btnStyle}>Call</button>
              <button onClick={() => m.extension && onTransfer?.(m.extension)} style={btnStyle}>Xfer</button>
            </span>
          </Row>
        ))}
      </Panel>
    </div>
  );
}

const Panel = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <div style={{ background: 'rgba(15,23,42,0.6)', border: '1px solid rgba(148,163,184,0.2)', borderRadius: 8, padding: 12, overflow: 'auto' }}>
    <div style={{ fontSize: 12, textTransform: 'uppercase', opacity: 0.7, marginBottom: 8 }}>{title}</div>
    {children}
  </div>
);
const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid rgba(148,163,184,0.1)' }}>{children}</div>
);
const Empty = ({ children }: { children: React.ReactNode }) => (
  <div style={{ fontSize: 12, opacity: 0.5, padding: '8px 0' }}>{children}</div>
);
const btnStyle: React.CSSProperties = {
  background: 'rgba(0,35,230,0.2)', color: '#e2e8f0', border: '1px solid rgba(0,35,230,0.4)',
  borderRadius: 4, padding: '2px 8px', fontSize: 11, cursor: 'pointer',
};

export default React.memo(CallControlGridImpl);

