# Next Phase — Critical Fixes + Domain Admin + Pending Features

Scope guard: never touch `vite.config.ts`, `electron-builder.yml`, or `.github/workflows/`. Work limited to `apps/ava-softphone-desktop/**`, `apps/ava-softphone-mobile/**`, `src/**`, and `supabase/functions/**`.

## Priority 1 — Inbound SDP rewrite (CRITICAL audio bug)

- Extract a shared helper `rewriteSdpForFusionPBX(sdp)` into `apps/ava-softphone-desktop/src/lib/sip/sdp.ts` (and mirror in `src/lib/softphone/` for portal).
- Strips DTLS/fingerprint/setup lines, removes `m=video` block + related a-lines, keeps only PCMU(0)/PCMA(8) in `m=audio`, rewrites payload list, preserves ICE ufrag/pwd/candidates.
- Apply via `sessionDescriptionHandlerModifiers` on BOTH `session.answer()` and outbound `invite()` paths in `apps/ava-softphone-desktop/src/lib/sip/*` and `src/hooks/useSoftphone.ts` / `jssipProvider`.
- Add unit test covering SDP transform (codecs filtered, ICE intact, no `a=fingerprint`).

## Priority 2 — Dark theme button visibility

- In `apps/ava-softphone-desktop/src/components/SoftphonePane.tsx`, refactor `ControlBtn` to a single styled component using tokens:
  - inactive: `bg: rgba(255,255,255,0.10)`, `border: 1px solid rgba(255,255,255,0.25)`, `color: #fff`
  - active: `bg: rgba(0,200,200,0.30)`, `color: #fff`
  - disabled: opacity 0.5
- Apply to Hold, Mute, Transfer, Record, Hangup-secondary actions; force `color:#fff` on inner label `<span>`.

## Priority 3 — Wide dialer freeze

- Identify wide dialer (`apps/ava-softphone-desktop/src/components/console/DialerView.tsx` or similar).
- Move dial input to local `useState`; remove zustand/global writes per keystroke.
- `React.memo` the `Keypad` component, `useCallback` for `onDigit`, `onBackspace`.
- Debounce side effects (number lookup, formatting, presence query) with 300 ms via small `useDebouncedValue` hook.
- Verify no parent re-renders the whole console tree on each keystroke (profile with React DevTools commit highlight).

## Priority 4 — Chat persistence in OrgChatView

- In `apps/ava-softphone-desktop/src/components/console/OrgChatView.tsx`:
  - Remove all `setMessages([])`.
  - Introduce module-level `Map<orgId, ChatMessage[]>` cache (reuse helpers in `orgChatMerge.ts`).
  - On mount: hydrate from cache → render → fetch fresh → `mergeOnFetch`.
  - Realtime inserts go through `mergeIncoming`; persist back to cache on every update.
  - Keep cache bounded (e.g. last 500 per org).

## Priority 5 — Cross-platform group chat sync

- Standardize channel name `org-chat-${organization_id}` in desktop OrgChatView, `apps/ava-softphone-mobile/src/screens/Chat*.tsx`, and portal `src/pages/.../OrgChat*.tsx`.
- Ensure every INSERT includes `organization_id`, `sender_id`, `content`, `created_at`.
- Migration: confirm/repair RLS on `org_chat_messages` so SELECT requires same-org membership via `public.is_org_member(auth.uid(), organization_id)` security-definer helper (avoid recursion). Add GRANTs if missing.
- Presence sidebar:
  - Query `org_members` for full roster.
  - Join with `user_presence` (last_seen_at within 5 min ⇒ green).
  - Subscribe to `user_presence` realtime to update dots live.
  - Show avatar, display name, status.

## Priority 6 — Call transcription edge function

- `supabase/functions/ai-transcribe-call/index.ts`:
  1. Authenticated PHP session login to `https://pbxnode.lemtel.tel/login.php` (fetch CSRF token from GET first, POST creds, keep cookies).
  2. GET `/app/xml_cdr/download.php?id={xml_cdr_uuid}` → audio buffer.
  3. POST multipart to OpenAI `audio/transcriptions` (model `whisper-1`, language `fr`).
  4. `UPDATE pbx_call_records SET transcription, analyzed=true WHERE xml_cdr_uuid=$1`.
  5. Return `{text, durationMs}`.
- Secret needed: `OPENAI_API_KEY` (request via add_secret). PBX login creds reuse existing `FUSIONPBX_*` secrets.
- `src/components/.../RecordingsList.tsx`: spinner while pending, expandable transcript panel, Retry on error.

## Priority 7 — Admin recordings portal

- `src/pages/lemtel/admin/AdminRecordings.tsx`:
  - Query `pbx_call_records` filtered by active `domain_uuid` (from `useActiveDomain`), 20/page.
  - Columns: caller → destination, datetime, duration, audio (via `fusionpbx-proxy` `get-recording`), Transcribe button, sentiment badge.
  - Graceful "Audio processing…" state + Retry, no terminal error.

## Priority 8 — Contacts view

- `apps/ava-softphone-desktop/src/components/console/ContactsView.tsx`:
  - Source A: `fusionpbx-proxy` `list-extensions` for current domain.
  - Source B: `org_contacts` table for current org.
  - Merge + dedupe by E.164 number.
  - Row: name, number, extension badge, presence dot, click-to-call (`sipProvider.call`), favorite toggle (`org_contacts.is_favorite`).
  - "+ New Contact" dialog → insert into `org_contacts`.

## Priority 9 — Domain admin promotion UI (finalize)

- Confirm existing `CustomerDetail` promote dialog covers role selector; if any user row in Users tab still lacks a "Promote to Admin" inline button, add it (calls existing `customer-invite-admin` with `role: 'org_admin'`).

## Priority 10 — Customer welcome email

- New transactional template `customer-welcome.tsx` under `supabase/functions/_shared/transactional-email-templates/`.
- Subject: "Your Lemtel Communications portal is ready".
- Variables: `portalUrl`, `loginEmail`, `tempPassword`, `domainSlug`, quick-start links.
- Trigger from `customer-invite-admin` (and from customer-creation flow) via `send-transactional-email` with idempotency key `welcome-${user_id}-${org_id}`.
- Use Lovable Emails (scaffold transactional infra if not already present).

## Technical Notes

- New SQL migrations:
  - `org_contacts` table if missing (id, organization_id, name, number, extension, is_favorite, created_by, timestamps) + GRANTs + RLS via `is_org_member`.
  - `is_org_member(user_id, org_id)` SECURITY DEFINER helper if not present.
  - RLS audit on `org_chat_messages` for same-org SELECT.
- New secrets: `OPENAI_API_KEY` (if not set).
- New/edited edge functions to deploy: `ai-transcribe-call`, `customer-invite-admin` (welcome trigger), `send-transactional-email` (templates registry).
- No changes to protected CI/build files.

## Out of Scope

- Mobile UI parity for contacts/recordings (chat sync only).
- Replacing Whisper with another provider.
- Marketing email content.
