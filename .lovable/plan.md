# Plan: FusionPBX-Style Dashboard

Replace `src/pages/lemtel/LemtelDashboard.tsx` with a tile-grid layout that mirrors the FusionPBX reference, with every tile linking to its existing page and live counts pulled from the proxy.

## Layout

Top bar: `Dashboard` title + `Expand All`, `Edit`, `Settings` buttons (Settings → `/lemtel/settings`).

Three tile groups (cards) on the first row:

1. **Account** — Registrations (count `1055/1314` from `list-registrations`), Account Settings, Destinations, Devices, Extensions, Ring Groups
2. **Call Management** — IVR Menus, Call Flows, Time Conditions, Fax Server, Conferences, Conference Centers
3. **Records** — Call Detail Records, Call Recordings, Voicemails, Recent Calls (badge=count), Missed Calls (red badge), New Messages (green badge)

Second row card:
4. **Tools** — Email Queue, Call Block, Contacts, FAX Queue, Event Guard, Phone

Bottom row: three charts — System CPU Status, System Network Status, Active Calls (recharts, 7-point live series from existing CDR/registration data; CPU/Network use placeholders since no metrics endpoint exists).

## Tile routing

| Tile | Route |
|---|---|
| Registrations | `/lemtel/softphone-users` |
| Account Settings | `/lemtel/settings` |
| Destinations | `/lemtel/dids` |
| Devices | `/lemtel/devices` |
| Extensions | `/lemtel/extensions` |
| Ring Groups | `/lemtel/queues` |
| IVR Menus | `/lemtel/ivr` |
| Call Flows | `/lemtel/portal/calls` |
| Time Conditions | new `/lemtel/business-hours` (already `BusinessHours.tsx`) |
| Fax Server | new stub `/lemtel/fax` |
| Conferences | new stub `/lemtel/conferences` |
| Conference Centers | new stub `/lemtel/conference-centers` |
| Call Detail Records | `/lemtel/portal/calls` |
| Call Recordings | `/lemtel/admin/recordings` |
| Voicemails | `/lemtel/admin/voicemail` |
| Recent Calls | `/lemtel/portal/calls` |
| Missed Calls | `/lemtel/portal/calls?filter=missed` |
| New Messages | `/lemtel/messages` |
| Email Queue | new stub `/lemtel/email-queue` |
| Call Block | new stub `/lemtel/call-block` |
| Contacts | new stub `/lemtel/contacts` |
| FAX Queue | new stub `/lemtel/fax-queue` |
| Event Guard | new stub `/lemtel/event-guard` |
| Phone | opens the floating softphone widget |

## Data sources

Use existing hooks: `usePbxExtensions`, `usePbxIvrs`, `usePbxQueues`, `usePbxCallRecords`, `usePbxSmsThreads`. Add lightweight proxy calls (`list-registrations`, `list-voicemails`, `list-devices`) cached via React Query — proxy already supports them.

Badges:
- Registrations: `registered / total`
- Recent Calls: today's CDR count
- Missed Calls: CDRs with `hangup_cause` in missed set
- New Messages: unread SMS + new voicemails

## Files

**Edited**
- `src/pages/lemtel/LemtelDashboard.tsx` — full rewrite to tile grid
- `src/App.tsx` — add routes for new stubs + `/lemtel/business-hours`
- `src/components/sidebar/sidebarConfig.ts` — add nav entries for the new pages

**Created** (each is a minimal `LemtelStub`-style placeholder marked "Coming soon")
- `src/pages/lemtel/LemtelFax.tsx`
- `src/pages/lemtel/LemtelConferences.tsx`
- `src/pages/lemtel/LemtelConferenceCenters.tsx`
- `src/pages/lemtel/LemtelEmailQueue.tsx`
- `src/pages/lemtel/LemtelCallBlock.tsx`
- `src/pages/lemtel/LemtelContacts.tsx`
- `src/pages/lemtel/LemtelFaxQueue.tsx`
- `src/pages/lemtel/LemtelEventGuard.tsx`

No database or edge function changes. The reference screenshot's `Edit` and `Expand All` controls are cosmetic in this pass; `Edit` toggles a "reorder hint" (no persistence) and `Expand All` is a no-op placeholder so the visual matches.
