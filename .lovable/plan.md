# Phase 5 — Final Closeout Plan

## Audit of the 10 priorities

| # | Priority | Status | Evidence |
|---|---|---|---|
| 1 | Inbound SDP rewrite | Done | `sdpModifier` applied at `answer()`, `invite()`, and initial UA in `apps/ava-softphone-desktop/src/lib/sip/jssipProvider.ts` (lines 764, 839, 871) |
| 2 | Dark-theme `ControlBtn` | Done | White text on translucent surface in `SoftphonePane.tsx` (lines 1128-1175) |
| 3 | Wide-dialer freeze | Done | `MemoKeypad = React.memo(DialerKeypad)` + `useCallback` stable handlers in `SoftphonePane.tsx` |
| 4 | Chat persistence | Done | Module-level `CHANNEL_CACHE` + `mergeIncoming` / `mergeOnFetch` in `OrgChatView.tsx` |
| 5 | Cross-platform chat sync | Done | Standard `org-chat-${channelId}` postgres-changes channel scoped by `organization_id`; presence channel `org-chat-presence-${orgId}` |
| 6 | Call transcription | Done | `ai-transcribe-call` resolves audio (storage / FusionPBX proxy / Twilio proxy) and calls Lovable AI Gateway (`google/gemini-2.5-pro`); writes to `pbx_call_transcripts`; full audit log |
| 7 | Admin recordings portal | Done | `src/pages/lemtel/admin/AdminRecordings.tsx` (414 lines) |
| 8 | Contacts view | Done | `apps/ava-softphone-desktop/src/components/console/ContactsView.tsx` (609 lines) |
| 9 | Domain-admin promotion | Done | `customer-invite-admin` accepts `role: 'org_admin' \| 'manager'`, returns `invite_url`; `CustomerDetail.tsx` shows role picker + invite link |
| 10 | Customer welcome email | **Not done** | No `_shared/transactional-email-templates/` directory, no call to `send-transactional-email` from `customer-invite-admin` |

## What this plan ships

Only **P10** remains. Steps:

### 1. Email infrastructure
- Use the project's custom domain `avastatistic.ca` (already verified via `get_project_custom_domain`).
- Run `email_domain--setup_email_infra` to create the pgmq queue, RPCs, send log, suppression list, unsubscribe tokens, `process-email-queue` worker, and cron job.
- Run `email_domain--scaffold_transactional_email` to create `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, and the template registry.

### 2. Welcome email template
- New file `supabase/functions/_shared/transactional-email-templates/customer-welcome.tsx` (React Email, brand-aligned: glass/cyberpunk accent `#0023e6`, Inter, `Body` background `#ffffff`).
- Props: `customerName`, `portalUrl` (`https://avastatistic.ca/domain/{slug}/admin`), `loginEmail`, `temporaryPassword`, `role` (`org_admin` | `manager`).
- Content: greeting, what their portal does, credentials block, quick-start links (Add extension, Configure IVR, Business hours, Recordings), CTA button to portal.
- Register in `_shared/transactional-email-templates/registry.ts` as `customer-welcome`.

### 3. Unsubscribe page
- New route `src/pages/EmailUnsubscribe.tsx` at the path returned by `scaffold_transactional_email`; GET-validates the `token`, POSTs to confirm, shows success / already-unsubscribed / invalid states with brand styling.
- Register the route in `src/App.tsx`.

### 4. Wire the trigger
- In `supabase/functions/customer-invite-admin/index.ts`, after successfully creating the admin user, invoke `send-transactional-email` with:
  - `templateName: 'customer-welcome'`
  - `recipientEmail: <admin email>`
  - `idempotencyKey: welcome-${user_id}-${organization_id}`
  - `templateData: { customerName, portalUrl, loginEmail, temporaryPassword, role }`
- Failure to enqueue must NOT fail the admin-creation response; log and continue.

### 5. Deploy
- `deploy_edge_functions` for `send-transactional-email`, `handle-email-unsubscribe`, `handle-email-suppression`, `process-email-queue`, `customer-invite-admin`.

### 6. Smoke test
- Use `curl_edge_functions` to call `send-transactional-email` with `previewData` to verify the template renders and enqueues, then check `email_send_log`.

## Out of scope
- No changes to `vite.config.ts`, `electron-builder.yml`, `.github/workflows/`.
- No re-work of P1-P9 (already verified).
- No marketing/newsletter emails.

## Files to add / edit
- add `supabase/functions/_shared/transactional-email-templates/customer-welcome.tsx`
- edit `supabase/functions/_shared/transactional-email-templates/registry.ts` (created by scaffold)
- edit `supabase/functions/customer-invite-admin/index.ts` (trigger send + pass `portalUrl`)
- add `src/pages/EmailUnsubscribe.tsx` and route in `src/App.tsx`
