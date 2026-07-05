# Android — Native rebuild checklist

Run this after `npx cap add android` (fresh clone) or whenever the native
config snippets in `apps/ava-softphone-mobile/native-config/` change.

## 1. Merge the manifest snippet

Open `android/app/src/main/AndroidManifest.xml` and merge every entry from
`native-config/android-AndroidManifest.snippet.xml`:

- All `<uses-permission>` and `<uses-feature>` blocks at the top level.
- Inside the `<application>` block, add the SIP foreground service:

  ```xml
  <service
      android:name=".SipForegroundService"
      android:exported="false"
      android:foregroundServiceType="microphone|phoneCall" />
  ```

## 2. Copy the foreground service

Copy `native-config/SipForegroundService.kt.snippet` to
`android/app/src/main/java/com/lemtel/softphone/SipForegroundService.kt`
(create the folder if needed — package must match `com.lemtel.softphone`).

The service uses `ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE |
FOREGROUND_SERVICE_TYPE_PHONE_CALL` on Android 14+ so that `RECORD_AUDIO`
stays granted while a call runs in the background.

## 3. Start / stop the service from the SIP bridge

Whichever code path opens the PJSIP audio device must call:

```kotlin
val i = Intent(context, SipForegroundService::class.java)
ContextCompat.startForegroundService(context, i)
```

before `pjsua_call_make_call` / `pjsua_call_answer`, and `context.stopService(i)`
after the call ends. Without this, Android 14 throws
`ForegroundServiceStartNotAllowedException` when the mic is claimed from
the background.

## 4. Rebuild

```bash
npx cap sync android
npx cap run android
```

## 5. Runtime checks

1. Fresh install → permission gate opens the microphone soft-prompt.
2. Deny the mic → dialer call orb is disabled, `title` reads
   "Microphone permission required".
3. Tap the orb anyway → `PermissionBlockedScreen` opens with an
   Open Settings shortcut.
4. Grant the mic in Settings → return to the app → orb becomes enabled
   automatically (via `App.appStateChange` re-check in `usePermissions`).
