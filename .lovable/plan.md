# Phase 5 — Audit trail for sensitive actions (desktop + mobile)

Scope: `apps/ava-softphone-desktop`, `apps/ava-softphone-mobile`, `supabase/functions/fusionpbx-proxy`. No UI redesign, no compact mode (next phase). Builds on Phase 2's `recording.signed_url_issued`.

## Goal

Every sensitive softphone action lands in `audit_logs` with `{actor_user_id, organization_id, action, resource_type, resource_id, metadata, ip, user_agent}`. Closes the "Audit" line of the acceptance matrix.

## New `audit-log` edge function

Single server endpoint `POST /audit-log` that:
- Resolves the caller from the bearer (Supabase Auth).
- Resolves their `organization_id` via existing `get_my_extension_summary()` / `current_user_org_ids()`.
- Whitelists `action` values; rejects anything else (no free-form client-supplied actions).
- Inserts into `public.audit_logs` with service role.

Whitelisted actions (constants):

| action | resource_type | when fired |
|---|---|---|
| `recording.played` | `pbx_call_record` | user starts playback in Recordings or Voicemail |
| `recording.downloaded` | `pbx_call_record` | user clicks download |
| `voicemail.played` | `pbx_voicemail` | user starts voicemail playback |
| `voicemail.downloaded` | `pbx_voicemail` | user downloads voicemail |
| `voicemail.deleted` | `pbx_voicemail` | user deletes a voicemail |
| `sms.sent` | `pbx_sms_thread` | user sends SMS from desktop/mobile |
| `call.originated` | `pbx_extension` | user initiates an outbound call |
| `call.transferred` | `pbx_call_record` | blind/attended transfer triggered |
| `softphone.signed_in` | `pbx_softphone_user` | successful sign-in |
| `softphone.signed_out` | `pbx_softphone_user` | sign-out |

Server-side `recording.signed_url_issued` (Phase 2) stays as-is — it's the cryptographic proof. Client `recording.played` is the user-intent proof.

## Client wiring

New tiny helper `src/lib/audit.ts` (same shape in both apps):

```ts
export async function audit(action: AuditAction, resourceId?: string, metadata?: Record<string, unknown>)
```

Behavior:
- Fire-and-forget POST to `audit-log` edge function with current Supabase session token.
- Never throws (audit failure must not break UX).
- Drops the call when `isMockMode()` is true.

Wiring points:

**Desktop**
- `components/RecordingsList.tsx`, `console/RecordingsView.tsx` — on `<audio>` `play` + download button.
- `components/VoicemailList.tsx`, `console/VoicemailView.tsx` — on play, download, delete.
- `components/SmsThreads.tsx`, `console/MessagesView.tsx` — on send success.
- `lib/sip/*` outbound call entry point — on `originate` and on `transfer`.
- `App.tsx` — on session restore (signed_in) and on sign-out.

**Mobile**
- `screens/VoicemailScreen.tsx` — play, download, delete.
- `screens/MessagesScreen.tsx` — send.
- `screens/DialerScreen.tsx` — call originate.
- `screens/AuthScreen.tsx` — sign-in / sign-out.

## Permissions / RLS

`audit_logs` already has policies (per `<supabase-tables>`: 2 policies). The new edge function uses service role to insert, so RLS is bypassed for writes; reads stay under existing RLS. No migration needed.

## Verification

- Trigger each action in dev and confirm a matching row in `audit_logs` with the correct `organization_id` for the active user.
- Confirm a non-whitelisted `action` value is rejected with 400.
- Confirm logging failures don't surface as UI errors.

## Out of scope

Compact mode rebuild, UI/design cohesion pass, packaging hardening, E2E tests. Those follow in Phase 6+.

## Files touched

```
supabase/functions/audit-log/index.ts                       (new)
supabase/config.toml                                        (register function, verify_jwt = true)

apps/ava-softphone-desktop/src/lib/audit.ts                 (new)
apps/ava-softphone-desktop/src/App.tsx                      (sign-in/out)
apps/ava-softphone-desktop/src/components/RecordingsList.tsx
apps/ava-softphone-desktop/src/components/VoicemailList.tsx
apps/ava-softphone-desktop/src/components/SmsThreads.tsx
apps/ava-softphone-desktop/src/components/console/RecordingsView.tsx
apps/ava-softphone-desktop/src/components/console/VoicemailView.tsx
apps/ava-softphone-desktop/src/components/console/MessagesView.tsx
apps/ava-softphone-desktop/src/lib/sip/jssipProvider.ts     (originate/transfer hooks)

apps/ava-softphone-mobile/src/lib/audit.ts                  (new)
apps/ava-softphone-mobile/src/screens/AuthScreen.tsx
apps/ava-softphone-mobile/src/screens/VoicemailScreen.tsx
apps/ava-softphone-mobile/src/screens/MessagesScreen.tsx
apps/ava-softphone-mobile/src/screens/DialerScreen.tsx
```

No DB migration, no schema change.
