
# Multi-Phase Implementation Plan

Scope: Planiprêt admin + mobile app (`/planipret/mobile`). Delivered in 5 phases, each independently shippable.

---

## Phase 1 — Microsoft 365 Live Connection Test

**Goal:** Verify real MS365 credentials from the Integrations page.

- Create edge function `supabase/functions/ms365-connection-test/index.ts`:
  - App-only OAuth2 token via `login.microsoftonline.com/{tenant}/oauth2/v2.0/token`
  - Runs 5 sub-tests: auth, `/organization`, `/users?$top=5`, `/applications` (redirect URIs), `/servicePrincipals` (permissions)
  - Returns `{ summary, results }` JSON with CORS
- Requires secrets: `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` (confirm present via `fetch_secrets`, request any missing).
- UI: add "🔬 Test en direct" section inside the MS365 card in `src/pages/planipret/admin/PAIntegrations.tsx` (or equivalent):
  - Blue MS-branded button → invokes function
  - Row-per-test result with ✅/❌ icon, message, expandable JSON detail
  - Summary bar (passed/total, elapsed ms, timestamp)
  - Highlight missing Supabase redirect URI with copy button

---

## Phase 2 — Live SIP Calls (mirror Lemtel PJSIP)

**Goal:** Broker on `/planipret/mobile` can register + place/receive calls via `voice.ava-telecom.ca`.

- New hook `src/hooks/useSipPhone.ts` mirroring Lemtel:
  - Fetch creds via existing `ns-resolve-sip-credentials` edge function
  - Register with `CapacitorSip` (username, password, domain `planipret.ca`, proxy `voice.ava-telecom.ca:5060`, TCP)
  - Expose `status`, `activeCall`, `callState`, `makeCall`, `answerCall`, `hangupCall`, `holdCall`, `muteCall`, `transferCall`, `sendDtmf`
  - Listeners: `registrationState`, `callState`, `incomingCall`
- Full-screen call overlay component `src/components/planipret/mobile/ActiveCallOverlay.tsx`:
  - Gradient bg, avatar, caller name/number, live duration timer, extension label
  - 3×2 controls grid (mute, hold, transfer, keypad, speaker, hangup)
  - Incoming variant: decline / answer / quick-SMS ("Je vous rappelle")
- Wire overlay into mobile shell so it renders when `callState ∈ {ringing, active}`.

---

## Phase 3 — Live SMS via NS-API

**Goal:** Real send + persisted thread.

- Edge function `supabase/functions/ns-send-sms/index.ts`:
  - Find-or-create message session under `/domains/{domain}/users/{ext}/messagesessions`
  - POST message, then insert row into `planipret_phone_messages` via service-role client
  - Requires `NS_API_KEY`, `NS_API_BASE_URL`, `NS_DEFAULT_DOMAIN` secrets (verify).
- SMS thread UI in Messages → SMS tab:
  - Header with contact + call button
  - Bubble list (sent right / received left), delivery ticks
  - Sticky composer with attachment/voice/text/send
  - Optimistic send → invoke edge fn → resolve status
  - Supabase Realtime subscription on `planipret_phone_messages` for inbound

---

## Phase 4 — Dialpad with Maestro Client Search

**Goal:** Two-mode dialpad sheet (Keypad + Search).

- Refactor existing dialpad sheet (`src/components/planipret/mobile/Dialpad*.tsx`):
  - Segmented control at top: Clavier / Rechercher
  - **Keypad mode:** existing 12-key grid + new SMS action + inline auto-suggest card (contact/Maestro lookup as user types)
  - **Search mode:** auto-focused input → debounced call to `maestro-client-lookup` edge fn (create if missing) → result cards with avatar, pipeline pill, actions [Appeler / SMS / Dossier]
  - Recents (empty state): last 5 from `planipret_phone_calls` + `planipret_phone_messages`
  - No-results state with "Créer un nouveau client" → POST to Maestro
- Client detail bottom sheet showing Maestro dossier + call history + SMS + tasks + emails.

---

## Phase 5 — Full i18n (FR/EN)

**Goal:** Every user-visible string translatable, FR default.

- `bun add react-i18next i18next i18next-browser-languagedetector`
- Create `src/i18n/index.ts`, `src/i18n/locales/fr.json`, `src/i18n/locales/en.json` (full keyset from prompt: nav/home/calls/messages/dialpad/ava/more/auth/status/common/notifications)
- Import `./i18n` in `src/main.tsx`
- Persist language in `localStorage` (`planipret_lang`) + `planipret_profiles.preferred_language`
- Language switcher in More → Préférences (🇫🇷 / 🇬🇧)
- Sweep all mobile components, replace hardcoded FR strings with `t('…')` calls (keep emojis)

---

## Technical Notes

- All edge functions use `corsHeaders` + OPTIONS handler.
- Secrets required (will request if absent): `MICROSOFT_TENANT_ID`, `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `NS_API_KEY`, `NS_API_BASE_URL`, `NS_DEFAULT_DOMAIN`, `MAESTRO_API_URL`.
- No schema changes expected; reuses `planipret_phone_messages`, `planipret_phone_calls`, `planipret_profiles`.
- Auth: broker identity taken from `supabase.auth.getUser()`; edge functions validate JWT.

---

## Delivery Order

1. Phase 1 (MS365 test) — smallest, isolated, verifies infra.
2. Phase 5 (i18n scaffolding) — foundational; new UI in later phases uses `t()` from the start.
3. Phase 3 (SMS edge fn + thread UI).
4. Phase 4 (dialpad redesign, depends on SMS + call actions).
5. Phase 2 (SIP calls + overlay) — largest native surface; ship last.

Reply **go** to start Phase 1, or tell me which phase to tackle first / adjust.
