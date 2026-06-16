## Goal
Bring the desktop **Admin** view to full parity with the portal's PBX admin (Extensions, IVR/Auto-Attendant, Call Queues, Ring Groups, Time Conditions, etc.), fix the broken edit pop-up visuals, and wire ElevenLabs TTS for IVR greetings + voicemail greetings on the end-user side.

## Problems today
1. The desktop edit pop-up (`PbxResourceSection` drawer + ad-hoc `EditExtensionModal` in `AdminView.tsx`) renders against a translucent background, has cramped layout, and shows only a handful of fields — nothing like the portal's full FusionPBX-aligned forms.
2. Field sets are minimal stubs (e.g. Extensions = 3 fields; portal has 20+; Queues / IVR / Ring Groups missing the same way), so edits made on desktop don't actually configure the PBX object the same way the portal does.
3. ElevenLabs TTS isn't wired into IVR menu greetings or per-extension voicemail greetings from the desktop app, even though backend functions (`voicemail-greeting-tts`, `generate-voicemail-greeting`) already exist.

## Plan

### 1. New shared "Pbx Edit Sheet" component (desktop)
Create `apps/ava-softphone-desktop/src/components/console/admin/PbxEditSheet.tsx`:
- Right-side sheet, **fully opaque** panel (no backdrop-filter on inner card), 560px wide on desktop / full-screen on narrow.
- Sticky header (title + close + Save), scrollable body, sticky footer (Cancel / Save).
- Section/group support (`{ section: 'Voicemail', fields: [...] }`) so long forms read like the portal.
- Field types: `text | number | textarea | select | checkbox | password | extension-picker | sound-picker | tts-greeting`.
- Replaces the two existing modals (`EditDrawer` in `PbxResourceSection`, `EditExtensionModal` in `AdminView`).

### 2. Port portal field schemas into desktop
Create `apps/ava-softphone-desktop/src/lib/pbxFieldSchemas.ts` mirroring the portal's FusionPBX forms:
- **Extensions**: extension, password, effective_caller_id_name/number, outbound_caller_id_name/number, voicemail_enabled, voicemail_password, voicemail_mail_to, voicemail_attach_file, call_group, user_context, accountcode, toll_allow, call_timeout, missed_call_app/data, do_not_disturb, forward_all/busy/no_answer, hold_music, description, enabled.
- **Call Queues**: queue_name, extension, strategy, moh_sound, record_template, time_base_score, max_wait_time, max_wait_time_with_no_agent, tier_rules_apply, tier_rule_wait_second, agents, announce_sound/frequency, abandoned_resume_allowed, discard_abandoned_after, description, enabled.
- **Ring Groups**: name, extension, strategy, timeout_app/data, forward_destination, forward_enabled, call_timeout, cid_name_prefix, cid_number_prefix, ringback, missed_call_app/data, members (extension multi-select with delay/timeout/prompt), context, description, enabled.
- **IVR / Auto-Attendant**: name, extension, greet_long, greet_short, invalid_sound, exit_sound, timeout, max_failures/timeouts, direct_dial, ringback, caller_id_name_prefix, description, enabled, **options** (digit → action+data with extension-picker).
- **Time Conditions**: name, extension, conditions[] (wday/mday/mon/hour/minute, true/false destinations).
- **Conferences / Hold Music / Gateways / SIP Profiles / Dialplans**: extend existing field lists to portal parity.

Each schema is a `FieldGroup[]` consumed by `PbxEditSheet`.

### 3. Rewrite desktop AdminView resource tables to use the schemas
- Replace inline `EditExtensionModal` with `PbxEditSheet` + extensions schema; on save, call existing `fusionpbx-proxy` `update-extension` with the full param set (portal already supports it).
- Replace the IVR (`IvrsTable`) and Queue (`QueuesTable`) custom tables with `PbxResourceSection` driven by the new schemas, including the **IVR options sub-editor** (add/remove digit rows in the sheet).
- Update Ring Groups, Time Conditions, Conferences, Gateways, SIP Profiles, Dialplans, Hold Music to use the new schemas (no UI duplication needed — same component, richer fields).

### 4. ElevenLabs TTS integration

**IVR greetings (admin)**
- In the IVR edit sheet, add a `tts-greeting` widget for `greet_long` / `greet_short` / `invalid_sound` / `exit_sound`.
- Widget: voice picker (Sarah, George, Charlie, etc.), text input, "Generate" → calls existing `voicemail-greeting-tts` edge function (rename-agnostic; we'll add a thin `ivr-greeting-tts` wrapper that uploads the resulting MP3 to FusionPBX as a recording and returns the file path) → preview player → "Save to PBX" sets the IVR's greet path.
- New edge function: `supabase/functions/ivr-greeting-tts/index.ts` — accepts `{ organization_id, ivr_uuid, slot, text, voice_id }`, generates audio via ElevenLabs (uses linked connector `ELEVENLABS_API_KEY`), pushes to FusionPBX `/app/recordings/` via `fusionpbx-proxy`, returns recording filename.

**End-user voicemail greeting (desktop softphone)**
- Add a "Voicemail Greeting" card to the desktop `SettingsPage`:
  - Record / upload tabs (already partially exists) **plus** a new "Generate with AI" tab.
  - Uses the existing `voicemail-greeting-tts` edge function (extend it to accept `voice_id` + `text` and write the resulting file via existing `user-voicemail-greeting` upload path).
- Strictly scoped to the signed-in extension (RLS already enforces this per the prior security pass).

### 5. Visual polish for the edit sheet
- Opaque navy panel (`#0c1733`), no inner blur, 1px hairline border, sticky 56px header with title + close, sticky footer with Save (primary gradient) / Cancel (ghost).
- Form fields: 13px text, full-width inputs, 12px gap, section headers in gold/uppercase like the left rail.
- Animation: 160ms slide-in from right; backdrop fade.
- Honors prefers-reduced-motion; ESC closes; body scroll lock (already in `ModalShell` — reuse logic).

### 6. Connector check
Before shipping, confirm an **ElevenLabs** standard connector is linked to the project (so `ELEVENLABS_API_KEY` is available to the new/extended edge functions). If not, I'll prompt to connect it.

## Technical notes
- No DB migrations required (FusionPBX is the source of truth for these objects; we only forward richer param sets through `fusionpbx-proxy`, which already accepts arbitrary fields).
- All writes continue to flow through `fusionpbx-proxy` / `pbx-write` (audit + mirror tables stay intact).
- New code stays inside `apps/ava-softphone-desktop/src/` and `supabase/functions/ivr-greeting-tts/`. No changes to the landing page or portal pages.

## Files touched
- **New**: `apps/ava-softphone-desktop/src/components/console/admin/PbxEditSheet.tsx`
- **New**: `apps/ava-softphone-desktop/src/lib/pbxFieldSchemas.ts`
- **New**: `supabase/functions/ivr-greeting-tts/index.ts`
- **Edit**: `apps/ava-softphone-desktop/src/components/console/admin/PbxResourceSection.tsx` (use new sheet)
- **Edit**: `apps/ava-softphone-desktop/src/components/console/AdminView.tsx` (wire schemas, remove inline modal, add IVR options editor)
- **Edit**: `apps/ava-softphone-desktop/src/components/SettingsPage.tsx` (AI voicemail greeting tab)
- **Edit**: `supabase/functions/voicemail-greeting-tts/index.ts` (accept voice_id + text, write through `user-voicemail-greeting`)

## Out of scope
- Landing page, portal pages, mobile app, RLS changes, DB schema changes.
