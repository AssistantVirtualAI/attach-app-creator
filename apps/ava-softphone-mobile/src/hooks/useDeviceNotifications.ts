/**
 * Subscribes to realtime feeds (CDRs + SMS) and fires native on-device
 * banner/lock-screen notifications for missed calls, voicemails and
 * incoming SMS — independent of the in-app NotificationsSheet.
 */
import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/mobileSupabase';
import type { Creds } from '../lib/creds';
import { ensureNotificationPermission, initNotificationChannels, showLocalNotification } from '../lib/localNotifications';
import { navigateTo } from '../lib/appRouter';

export function useDeviceNotifications(creds: Creds | null) {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    if (!creds?.accessToken) return;
    let cancelled = false;
    let cdrCh: any = null;
    let smsCh: any = null;
    let vmCh: any = null;

    (async () => {
      await initNotificationChannels();
      await ensureNotificationPermission();
      if (cancelled) return;

      try { supabase.realtime.setAuth(creds.accessToken!); } catch {}

      const ext = creds.extension;
      const orgId = creds.organizationId;
      const adminScope = creds.dataScope === 'domain_admin' || !!creds.permissions?.admin;
      const cdrFilter = adminScope && orgId ? `organization_id=eq.${orgId}` : ext ? `extension=eq.${ext}` : `organization_id=eq.${orgId}`;

      cdrCh = supabase.channel(`notif-cdr-${ext || orgId || 'all'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_call_records', filter: cdrFilter }, (payload) => {
          const r: any = payload.new;
          const billsec = Number(r?.billsec ?? r?.duration_seconds ?? 0);
          const missed = r?.missed_call || r?.hangup_cause === 'NO_ANSWER' || billsec === 0;
          const direction = r?.direction === 'outbound' ? 'out' : 'in';
          if (direction !== 'in') return;
          const from = r?.caller_name || r?.caller_number || 'Unknown';
          if (r?.voicemail_message) {
            showLocalNotification({
              kind: 'voicemail',
              title: `New voicemail from ${from}`,
              body: 'Tap to listen',
              dedupeKey: `vm-${r.id}`,
              extra: { callId: r.id, route: 'voicemail' },
            });
          } else if (missed) {
            showLocalNotification({
              kind: 'missed_call',
              title: `Missed call from ${from}`,
              body: r?.caller_number || '',
              dedupeKey: `missed-${r.id}`,
              extra: { callId: r.id, route: 'calls', number: r?.caller_number },
            });
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'pbx_call_records', filter: cdrFilter }, (payload) => {
          const r: any = payload.new;
          if (r?.voicemail_message && !payload.old?.voicemail_message) {
            const from = r?.caller_name || r?.caller_number || 'Unknown';
            showLocalNotification({
              kind: 'voicemail',
              title: `New voicemail from ${from}`,
              body: 'Tap to listen',
              dedupeKey: `vm-${r.id}`,
              extra: { callId: r.id, route: 'voicemail' },
            });
          }
        })
        .subscribe();

      const smsFilter = ext ? `to_extension=eq.${ext}` : orgId ? `organization_id=eq.${orgId}` : undefined;
      smsCh = supabase.channel(`notif-sms-${ext || orgId || 'all'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_sms_messages', ...(smsFilter ? { filter: smsFilter } : {}) } as any, (payload: any) => {
          const r: any = payload.new;
          if (r?.direction === 'outbound' || r?.from_extension === ext) return;
          showLocalNotification({
            kind: 'sms',
            title: `New message from ${r?.from_number || 'Unknown'}`,
            body: String(r?.body || r?.text || '').slice(0, 140),
            dedupeKey: `sms-${r?.id}`,
            extra: { messageId: r?.id, threadId: r?.thread_id, route: 'chats' },
          });
        })
        .subscribe();

      vmCh = supabase.channel(`notif-vm-${ext || orgId || 'all'}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_voicemails', ...(orgId ? { filter: `organization_id=eq.${orgId}` } : {}) } as any, (payload: any) => {
          const r: any = payload.new;
          const from = r?.caller_id_name || r?.caller_id_number || 'Unknown';
          showLocalNotification({
            kind: 'voicemail',
            title: `New voicemail from ${from}`,
            body: 'Tap to listen',
            dedupeKey: `vm-${r?.id}`,
            extra: { voicemailId: r?.id, route: 'voicemail' },
          });
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      try { cdrCh && supabase.removeChannel(cdrCh); } catch {}
      try { smsCh && supabase.removeChannel(smsCh); } catch {}
      try { vmCh  && supabase.removeChannel(vmCh ); } catch {}
    };
  }, [creds?.accessToken, creds?.extension, creds?.organizationId, creds?.dataScope, creds?.permissions?.admin]);
}
