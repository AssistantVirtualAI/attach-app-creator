# Phase 4 continuation — IVR greetings + activeDomain swap

## 1. IVR greeting upload + TTS

**Storage**
- Create public bucket `lemtel-ivr-audio` (if missing) with RLS:
  - read: anyone in org or super_admin
  - write: org admins or super_admin
- Path scheme: `{domain_uuid}/{ivr_id}/{filename}`.

**Edge function** `generate-ivr-tts` (new)
- Input: `{ text, voice?, domain_uuid, ivr_id }`
- Use Lovable AI Gateway first; fall back to ElevenLabs (`ELEVENLABS_API_KEY` via connector) if AI Gateway TTS unavailable.
- Upload resulting MP3 to `lemtel-ivr-audio` bucket, return public URL.

**fusionpbx-proxy**
- Extend `create-ivr` / `update-ivr` actions to accept `greeting_url` and persist it as the FusionPBX greeting on the menu.

**LemtelIVR.tsx UI**
- In the IVR create/edit dialog add a "Greeting" section with two tabs:
  - **Upload**: file input (mp3/wav, ≤5 MB) → uploads to bucket → stores URL.
  - **Text-to-speech**: textarea + voice select (Sarah / George / Charlie default) → calls `generate-ivr-tts` → preview `<audio>` player → save URL.
- Show current greeting with play button and "Replace" action.

## 2. LEMTEL_ORG → activeDomain swap

Replace hard-coded `LEMTEL_ORG` usage with `useActiveDomain()` across:
- `LemtelIVR.tsx`
- `LemtelQueues.tsx`
- `TelephonyRingGroups.tsx`
- `LemtelDIDs.tsx`
- `ContactsView.tsx` (org filter for `pbx_softphone_users` / `org_contacts`)
- Any other page importing `LEMTEL_ORG` from `@/config/lemtel` (sweep with rg).

Rules:
- Super-admin sees the domain selected in `DomainSwitcher`.
- Customer user is auto-pinned to their own `org_id` (set on login).
- If no active domain → render an empty state with "Select a customer" prompt.

Refetch logic:
- Each page subscribes to `activeDomain` changes and re-runs its loaders.

## 3. Files

**New**
- `supabase/functions/generate-ivr-tts/index.ts`
- migration: bucket + RLS for `lemtel-ivr-audio`

**Edited**
- `supabase/functions/fusionpbx-proxy/index.ts` (greeting_url plumbing)
- `src/pages/lemtel/LemtelIVR.tsx` (greeting UI + activeDomain)
- `src/pages/lemtel/LemtelQueues.tsx` (activeDomain)
- `src/pages/lemtel/TelephonyRingGroups.tsx` (activeDomain)
- `src/pages/lemtel/LemtelDIDs.tsx` (activeDomain)
- `apps/ava-softphone-desktop/src/components/console/ContactsView.tsx` (activeDomain filter)

**Not touched**: `vite.config.ts`, `electron-builder.yml`, `.github/workflows/**`.

## 4. Notes

- TTS uses Lovable AI Gateway by default (no extra key). ElevenLabs only kicks in if the user explicitly wants premium voices — I'll add a feature flag check before calling the connector.
- No schema change beyond the storage bucket.
