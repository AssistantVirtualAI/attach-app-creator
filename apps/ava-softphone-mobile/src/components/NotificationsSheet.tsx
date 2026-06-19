import React, { useEffect, useMemo, useState } from 'react';
import { Bell, PhoneMissed, Voicemail, MessageSquare, Disc, X } from 'lucide-react';
import { colors, font, radius } from '../lib/theme';
import { mobileApi, CallRecord, VoicemailEntry, SmsThread, RecordingEntry } from '../lib/mobileApi';
import type { Tab } from './BottomTabs';

type Counts = { missed: number; voicemails: number; recordings: number; sms: number; total: number };

export function useNotificationCounts(): Counts {
  const [c, setC] = useState<Counts>({ missed: 0, voicemails: 0, recordings: 0, sms: 0, total: 0 });
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const [calls, vms, threads, recs] = await Promise.all([
          mobileApi.calls({ rangeDays: 7 }).catch(() => [] as CallRecord[]),
          mobileApi.voicemails().catch(() => [] as VoicemailEntry[]),
          mobileApi.threads().catch(() => [] as SmsThread[]),
          mobileApi.recordings(undefined, { rangeDays: 1 }).catch(() => [] as RecordingEntry[]),
        ]);
        const cutoff = Date.now() - 24 * 36e5;
        const missed = (calls as CallRecord[]).filter((x) => x.status === 'missed' && new Date(x.startedAt).getTime() >= cutoff).length;
        const voicemails = (vms as VoicemailEntry[]).filter((x) => x.isNew).length;
        const sms = (threads as SmsThread[]).reduce((s, t) => s + (t.unread || 0), 0);
        const recordings = (recs as RecordingEntry[]).length;
        if (!alive) return;
        const total = missed + voicemails + sms + recordings;
        setC({ missed, voicemails, recordings, sms, total });
      } catch {}
    };
    load();
    const id = window.setInterval(load, 60_000);
    return () => { alive = false; window.clearInterval(id); };
  }, []);
  return c;
}

export default function NotificationsSheet({
  open, onClose, onNavigate,
}: { open: boolean; onClose: () => void; onNavigate: (t: Tab) => void }) {
  const c = useNotificationCounts();
  const items = useMemo(() => ([
    { tab: 'calls' as Tab, icon: PhoneMissed, label: 'Missed calls (24h)', count: c.missed, tone: '#ff5a5a' },
    { tab: 'voicemail' as Tab, icon: Voicemail, label: 'New voicemails', count: c.voicemails, tone: colors.signalGold },
    { tab: 'recordings' as Tab, icon: Disc, label: 'New recordings (24h)', count: c.recordings, tone: colors.avaCyan },
    { tab: 'sms' as Tab, icon: MessageSquare, label: 'Unread messages', count: c.sms, tone: colors.lemtelBlue },
  ]), [c]);

  if (!open) return null;
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 70,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 480, background: colors.midnight, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
          padding: 16, boxShadow: '0 -12px 32px rgba(0,0,0,0.4)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bell size={18} color={colors.textIce} />
            <span style={{ fontSize: font.md, fontWeight: 800, color: colors.textIce }}>Notifications</span>
          </div>
          <button onClick={onClose} aria-label="Close" style={{ background: 'transparent', border: 0, color: colors.textSub, cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>
        {c.total === 0 && (
          <div style={{ padding: 24, textAlign: 'center', color: colors.textSub, fontSize: font.sm }}>
            You're all caught up.
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {items.map(({ tab, icon: Icon, label, count, tone }) => (
            <button
              key={label}
              onClick={() => { onClose(); onNavigate(tab); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)',
                borderRadius: radius.lg, cursor: 'pointer', color: colors.textIce, textAlign: 'left',
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: `${tone}22`, color: tone, flexShrink: 0,
              }}>
                <Icon size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: font.sm, fontWeight: 700 }}>{label}</div>
                <div style={{ fontSize: 11, color: colors.textSub }}>{count > 0 ? `${count} new` : 'No new items'}</div>
              </div>
              {count > 0 && (
                <span style={{
                  minWidth: 22, height: 22, padding: '0 6px', borderRadius: 11, background: tone, color: '#fff',
                  fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center',
                }}>{count > 99 ? '99+' : count}</span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function NotificationBell({ onClick, count }: { onClick: () => void; count: number }) {
  return (
    <button
      onClick={onClick}
      aria-label="Notifications"
      style={{
        position: 'relative',
        width: 32, height: 32, borderRadius: '50%',
        background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(255,255,255,0.18)',
        color: colors.textIce, cursor: 'pointer', display: 'grid', placeItems: 'center',
      }}
    >
      <Bell size={15} />
      {count > 0 && (
        <span style={{
          position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, padding: '0 4px',
          borderRadius: 8, background: '#ff3b3b', color: '#fff', fontSize: 10, fontWeight: 800,
          display: 'grid', placeItems: 'center', border: `2px solid ${colors.midnight}`,
        }}>{count > 9 ? '9+' : count}</span>
      )}
    </button>
  );
}
