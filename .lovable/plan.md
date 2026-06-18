
# Universal call intelligence: transcribe → analyze → coach (once per recording)

## Goal

Every call recording is processed exactly **once**:
1. Transcribed to text
2. Analyzed (sentiment, topics, intent, satisfaction)
3. Summarized
4. Enriched with **action items** and **coaching notes**

Results are stored in the database and surfaced identically in the **admin portal**, the **desktop softphone**, and the **mobile softphone**. No app ever re-runs work that already exists.

---

## Single source of truth (DB)

Reuse existing tables — no schema change required:

- `pbx_call_transcripts` → transcript text (already exists)
- `pbx_ai_insights` → summary, sentiment, topics, action_items, key_phrases, etc. (already exists)
- Extend `pbx_ai_insights` with two text[] columns via migration:
  - `coaching_notes text[]` — concrete coaching feedback for the agent
  - `coaching_score numeric` — overall 1–5 quality rating

A recording is "fully processed" when both a transcript row AND an insight row exist for its `call_record_id`. The `pbx_call_records.transcribed` and `analyzed` boolean flags are the fast lookup signal already used by the UI.

---

## Single processing pipeline (edge function)

Create one orchestrator function: **`process-call-recording`** (idempotent).

Input: `{ callId }` (or `pbx_uuid`).

Flow:
1. Load `pbx_call_records` row + membership/permission check.
2. **Short-circuit**: if `pbx_ai_insights` row exists AND `pbx_call_transcripts` row exists → return cached result immediately. No model calls, no billing.
3. If no transcript:
   - Use existing `ai-transcribe-call` (with the pending-sync exponential backoff already built last turn).
   - On `pending_sync`, return status so the client shows the pending pill; do NOT mark analyzed.
4. If transcript exists but no insight:
   - Call Lovable AI Gateway (`google/gemini-3-flash-preview`) with one tool schema that returns:
     `summary, sentiment, satisfaction_score, quality_score, intent, topics[], action_items[], coaching_notes[], coaching_score, risks[], sales_opportunities[], key_phrases[], escalation_needed`
   - Insert into `pbx_ai_insights` (delete-then-insert keyed by `call_record_id`).
   - Set `pbx_call_records.transcribed = true, analyzed = true`.
5. Return the cached/just-written insight payload.

Concurrency guard: use an advisory lock on `call_record_id` (or a `processing` flag with a short TTL) so two clients hitting "Analyze" at the same moment don't double-bill.

The existing `ai-summarize-call` becomes a thin wrapper that calls `process-call-recording`, so existing UI keeps working.

---

## Auto-trigger (so users never have to click)

Trigger `process-call-recording` automatically when a recording becomes available:
- In the FusionPBX/CDR sync code path that flips `pbx_call_records.has_recording = true` (or inserts into `pbx_call_recordings`), enqueue a call to the orchestrator.
- Also add a **backfill button + nightly cron** that finds rows where `has_recording = true AND analyzed = false` and processes them in small batches with rate-limit backoff.

This guarantees the work happens once, in the background, regardless of which app the user opens first.

---

## Shared client hook

Add `src/hooks/useCallIntelligence.ts` used by all three apps (web portal, desktop, mobile):

- React Query key: `["call-intel", callId]`
- Reads `pbx_ai_insights` + `pbx_call_transcripts` directly (RLS scoped).
- If missing, calls `process-call-recording` once and caches the result.
- Exposes `{ transcript, summary, sentiment, actionItems, coachingNotes, coachingScore, status }`.
- Long `staleTime` (e.g. 24h) — insights are immutable per recording.

Mirror the hook into `apps/ava-softphone-desktop/src/hooks/` and `apps/ava-softphone-mobile/src/hooks/` (same logic, same query key shape).

---

## UI surfaces (read-only consumers of the same data)

All three apps render the same `<CallIntelligencePanel />` component (per-app copy, identical contract):

- **Summary** (2–4 sentences)
- **Sentiment + satisfaction + quality score** badges
- **Action items** checklist
- **Coaching notes** section with score
- **Transcript** (collapsible)
- **Pending sync** pill (reuses last turn's component) when transcript isn't ready yet
- **"Force re-analyze"** button — admin-only, sends `{ force: true }`

Surfaces to wire:
- Portal: `src/pages/telephony/TelephonyRecordings.tsx`, conversation detail dialogs, `MyRecordings.tsx`
- Desktop: call history detail pane in `apps/ava-softphone-desktop/src/components/`
- Mobile: recording detail screen in `apps/ava-softphone-mobile/src/screens/`

---

## "Done once" guarantees

1. DB short-circuit in `process-call-recording` (step 2 above).
2. Advisory lock prevents concurrent duplicates.
3. Client hook caches via React Query + DB row; never calls the function if rows exist.
4. Auto-trigger on recording arrival means the typical case is "already done before user opens it".
5. Only `force: true` (admin) bypasses the cache.

---

## Technical details

**Migration**
```sql
ALTER TABLE public.pbx_ai_insights
  ADD COLUMN IF NOT EXISTS coaching_notes text[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS coaching_score numeric;
```

**New files**
- `supabase/functions/process-call-recording/index.ts`
- `src/hooks/useCallIntelligence.ts` (+ desktop/mobile mirrors)
- `src/components/calls/CallIntelligencePanel.tsx` (+ desktop/mobile mirrors)
- `supabase/migrations/<ts>_call_intel_coaching.sql`

**Edited**
- `supabase/functions/ai-summarize-call/index.ts` → delegate to orchestrator
- CDR/recording ingest path → enqueue orchestrator
- Portal/desktop/mobile recording detail screens → mount `<CallIntelligencePanel />`

**Model**: `google/gemini-3-flash-preview` via Lovable AI Gateway with a single `save_insight` tool that includes the new coaching fields.

---

## Out of scope (ask if you want them)

- Real-time live-call coaching (this plan covers post-call only).
- Multi-language coaching style customization per org.
- Manual editing of AI coaching notes by supervisors.
