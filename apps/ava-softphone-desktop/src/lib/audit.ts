// Phase 5 — fire-and-forget audit logger for the desktop softphone.
// Never throws; never blocks UX. Disabled in mock/demo mode.
import { supabase, SB_URL, SB_KEY } from './supabaseClient';
import { isMockMode } from './buildGuard';

export type AuditAction =
  | 'recording.played'
  | 'recording.downloaded'
  | 'voicemail.played'
  | 'voicemail.downloaded'
  | 'voicemail.deleted'
  | 'sms.sent'
  | 'call.originated'
  | 'call.transferred'
  | 'softphone.signed_in'
  | 'softphone.signed_out'
  | 'pbx.create_denied_non_admin'
  | 'pbx.create_duplicate_detected'
  | 'pbx.create_conflict_resolved'
  | 'pbx.create_idempotent_replay'
  | 'pbx.create_succeeded';

export function audit(action: AuditAction, resourceId?: string | null, metadata?: Record<string, unknown>): void {
  if (isMockMode()) return;
  // Fire-and-forget. Don't await, don't surface errors.
  (async () => {
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) return;
      await fetch(`${SB_URL}/functions/v1/audit-log`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: SB_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, resource_id: resourceId ?? null, metadata: metadata ?? {} }),
        keepalive: true,
      });
    } catch {
      /* swallow — auditing must never break UX */
    }
  })();
}
