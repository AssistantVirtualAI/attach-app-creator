# Final Slice — Tracks C, D, E

Closes the original spec. Three tracks shipped in order so the visual sweep (E) lands last and styles everything new.

## Track C — Desktop Portal tab

Goal: from inside the Electron softphone, users can pop the full web portal in a tab without re-authenticating.

- New file `apps/ava-softphone-desktop/src/components/PortalTab.tsx` — wraps a `<webview>` (Electron) / `<iframe>` (web) pointing at `${PORTAL_URL}/org/lemtel/my/dashboard?desktop=1`.
- New `apps/ava-softphone-desktop/electron/portalBridge.ts` — exposes `ipcMain` handler that mints a short-lived magic link via new edge function `desktop-portal-token` and returns the URL with `#access_token=…&refresh_token=…`.
- New edge function `desktop-portal-token` — verifies the desktop's existing Supabase JWT, returns a fresh session pair for `auth.setSession()`.
- Tab added to the desktop sidebar between "Calls" and "Settings".
- Portal recognises `?desktop=1` to hide its own sidebar branding and collapse to the `/my` scope.

## Track D — AVA admin chat command pipeline

Goal: super_admins type "block extension 1042" / "show outages" / "force re-sync acme" in the existing OrgChat and AVA executes.

- New edge function `ava-admin-command` — Lovable AI Gateway, `streamText` + tools. Tools (all RLS-respecting):
  - `list_outages()`, `extension_status(ext)`, `block_extension(ext, reason)`,
  - `force_sync(org_slug, kind)`, `recent_voicemails(org_slug, limit)`,
  - `verify_isolation(org_slug)`.
- All tool executions write to existing `telecom_admin_ai_actions` for audit; mutating tools require `needsApproval`.
- Frontend: extend `src/hooks/useOrgChat.ts` so messages starting with `/ava` route to `ava-admin-command` instead of the normal chat insert. Render assistant replies + tool cards using AI Elements (`Tool`, `ToolHeader`, `ToolOutput`).
- New component `src/components/lemtel/AvaCommandBubble.tsx` for the tool-result card (status pill + JSON accordion).
- Gated by `is_super_admin` / `is_lemtel_admin`; non-admins see "Commands disabled".

## Track E — Full visual sweep

Goal: every portal page matches the cyberpunk glass-morphism cockpit established in `index.css` (no flat white cards left).

- Audit pass via `rg "rounded-(md|lg|xl) border bg-card"` and `rg "Card>"` to find legacy surfaces.
- Replace bare shadcn `<Card>` usages on these page groups with the existing `GlassCard` primitive:
  - `/platform/**` (super-admin)
  - `/customer/**` (org admin)
  - `/org/lemtel/admin/**`
  - `/org/lemtel/my/**` (incl. the 3 just-shipped pages)
  - `/admin/clients/new` wizard
- Apply `bg-grid` + `bg-gradient-cockpit` to each route shell that's still flat.
- Buttons: swap primary `Button` → `Button variant="shine"` on hero CTAs (Sync, Save, Provision).
- Sidebar: add the subtle scanline + active-glow already defined in `index.css` (`.sidebar-glow` class) to active `NavLink`.
- No new colors, no new fonts — only existing tokens.
- Spot-check French + English labels still fit; truncate where needed.

## Out of scope

- New product features beyond C/D.
- Mobile app (Capacitor) — not in the original spec for this phase.
- Landing page (locked).

## Technical appendix

- New edge functions: `desktop-portal-token`, `ava-admin-command`.
- New files: `PortalTab.tsx`, `portalBridge.ts`, `AvaCommandBubble.tsx`.
- Modified: `useOrgChat.ts`, desktop sidebar, ~25 page files for visual sweep (mechanical Card → GlassCard swap).
- No new tables. No new migrations. No new third-party deps.
- AI Elements `tool`, `message`, `conversation`, `prompt-input` installed for the AVA command UI.
