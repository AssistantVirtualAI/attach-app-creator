# Planiprêt Mobile — Native Config (iOS + Android)

These snippets prepare the Capacitor wrapper for App Store & Play Store
submission. The web app at `/mplanipret` already handles the UI permission
flow (`MobilePermissionsOnboarding`); the native layer below must grant
those permissions at OS level.

---

## iOS — `ios/App/App/Info.plist`

```xml
<key>NSMicrophoneUsageDescription</key>
<string>Planiprêt utilise le microphone pour les appels téléphoniques professionnels via votre extension NetSapiens.</string>
<key>NSContactsUsageDescription</key>
<string>Planiprêt accède à vos contacts pour identifier les appelants et faciliter les appels sortants.</string>
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Planiprêt utilise le Bluetooth pour connecter vos appareils audio (casques, haut-parleurs).</string>
<key>NSCameraUsageDescription</key>
<string>Planiprêt utilise la caméra pour les appels vidéo et les photos de profil.</string>
<key>NSLocalNetworkUsageDescription</key>
<string>Planiprêt utilise le réseau local pour les appels SIP via WiFi.</string>

<key>UIBackgroundModes</key>
<array>
  <string>voip</string>
  <string>audio</string>
  <string>fetch</string>
  <string>remote-notification</string>
</array>
```

### Xcode → Signing & Capabilities
- ✅ Push Notifications
- ✅ Background Modes → Voice over IP, Audio AirPlay PiP, Background fetch, Remote notifications

### Entitlements (`App.entitlements`)
```xml
<key>com.apple.developer.pushkit.unrestrictedVoIP</key><true/>
<key>aps-environment</key><string>production</string>
```

### CallKit / PushKit
- Incoming VoIP push → `CXProvider.reportNewIncomingCall()`
- Required for instant ring + lock-screen UI + iOS recents.

---

## Android — `android/app/src/main/AndroidManifest.xml`

```xml
<uses-permission android:name="android.permission.RECORD_AUDIO"/>
<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS"/>
<uses-permission android:name="android.permission.READ_CONTACTS"/>
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" android:minSdkVersion="31"/>
<uses-permission android:name="android.permission.BLUETOOTH" android:maxSdkVersion="30"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE"/>
<uses-permission android:name="android.permission.ACCESS_WIFI_STATE"/>
<uses-permission android:name="android.permission.CHANGE_NETWORK_STATE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE"/>
<uses-permission android:name="android.permission.KEEP_ALIVE"/>

<application ...>
  <service android:name=".CallService"
    android:foregroundServiceType="microphone|phoneCall"
    android:exported="false"/>
</application>
```

### FCM
- Drop `google-services.json` in `android/app/`.
- Implement `FirebaseMessagingService` to render Answer/Decline notification actions for incoming calls.

---

## App Store Connect metadata

| Field | Value |
|---|---|
| App Name | Planiprêt Mobile |
| Subtitle | Téléphonie IA pour courtiers |
| Bundle ID | `com.lemtel.softphone` |
| Version | 1.0.0 |
| Category | Business |
| Age Rating | 4+ |
| Privacy Policy | https://avastatistic.ca/privacy |
| Support | https://support.avastatistic.ca |
| Marketing | https://avastatistic.ca |

**Screenshots (5 required per device)**
- iPhone 6.9": 1320×2868
- iPhone 6.5": 1284×2778
- iPad 13": 2064×2752 (if iPad supported)

Content: (1) Home KPIs + AVA brief · (2) Active call + coaching · (3) Call detail + AI · (4) Microsoft 365 calendar · (5) AVA voice overlay.

**Demo account for review**
- Email: `demo@avastatistic.ca`
- Password: `DemoPass2026!`
- Note: "Extension 1999 on domain demo.lemtel.tel — use to test all calling features."

---

## Play Store metadata

| Field | Value |
|---|---|
| App Name | Planiprêt Mobile |
| Short desc (80) | Téléphonie IA pour courtiers hypothécaires |
| Category | Business |
| Content rating | Everyone |

**Graphics**
- Icon 512×512 PNG
- Feature graphic 1024×500 JPG
- Phone screenshots: 2–8 (1080×1920 or 1080×2400)

**Data Safety**
- Collected: name, email, phone, call history
- Shared: Microsoft (SSO), NetSapiens (telephony)
- Encrypted in transit: yes
- Deletion: `support@avastatistic.ca`

## Phase 4 — Bluetooth audio (added)

### iOS — `Info.plist`
```xml
<key>NSBluetoothAlwaysUsageDescription</key>
<string>Planiprêt utilise le Bluetooth pour acheminer vos appels vers votre casque ou votre voiture.</string>
<key>NSBluetoothPeripheralUsageDescription</key>
<string>Planiprêt détecte les casques Bluetooth pour vos appels professionnels.</string>
```

### Android — `AndroidManifest.xml` (API 31+)
```xml
<uses-permission android:name="android.permission.BLUETOOTH_CONNECT" />
<uses-permission android:name="android.permission.BLUETOOTH_SCAN"
    android:usesPermissionFlags="neverForLocation" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CHANGE_NETWORK_STATE" />
```

After editing native projects run `npx cap sync` so the new Bluetooth + Network
plugins (`@capacitor-community/bluetooth-le`, `@capacitor/network`) register.
