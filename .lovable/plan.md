# Plan — Visual Refresh + AI Analysis Page

## 1. Visual refresh (modern, AI-flavored)

Goal: cohesive cyberpunk / glass-morphism AI aesthetic across web app + desktop softphone, without changing business logic.

### 1.1 Design tokens (`src/index.css`, `tailwind.config.ts`)
- New semantic tokens (HSL only):
  - `--surface-glass`, `--surface-elevated`, `--border-glow`
  - `--gradient-ai`: indigo → cyan → gold sweep
  - `--gradient-mesh`: animated radial mesh for hero backgrounds
  - `--shadow-glow-primary`, `--shadow-glow-accent`
  - `--ring-ai` (focus ring)
- Utility classes: `.glass-card`, `.ai-border`, `.ai-glow`, `.ai-grid-bg` (subtle dotted/grid overlay), `.ai-text-gradient`.
- Keep Inter / Fira Code; add display weight 800 for hero numerals.

### 1.2 Shared visual primitives (`src/components/ui/ai/`)
- `GlassCard.tsx` – frosted panel with animated gradient border.
- `AIBadge.tsx` – small "AI" pill with pulsing dot.
- `MeshBackground.tsx` – animated SVG/CSS mesh (no heavy deps).
- `StatTile.tsx` – KPI tile w/ sparkline + glow.
- `SectionHeader.tsx` – icon + gradient title + subtitle.

### 1.3 Layout polish
- AppShell sidebar: condensed icons, active item with neon underline + glow.
- Topbar: glass blur, status dot, AI quick-action button (opens AI Analysis).
- Cards across Dashboard / Conversations / Leads / Telephony switch to `GlassCard`.
- Charts: unify Recharts theme (HSL tokens, gradient fills, rounded bars, soft grid).
- Empty states: illustrated with `MeshBackground` + AI badge.

### 1.4 Desktop softphone (`apps/ava-softphone-desktop`)
- Reuse `LemtelLogo` (already shared).
- Apply gradient borders + glow to keypad buttons, status select, call control pills.
- Footer keeps logo; add subtle moving gradient line above border.

### 1.5 Auth + Portal landing
- Auth page: mesh background, glass form card, gradient CTA, logo halo.
- Lemtel portal dashboard: replace flat cards with `GlassCard` + `StatTile`.

## 2. AI Analysis page

Goal: a single page that ingests existing app data (calls, recordings, conversations, leads) and produces AI summaries + insights via Lovable AI Gateway.

### 2.1 Route + nav
- New route: `/ai-insights` (admin) and `/org/lemtel/portal/ai-insights` (portal).
- Sidebar entry "AI Insights" with `AIBadge`.

### 2.2 Page sections (`src/pages/AIInsights.tsx`)
1. **Overview strip** — period selector (24h / 7d / 30d), 4 `StatTile`s: total calls, avg duration, sentiment score, top topic.
2. **Call summaries feed** — paginated list of recent calls with: caller, duration, AI summary (2–3 lines), sentiment chip, action items, "View transcript" drawer.
3. **Recording analysis** — when a recording URL exists (`pbx_call_recordings` / `lemtel-recordings` bucket), transcribe (ElevenLabs STT already integrated) then summarize.
4. **Topic clusters** — bar/treemap of detected topics across the period.
5. **Lead intelligence** — AI scoring of leads (intent, urgency, next best action).
6. **Ask AI** — free-form chat box scoped to the org's data (RAG-lite: send aggregated context, not raw rows).

### 2.3 Data sources (already in DB)
- `pbx_calls`, `pbx_call_recordings`, `pbx_sms_messages`
- `conversations`, `conversation_analysis`
- `leads`
- Storage bucket `lemtel-recordings` (signed URLs only, server-side).

### 2.4 Edge functions (new, all `verify_jwt = false` + in-code JWT + org membership check)
- `ai-summarize-call` — input: `{ callId }`. Loads call + transcript (or transcribes via ElevenLabs if only audio), returns `{ summary, sentiment, topics, actionItems }` via `google/gemini-3-flash-preview` with tool-calling schema.
- `ai-period-insights` — input: `{ organizationId, from, to }`. Aggregates counts/topics, asks Gemini for narrative + recommendations.
- `ai-score-leads` — input: `{ organizationId, leadIds? }`. Returns score + reasoning per lead.
- `ai-ask` — streaming chat endpoint (SSE) scoped to org context bundle.
- All call Lovable AI Gateway (`https://ai.gateway.lovable.dev/v1/chat/completions`) with `LOVABLE_API_KEY`; surface 429/402 to client toasts.

### 2.5 Caching
- New table `ai_call_summaries` (call_id PK, organization_id, summary jsonb, model, created_at) with RLS scoped to org members; GRANT to authenticated + service_role.
- Reuse summary if `created_at` newer than recording's `updated_at`.

### 2.6 Frontend hooks
- `useCallSummary(callId)` – fetches cached or triggers edge function.
- `usePeriodInsights(range)` – memoized, cached 10 min.
- `useAskAI()` – SSE stream with token-by-token rendering and markdown via `react-markdown`.

### 2.7 Security
- All edge functions validate JWT + verify `organization_members` membership before reading rows or signing recording URLs.
- Frontend reads only from `_safe` views; raw recordings accessed exclusively via signed URLs from edge functions.

## 3. Rollout order
1. Design tokens + shared `ui/ai/*` primitives.
2. Apply primitives to Dashboard, Conversations, Lemtel portal dashboard (visible wins first).
3. Migration: `ai_call_summaries` table + RLS + grants.
4. Edge functions: `ai-summarize-call`, `ai-period-insights`, `ai-score-leads`, `ai-ask`.
5. Build `/ai-insights` page wired to those functions.
6. Add sidebar entry + portal mirror route.
7. Polish softphone + Auth visuals.
8. Manual QA across desktop / tablet / mobile + hard refresh.

## 4. Out of scope
- No new auth providers, billing changes, or schema beyond `ai_call_summaries`.
- No replacement of existing Recharts library — only theming.
- No real-time transcription pipeline changes beyond reusing current ElevenLabs STT.
