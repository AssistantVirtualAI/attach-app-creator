## Phase 5 — Contacts Sync + Caller ID

### 5.1 Device contacts → Supabase sync

**Schema migration** (`planipret_contacts` already exists, missing fields):
- Add `phone_normalized TEXT`, `phone_display TEXT`, `photo_url TEXT`, `last_synced_at TIMESTAMPTZ`
- Add unique index `(user_id, source, phone_normalized)` for upsert
- RLS: user can read/write own rows (policy already covers this — verify)

**Mobile client** (`apps/ava-softphone-mobile/src/lib/contacts.ts` — extend existing):
- Already reads `@capacitor-community/contacts` (installed). Add:
  - `normalizePhone(raw)` — strip spaces/dashes/parens, prepend `+1` if 10-digit NANP
  - `syncContactsToSupabase()` — flatten each phone entry into a row, batch upsert via edge function
  - Track `lastFullSync` in Preferences; full sync on first launch, delta (`updated_at > lastSync`) every 24h
- New edge function `pp-contacts-upsert`: validates JWT, batches `upsert` (chunks of 200) with `onConflict: 'user_id,source,phone_normalized'`

**UI**:
- New `ContactsSyncCard` in `MoreScreen` → "Synchroniser les contacts" button, shows last sync time + count
- Trigger initial sync after permission grant inside `PermissionsScreen`
- Background 24h check in `nativeBoot.ts`

### 5.2 Caller ID on incoming calls

**Edge function** `pp-caller-lookup` (single call from native bridge):
- Input: `{ phone, userId }`
- Normalizes, then sequential lookup:
  1. `planipret_contacts` where `phone_normalized = $1 AND user_id = $userId` (source='device' first, then any)
  2. `planipret_maestro_clients` by normalized phone/mobile → returns name, company, budget, deal stage
  3. `planipret_profiles` by phone (broker directory)
  4. Microsoft Graph `/me/contacts?$filter=mobilePhone eq '...'` using stored MS token (from Phase 1 `planipret_integration_secrets`)
- Returns: `{ found, name, company, photo_url, source, crm_meta }`
- 5-min in-memory cache keyed by phone

**Native bridge**:
- On SIP INVITE in `CapacitorSip.swift`, extract `From` header → emit `incomingCallMeta` listener event with raw number
- TS layer (`nativeSipProvider.ts`) listens, calls `pp-caller-lookup`, stores result in SIP snap under `incomingCallerInfo`

**UI** — rebuild `IncomingCallSheet` (or extend `ActiveCallSheet` ringing-in branch):
```
[Avatar — photo_url or colored initials]
Jean Dupont                    ← name OR formatted number
+1 514-555-1234                ← raw number under name
Client Maestro · Budget 450K   ← crm_meta line (conditional)
[🔴 Refuser]   [🟢 Répondre]
[💬 SMS rapide ▾]              ← opens preset templates from planipret_sms_templates
```
- "Inconnu" shown when `found=false`
- Quick-SMS uses existing `pp-sms-send` with user's preset templates

### 5.3 Microsoft contacts merge

- In `pp-caller-lookup`, MS Graph results merged with device contact when phone matches; MS data wins for name/company/email
- New component `UnifiedContactCard` shown in `ContactsScreen` detail view + `CallDetailScreen`:
  - 📱 Mobile, 📞 Bureau, 📧 Courriel MS, 🏢 Entreprise, 🔗 "Voir dans Maestro" (deep-link to CRM web)
- Add `metadata.ms_contact_id`, `metadata.ms_business_phones` columns into `planipret_contacts.metadata` jsonb during sync of merged contact (optional cache)

### Technical details

- Phone normalization shared util: `apps/ava-softphone-mobile/src/lib/phoneNormalize.ts` + `supabase/functions/_shared/phoneNormalize.ts` (NANP-only: `+1XXXXXXXXXX`)
- Reuses Phase 1 MS token store; if no MS token, step 4 is skipped silently
- All edge functions: standard CORS + JWT verification
- No new secrets required (MS secrets from Phase 1)

### Files

**New**
- `supabase/functions/pp-contacts-upsert/index.ts`
- `supabase/functions/pp-caller-lookup/index.ts`
- `supabase/functions/_shared/phoneNormalize.ts`
- `apps/ava-softphone-mobile/src/lib/phoneNormalize.ts`
- `apps/ava-softphone-mobile/src/lib/contactsSync.ts` (sync orchestrator)
- `apps/ava-softphone-mobile/src/components/ContactsSyncCard.tsx`
- `apps/ava-softphone-mobile/src/components/UnifiedContactCard.tsx`
- `apps/ava-softphone-mobile/src/components/IncomingCallerPanel.tsx`

**Modified**
- `apps/ava-softphone-mobile/src/lib/contacts.ts` (add upsert hook)
- `apps/ava-softphone-mobile/src/lib/nativeBoot.ts` (24h delta sync)
- `apps/ava-softphone-mobile/src/lib/sip/nativeSipProvider.ts` (caller lookup on ringing-in)
- `apps/ava-softphone-mobile/src/components/ActiveCallSheet.tsx` (mount IncomingCallerPanel)
- `apps/ava-softphone-mobile/src/screens/MoreScreen.tsx` (mount ContactsSyncCard)
- `apps/ava-softphone-mobile/src/screens/ContactsScreen.tsx` (UnifiedContactCard)
- `apps/ava-softphone-mobile/ios/App/App/Plugins/CapacitorSip/CapacitorSip.swift` (emit incoming number)
- Migration on `planipret_contacts`
