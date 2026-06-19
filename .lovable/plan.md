# AVA Assistant — Agentic Chatbot

A single AI assistant available in Web, Desktop, and Mobile that can read PBX data, analyze recordings, run reports, and take actions (with confirmation) across the caller's PBX domain.

## Architecture

```text
[Web /  Desktop / Mobile chat UI]
          │  POST {messages, threadId}
          ▼
supabase/functions/ava-assistant   ← new edge function (verify JWT in code)
  ├─ AI SDK streamText + Lovable AI Gateway (google/gemini-3-flash-preview)
  ├─ Tools (Zod) → call existing edge functions + service-role queries
  │    • read_calls / read_recordings / read_voicemails
  │    • read_sms_threads / read_contacts / read_presence / read_extensions
  │    • analyze_recording (transcript + summary)
  │    • run_report  (volume, missed, talk-time, per-extension)
  │    • send_sms     (needsApproval)
  │    • click_to_call(needsApproval)
  │    • blind_transfer(needsApproval)
  │    • play_voicemail(returns signed URL)
  └─ stopWhen: stepCountIs(50)
          │
          ▼
[ava_chat_threads / ava_chat_messages] (per-user persistence)
```

Backend boundary stays in the edge function. `LOVABLE_API_KEY` and service-role calls never leave the server.

## Tools (server-side)

| Tool | Action | Confirm |
|---|---|---|
| `read_calls` | pbx_call_records filtered by domain + range + extension | no |
| `read_recordings` | pbx_call_records where has_recording, with transcript flags | no |
| `analyze_recording` | fetch transcript + ai_summary; if missing, enqueue ai_job | no |
| `read_voicemails` | pbx_voicemails, mark read on request | no |
| `read_sms_threads` / `read_sms_messages` | pbx_sms_threads / pbx_sms_messages | no |
| `read_contacts` | org_contacts (domain scope) | no |
| `read_presence` | user_presence + pbx_softphone_users | no |
| `read_extensions` | pbx_extensions_directory (domain scope) | no |
| `run_report` | aggregate calls/missed/talk/handle by extension or day | no |
| `send_sms` | proxies `pbx-sms-send` | **yes** |
| `click_to_call` | proxies `pbx-click-to-call` | **yes** |
| `blind_transfer` | proxies `pbx-call-transfer` | **yes** |
| `get_voicemail_url` | signed URL from `softphone-recording-url` | no |

All tools scope by `domain_uuid` resolved from `pbx_softphone_users` for `auth.uid()`.

## Chat persistence

New tables (one conversation per user, but with history):
- `ava_chat_threads(id, user_id, title, created_at, updated_at)`
- `ava_chat_messages(id, thread_id, role, parts jsonb, created_at)`

RLS: user can read/write own threads only. GRANTs to `authenticated` + `service_role`.

## Frontend

Shared component `src/components/ava/AvaAssistant.tsx` (web), reused via thin wrappers:
- Desktop: `apps/ava-softphone-desktop/src/components/AvaAssistant.tsx`
- Mobile: `apps/ava-softphone-mobile/src/screens/AssistantScreen.tsx`

Uses `@ai-sdk/react` `useChat` with `DefaultChatTransport` pointed at `${SUPABASE_URL}/functions/v1/ava-assistant`. Renders `message.parts` with `react-markdown`. Tool calls render as small cards; mutating tools show a Confirm/Cancel button before execution (`needsApproval` via AI SDK pattern).

Entry points:
- Web: floating button in `MyAppShell` → drawer.
- Desktop: new sidebar item "Assistant".
- Mobile: new bottom-tab "Assistant".

## Technical details

- Edge function: `supabase/functions/ava-assistant/index.ts` using `npm:ai` + `@ai-sdk/openai-compatible` via shared `_shared/ai-gateway.ts`.
- JWT validated in code with `getClaims()`; resolve `domain_uuid` once per request.
- Tool inputs validated with `zod`; results compact JSON, capped to 50 rows.
- `stopWhen: stepCountIs(50)`.
- Confirmation: assistant calls mutating tool with `needsApproval`; UI surfaces approval card before the tool `execute` runs.
- Reports computed in SQL via `read_query`-style helpers (date_trunc, count, sum duration_seconds).

## Files

New:
- `supabase/functions/ava-assistant/index.ts`
- `supabase/functions/_shared/ai-gateway.ts` (if absent)
- `supabase/migrations/<ts>_ava_assistant.sql` (tables, grants, RLS)
- `src/components/ava/AvaAssistant.tsx`, `useAvaChat.ts`, `ToolCallCard.tsx`
- `apps/ava-softphone-desktop/src/components/AvaAssistant.tsx`
- `apps/ava-softphone-mobile/src/screens/AssistantScreen.tsx`

Edited:
- `src/components/my/MyAppShell.tsx` (floating button)
- Desktop sidebar + router
- Mobile tab navigator

## Out of scope

- Cross-domain access (always domain-scoped).
- Background/scheduled agent runs.
- Voice input/output (text chat only for v1).
