## Fix 1 — Courtiers search returning nothing on `/planipret/admin/users`

**Diagnosis**

- The list filter (`src/pages/planipret/admin/PAUsers.tsx:98-109`) matches only `full_name`, `email`, `extension`. It does **not** match `ns_extension`, and matching is on `r.extension?.toLowerCase().includes(s)` — if `extension` is `null` for NS-only rows the row is silently dropped from search results.
- The status filter tab default may be `"app"` (only mobile-app-enabled) instead of `"all"`, which hides brokers that don't have the mobile app enabled while searching — this looks like "search doesn't work".
- Vestigial `maestroFilter` state is declared but never applied — noise, not the bug, but will be removed.

**Changes** (single file, `src/pages/planipret/admin/PAUsers.tsx`)

1. Extend the search predicate to also match `ns_extension`, and coerce every field to string before `.toLowerCase().includes(s)` so `null`/`undefined` never short-circuit the row.
2. When the user types in the search box, do not silently keep an "app / agent / offline" tab active — force `filter = "all"` while the search text is non-empty (or just show a small "Filter: app" chip so it's obvious what's hiding rows).
3. Remove the unused `maestroFilter` state.

## Fix 2 — Link Mohamad Hassoun's Planiprêt courtier extension (NS ext 113) to your mobile-app profile (ext 300)

**Current DB state (verified)**

| user_id | email | full_name | extension | ns_extension | ns_domain | mobile_app |
|---|---|---|---|---|---|---|
| `e5d025c9…` | mhassoun@assistantvirtualai.com | Mohammed Hassoun | 300 | *(null)* | *(null)* | **true** |
| *(null)* | scott+2@kanguru.ca | Mohamad Hassoun | 113 | 113 | planipret.ca | false |

Row 2 is an orphan NS placeholder created during an earlier sync; it is not linked to any auth user.

**Data change (single migration/insert step)**

1. `UPDATE planipret_profiles` on `user_id = e5d025c9-eef2-4422-b97d-3190388b7376`:
   - `full_name = 'Mohamad Hassoun'` (correct spelling)
   - `ns_extension = '113'`
   - `ns_domain    = 'planipret.ca'`
   - `mobile_app_enabled = true`
2. `DELETE FROM planipret_profiles` for the orphan row (`email = 'scott+2@kanguru.ca'` AND `user_id IS NULL` AND `extension = '113'`) — safe because it has no auth user and no owned FKs.

After this, the Courtiers page will show a single Mohamad Hassoun row with ext 300 local + NS ext 113 on planipret.ca, mobile app enabled — so the softphone connects to NS user 113@planipret.ca.

**Not changed**

- The `pbx_softphone_users` migration row for ext 300 stays intact.
- No RLS, schema, or edge-function changes.

## Verification steps after apply

- Open `/planipret/admin/users`, type "mohamad" → row appears.
- Type "113" → same row appears (via `ns_extension`).
- Toggle `filter` tabs while search is populated → row stays visible when appropriate.
- Confirm Mohamad Hassoun row shows extension 300 / ns_extension 113 / ns_domain planipret.ca / mobile app ON.