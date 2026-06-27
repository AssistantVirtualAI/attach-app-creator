# iOS Deployment Checklist — AVA Softphone

Last updated: after adding Claude (Anthropic) transcription fallback.

## 1. Privacy usage strings — `ios/App/App/Info.plist`

All required `NS*UsageDescription` keys must be present, bilingual (EN / FR), and explain *why* the app needs the permission. Apple rejects vague or missing strings.

| Key | Status | Purpose |
|---|---|---|
| `NSMicrophoneUsageDescription` | ✅ present | SIP call audio |
| `NSContactsUsageDescription` | ✅ present | Dialer + click-to-call |
| `NSPhotoLibraryUsageDescription` | ✅ present | Profile picture only |
| `NSLocalNetworkUsageDescription` | ✅ present | SIP signaling on LAN |
| `NSBonjourServices` (`_sip._tcp`, `_sip._udp`) | ✅ present | Required when Local Network is declared |
| `NSUserNotificationsUsageDescription` | ✅ present | Missed call / voicemail / SMS alerts |
| `NSCameraUsageDescription` | ❌ not needed | App does not use camera; do NOT add |
| `NSSpeechRecognitionUsageDescription` | ❌ not needed | Transcription happens server-side via Lovable AI / Anthropic; on-device Speech is not used |

> Claude fallback note: transcription runs entirely server-side in the `ai-transcribe-call` Edge Function. **No new iOS privacy string is required** for adding Anthropic as a backend provider — the device only uploads recording metadata, not raw mic data.

## 2. Export-compliance & encryption

| Key | Value | Reason |
|---|---|---|
| `ITSAppUsesNonExemptEncryption` | `false` | App uses only standard HTTPS/SRTP from Apple's stack; no proprietary crypto. Avoids the ECCN questionnaire in App Store Connect. |

## 3. Background modes — `UIBackgroundModes`

| Mode | Status | Notes |
|---|---|---|
| `audio` | ✅ enabled | Keeps RTP alive while call is active |
| `remote-notification` | ✅ enabled | For silent push when implemented |
| `voip` | ❌ disabled | Reserved for v1.1 with **PushKit + CallKit**. Apple rejects `voip` background mode without a real PushKit-driven incoming-call flow. |

## 4. Privacy Manifest — `ios/App/App/PrivacyInfo.xcprivacy`

Required since May 2024. Confirm the file declares:

- **Collected data types**: email, phone number, name, user ID, audio (calls), customer support, crash data, performance data.
- **Required-reason API codes**:
  - `NSPrivacyAccessedAPICategoryUserDefaults` → reason `CA92.1`
  - `NSPrivacyAccessedAPICategoryFileTimestamp` → reason `C617.1`
  - `NSPrivacyAccessedAPICategorySystemBootTime` → reason `35F9.1`
  - `NSPrivacyAccessedAPICategoryDiskSpace` → reason `E174.1`
- **Tracking**: `NSPrivacyTracking = false` (we do not use IDFA / cross-app tracking).
- **Third-party SDKs**: Anthropic and Google Gemini are **server-side only** — they are NOT bundled SDKs on iOS, so they do NOT need a `PrivacyInfo.xcprivacy` entry. Only on-device SDKs (Capacitor plugins) count.

## 5. App Transport Security (ATS)

- Default ATS stays enabled. Do **not** add `NSAllowsArbitraryLoads`.
- All Edge Function and SIP signaling endpoints use HTTPS / WSS / TLS-SRTP — already compliant.
- `WKAppBoundDomains` whitelists only the SIP/PBX hosts; keep this list minimal.

## 6. Entitlements (`App.entitlements`)

| Entitlement | Required for | Status |
|---|---|---|
| `aps-environment` | Push notifications | Add only when PushKit/APNs ships (v1.1) |
| `com.apple.developer.pushkit.unrestricted-voip` | VoIP push | Add only with CallKit in v1.1 |
| `com.apple.security.application-groups` | Shared container | Not needed |
| Associated Domains | Universal Links | Not used in v1 |

## 7. App Store Connect submission

- **Encryption**: select "No" (matches `ITSAppUsesNonExemptEncryption=false`).
- **Content rights**: confirm we own the recordings users make.
- **Age rating**: 4+.
- **Data collected** (App Privacy section): mirror `PrivacyInfo.xcprivacy` exactly — Contact Info, Identifiers, Audio Data, Diagnostics, Customer Support. Link each to "App Functionality".
- **Call recording disclosure**: in the description, state recordings are off by default, user-initiated, and an audible notice plays before recording. Settings → Security → "Announce call recording" is on by default — keep it that way.
- **Third-party AI processors** (privacy policy must list): Google (Gemini), OpenAI (gpt-4o-mini), **Anthropic (Claude)** — newly added.

## 8. Privacy policy / Terms updates

After adding Claude:

- Privacy policy at `https://avastatistic.ca/privacy` must list **Anthropic PBC** as a sub-processor for call transcription, with the data category "Call recording audio" and a link to `https://www.anthropic.com/legal/privacy`.
- Terms at `https://avastatistic.ca/terms` should mention that transcription may use multiple AI providers and is selected automatically.
- DPA / processor list: add Anthropic with region (US) and purpose (speech-to-text fallback).

## 9. Secrets (server side only — never shipped in the app)

| Secret | Where | Status |
|---|---|---|
| `LOVABLE_API_KEY` | Edge Function env | ✅ configured |
| `ANTHROPIC_API_KEY` | Edge Function env | ✅ configured (this turn) |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function env | ✅ configured |

The iOS bundle ships zero AI credentials. Verify with: `grep -RiE "ANTHROPIC|sk-ant|LOVABLE_API" ios/App` → must return nothing.

## 10. Pre-submission build commands

```bash
cd apps/ava-softphone-mobile
npm run build
npx cap sync ios
./scripts/ios-release.sh   # one-shot build/sync/validate
open ios/App/App.xcworkspace
# Xcode: Product → Archive → Distribute App → App Store Connect
```

## 11. Final smoke tests on device

- [ ] Microphone permission prompt appears on first call, FR/EN string visible.
- [ ] Local Network prompt appears once (SIP).
- [ ] Notifications prompt appears on first launch.
- [ ] Outgoing call rings (local ringback) and audio is two-way.
- [ ] Hold / unhold works without re-INVITE loop.
- [ ] Speaker toggle switches output (earpiece ↔ speaker).
- [ ] Call recording plays the "This call is being recorded" beep+notice before capture starts.
- [ ] After a call, Settings → AI → Transcription shows the provider that ran (`lovable-ai/google/gemini-2.5-pro`, `lovable-ai/openai/gpt-4o-mini`, or `anthropic/claude-opus-4-5`).
- [ ] Toggling "Claude fallback" OFF and forcing Gemini+GPT to fail produces a stub transcript with `reason: all-providers-failed` (instead of calling Claude).
