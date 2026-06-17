---
name: AVA Softphone Mobile
description: Mobile app architecture, tab layout, edge functions, and store metadata locations for the mobile companion app
type: feature
---
Mobile app: `apps/ava-softphone-mobile`. Capacitor 6, iOS + Android.

Tabs (5, AVA raised center):
- home → DashboardScreen (domain-wide stats from mobile-domain-stats)
- calls → CallsScreen (existing, company CDR)
- ava → AVAChatScreen (chatbot via mobile-chat → Lovable AI Gateway)
- queues → QueuesScreen (read-only, mobile-queues)
- more → MoreScreen (recordings, voicemail, messages, contacts, settings, delete-account)

Auto-sync: `hooks/useAutoSync.ts` — foreground refresh (Capacitor App appStateChange), 60s interval, pull-to-refresh.

Edge functions (mobile-only):
- mobile-domain-stats — today + 7d aggregates
- mobile-queues — pbx_call_queues + per-queue today stats
- mobile-recordings — pbx_call_records where has_recording=true
- mobile-chat — Lovable AI Gateway, model google/gemini-3-flash-preview, system prompt scoped to user's org
- mobile-delete-account — GDPR/store-compliance: revokes push tokens, drops roles, anonymizes profile, deletes auth user, logs to audit

Store metadata:
- iOS: store-metadata/ios/metadata.txt + metadata-fr.txt
- Android: store-metadata/android/metadata.txt + metadata-fr.txt
- Native config snippets: native-config/ios-Info.plist.snippet.xml + android-AndroidManifest.snippet.xml
- Release checklist: apps/ava-softphone-mobile/RELEASE.md

App ID locked: `com.lemtel.softphone`. Display name: `AVA Softphone`.
Privacy URL: https://avastatistic.ca/privacy. Terms URL: https://avastatistic.ca/terms (src/pages/Terms.tsx).
