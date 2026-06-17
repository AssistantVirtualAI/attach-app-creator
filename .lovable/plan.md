# AVA Mobile — Store Release Plan

A focused plan to ship `apps/ava-softphone-mobile` to the App Store and Play Store as a lightweight company softphone (no admin surface), with auto‑sync from the PBX and a chatbot front and center.

## 1. Scope of the mobile app (lightweight)

Keep the app simple. Tabs (bottom navigation, 5 slots):

```text
[ Home ]  [ Calls ]  [  AVA  ]  [ Queues ]  [ More ]
                       (center,
                        chatbot)
```

- **Home / Dashboard** — domain‑wide stats (today + 7d): total calls, answered, missed, avg duration, busiest hour, top extensions, queue SLA. Read‑only.
- **Calls** — unified call history for the company (CDR), with filters (mine / company / extension), date, direction, status. Tap → Call Detail with recording + AI transcript + summary.
- **AVA (center tab)** — chatbot (ask questions about calls, customers, stats; uses existing Lovable AI gateway).
- **Queues (read mode)** — list of queues, live waiting count, agents logged in, today's stats. No edit.
- **More** — Recordings (with AI transcribe), Voicemail, Contacts, Messages, Settings, Sign out.
- **Softphone behavior** — keep existing dialer, incoming call sheet, active call sheet, push notifications. User has *regular extension access*, no admin features.

Explicitly **removed/hidden** on mobile: admin console, PBX edit, SaaS configurator, integrations, billing, webhook logs, role matrix, telephony settings, simulation, super admin, leads/campaigns admin, etc.

## 2. Auto‑sync with PBX

All read screens hydrate from Supabase (mirrored PBX data) and trigger the same edge functions the desktop uses:

- On app foreground (`@capacitor/app` `appStateChange` → active) and on tab focus: call `bestEffortRecentTelephonySync(250, true)` (CDR + voicemail + recordings).
- Realtime subscriptions on `pbx_cdr`, `pbx_voicemails`, `pbx_recordings`, `pbx_queues`, `pbx_queue_stats` so Home/Calls/Queues update without manual refresh.
- Pull‑to‑refresh on every list (forces `fusionpbx-proxy` live sync, bypassing cache, same fix as desktop).
- Background refresh every 60s while app is foregrounded; pause when backgrounded to save battery.
- Push notification on new inbound call / new voicemail triggers a targeted sync of that record.

## 3. App Store & Play Store requirements

### 3.1 Identity & config
- `capacitor.config.ts`: rename `appName` from "Lemtel Telecom" → **"AVA Softphone"** (per branding memory), keep `appId: com.lemtel.softphone` (don't change once published) — or switch to `ca.avastatistic.softphone` if not yet submitted. Decision needed (see Open Questions).
- App version + build number bump script.

### 3.2 iOS (Info.plist)
Required usage strings (already partially present in `native-config/ios-Info.plist.snippet.xml`, verify all):
- `NSMicrophoneUsageDescription` — "AVA uses the microphone for voice calls."
- `NSCameraUsageDescription` — only if camera kept; otherwise remove plugin.
- `NSContactsUsageDescription` — "AVA matches your contacts with caller IDs."
- `NSUserNotificationsUsageDescription` (push).
- `NSLocalNetworkUsageDescription` + Bonjour services (SIP/WSS over LAN).
- Background modes: `voip`, `audio`, `remote-notification`.
- ATS exception only if needed for non‑HTTPS PBX (prefer WSS only — no exception).
- ITSAppUsesNonExemptEncryption = false.

### 3.3 Android (AndroidManifest)
- Permissions: `RECORD_AUDIO`, `MODIFY_AUDIO_SETTINGS`, `FOREGROUND_SERVICE`, `FOREGROUND_SERVICE_MICROPHONE`, `POST_NOTIFICATIONS`, `READ_CONTACTS`, `INTERNET`, `WAKE_LOCK`, `USE_FULL_SCREEN_INTENT` (incoming call).
- Foreground service for active call (Android 14 requires `foregroundServiceType="microphone"`).
- Target SDK 34, min SDK 23.
- Data safety form mapping (mic = call functionality, contacts = app functionality, account info = account management, no advertising).

### 3.4 Compliance content
- **Privacy Policy URL** (required both stores) — must cover mic, contacts, push, call recordings, AI transcript processing.
- **Support URL** + support email.
- **Terms of Service URL**.
- **Account deletion** flow inside the app (required by Apple + Google) — "Settings → Delete my account" calling an edge function `mobile-delete-account`.
- **Demo credentials** for Apple/Google reviewers (test extension on a sandbox tenant).
- **Export compliance** — uses standard HTTPS/WSS encryption, no custom crypto.

### 3.5 Store listings
- App name, subtitle, promotional text, description (EN + FR), keywords.
- Category: Business. Content rating: 4+ / Everyone.
- App icon 1024 (already present) + adaptive Android icon (foreground/background/monochrome).
- Feature graphic (Play) 1024×500.

### 3.6 Screenshots required
- **iPhone 6.7″** (1290×2796) — required.
- **iPhone 6.5″** (1242×2688) — required if not using 6.7 auto‑scale, recommended to include.
- **iPad 13″** (2064×2752) — only if iPad supported (recommend iPhone‑only for v1).
- **Android phone** (1080×1920 or 1080×2400) — min 2, up to 8.
- **7″ + 10″ tablet** — only if marketing tablets.

Plan to capture (8 screens each, in both EN + FR):
1. Home dashboard with stats
2. Calls list (company history)
3. Call detail with AI transcript + recording
4. AVA chatbot mid‑conversation
5. Queues read‑mode (live)
6. Voicemail list with AI summary
7. Active call sheet
8. Incoming call sheet

Generated via Playwright at the exact device viewport using the running web build, then framed with the `product-shot` skill / device frames.

## 4. Implementation breakdown

### Phase A — Feature trim & layout
1. Restructure `BottomTabs.tsx` to 5 tabs with center AVA bubble (raised circular button).
2. New `DashboardScreen.tsx` (domain stats from `pbx_cdr` + `pbx_queue_stats`).
3. Rewrite `RecentsScreen.tsx` → `CallsScreen.tsx` with company‑wide filter (reuse `safe` views, RLS already in place).
4. New `QueuesScreen.tsx` read‑only (mirrors desktop `QueuesView` data, no actions).
5. Promote existing `AIScreen.tsx` to center tab with full‑screen chat (AI Elements, see chat‑ui‑composition rules — already followed on desktop).
6. Move Voicemail, Recordings, Contacts, Messages, Settings into `MoreScreen.tsx`.
7. Hide all admin routes/components from mobile bundle (tree‑shake / route guard).

### Phase B — Auto‑sync
8. New `useAutoSync()` hook: foreground + interval + realtime subscriptions for CDR/voicemail/recordings/queues.
9. Pull‑to‑refresh wrapper (`PullToRefresh.tsx`) on list screens.
10. Wire `appStateChange` (Capacitor `App` plugin) → sync.

### Phase C — Store compliance
11. Update `capacitor.config.ts` (name, splash, status bar matching AVA brand).
12. Finalize `native-config/ios-Info.plist.snippet.xml` + `android-AndroidManifest.snippet.xml` with all keys above.
13. Add **Account deletion** screen + edge function `mobile-delete-account`.
14. Add **Privacy Policy** + **Terms** in‑app webview links pointing to URLs hosted on `avastatistic.ca`.
15. Generate adaptive Android icon + Play feature graphic.
16. Write store listing copy (EN + FR) into `store-metadata/ios/` and `store-metadata/android/`.

### Phase D — Screenshots & release artifacts
17. Add a Playwright script `scripts/capture-store-screenshots.ts` that:
    - Boots `vite preview` of mobile build.
    - Logs in with a seeded demo account.
    - Visits each route at iPhone 6.7 and Pixel 7 viewports.
    - Saves raw PNGs to `apps/ava-softphone-mobile/store-metadata/screenshots/raw/`.
18. Run `product-shot` skill (with `--preset midnight` to match brand) to frame each screenshot and save final assets to `/mnt/documents/store-screenshots/{ios,android}/{en,fr}/`.
19. Produce a release checklist `RELEASE.md` covering: version bump, `npm run build:ios`, `npm run build:android`, archive, TestFlight upload, Play internal track upload, store listing fill‑in.

## Technical details (for the engineer)

- All data reads go through existing `_safe` views — no credential exposure on device.
- Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE` already done for CDR; add for `pbx_queues`, `pbx_queue_stats` if missing.
- Chatbot: reuse `chat` edge function with `google/gemini-3-flash-preview` (no per‑device key).
- Account deletion edge function uses service role to: delete `user_roles`, deactivate `pbx_softphone_users` link, anonymize profile, then `supabase.auth.admin.deleteUser`.
- Push: APNs key + FCM `google-services.json` — user must upload via Settings → Project secrets (we'll request via `add_secret`).
- iOS background voice: enable `voip` background mode + PushKit later (v1 can ship without PushKit, using standard push + local notification on wake).
- Bundle size: mark admin chunks as dynamic imports, exclude from mobile entry; target < 5 MB gzipped JS.

## Open questions (need your answer before build)

1. **App ID**: keep `com.lemtel.softphone` or switch to `ca.avastatistic.softphone`? (Cannot change after first store submission.)
2. **App display name**: "AVA Softphone", "AVA Statistic", or other?
3. **iPad support** in v1, or iPhone‑only?
4. **Privacy Policy / Terms URLs** — do you already have them hosted, or should I scaffold pages on `avastatistic.ca`?
5. **Demo reviewer account** — should I create a dedicated sandbox extension/tenant for Apple/Google reviewers?
6. **Languages at launch** — EN + FR only, or add others?
