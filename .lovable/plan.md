# Fix Gateway Listing

## Diagnosis

Your screenshot is from FusionPBX's gateway page, which shows **global gateways** (sofia profile external) stored in `v_gateways` with `domain_uuid = NULL`. Our current loader calls `list-gateways-all-domains`, which iterates every domain and queries `gateways?domain_uuid=<dom>` — FusionPBX's REST filter **excludes globals** because their `domain_uuid` is NULL, so 137 domains × 0 matches = 0 rows.

The plain `gateways` endpoint (without `domain_uuid=`) returns the globals — exactly what's in your screenshot.

## Changes

### 1. `supabase/functions/fusionpbx-proxy/index.ts`
Add a new action `list-gateways-merged` that:
- Calls `gateways` with no filter → captures globals (rows with `domain_uuid` NULL or any).
- Calls `gateways?domain_uuid=<each>` per domain → captures domain-scoped gateways.
- De-dupes by `gateway_uuid`, attaches `_domain_name` when present.
- Returns `{ ok, data, total_global, total_scoped, total_unique }`.

Also: make `debug-raw` accept `?key=&username=` query-param auth as a fallback (some FusionPBX installs reject Basic auth on read endpoints) and surface raw status + first 500 chars for quick diagnosis.

### 2. `src/pages/lemtel/LemtelGateways.tsx`
- Replace the `list-gateways-all-domains` call with `list-gateways-merged`.
- Drop the misleading "checked all 137 domains / gateway_view permission" empty state (the permission is fine — you can see them in the GUI). Replace with: "No gateways returned. Click **Run diagnostic** to call the raw `/gateways` endpoint and view the response."
- Add a small "Run diagnostic" button that fires `debug-raw` with `path: 'gateways'` and shows the raw JSON in a dialog — so if it still returns empty we can see exactly what FusionPBX says.

### 3. No DB / RLS changes
Pure read path; no migration.

## Validation

After deploy:
1. Open `/lemtel/gateways` → expect the 13 gateways from your screenshot.
2. If still empty, the diagnostic dialog shows the raw API response so we know whether it's an auth issue, an empty response, or a parse mismatch.

## Out of scope

- Editing gateway create/update flow (works through `create-gateways` already).
- Mascot chatbot work (separate track, already in progress).
