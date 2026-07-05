## Objectif
Durcir la chaîne de permissions pour la production VoIP : remplacer l'heuristique JS par la vérité native, ajouter le foreground service microphone Android 13+, garder AVAudioSession du côté CallKit safe si le micro est refusé, et bloquer la composition d'un appel tant que `micStatus !== 'granted'`.

## 1. `lib/permissionState.ts` — supprimer le flag `asked` en localStorage
- **Retirer** `loadAsked` / `saveAsked` / `STORAGE_KEY` : plus aucun stockage JS ne détermine `blocked`.
- **Réécrire `getPermState(key)`** pour ne consulter QUE les APIs natives :
  - `microphone` : `Microphone.checkPermissions()` du plugin `@mozartec/capacitor-microphone` → `granted | denied | prompt`.
  - `contacts` : `Contacts.checkPermissions()` de `@capacitor-community/contacts`.
  - `notifications` : `PushNotifications.checkPermissions()` de `@capacitor/push-notifications`.
- **Distinguer denied vs blocked sans flag JS** grâce à une heuristique temporelle 100 % ancrée sur des signaux natifs :
  1. Si `check()` renvoie `granted` → `granted`.
  2. Si `check()` renvoie `prompt` → `unknown`.
  3. Si `check()` renvoie `denied` : appeler `requestPermissions()` avec un `App.appStateChange` listener temporaire. Si l'app ne devient PAS inactive dans les 400 ms et que la promesse résout immédiatement à `denied` → `blocked`. Sinon → `denied` (l'OS a affiché un prompt et l'utilisateur a refusé à nouveau).
- **Réécrire `requestPerm(key)`** de la même manière : plus de `saveAsked`. Le résultat renvoyé mappe directement `granted | denied | blocked | unavailable`.
- Effet de bord : `usePermissions` fonctionne sans modification, la source de vérité devient l'OS.

## 2. Android — foreground service microphone
Le dossier `android/` réel est généré par `npx cap add android` (non versionné). La source de vérité côté repo est `apps/ava-softphone-mobile/native-config/android-AndroidManifest.snippet.xml`.

- **Vérifier / compléter** dans le snippet :
  - `<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />`
  - `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MICROPHONE" />` (Android 14+)
  - `<uses-permission android:name="android.permission.FOREGROUND_SERVICE_PHONE_CALL" />` (déjà présent)
- **Ajouter dans le snippet** la déclaration `<service>` à insérer dans `<application>` :
  ```xml
  <service
      android:name=".SipForegroundService"
      android:exported="false"
      android:foregroundServiceType="microphone|phoneCall" />
  ```
- **Créer un placeholder Kotlin** `apps/ava-softphone-mobile/native-config/SipForegroundService.kt.snippet` avec une implémentation minimale (`startForeground()` + notification persistante) que l'utilisateur copie dans `android/app/src/main/java/com/lemtel/softphone/` après `npx cap add android`.
- **Mettre à jour** `apps/ava-softphone-mobile/docs/ios-rebuild-checklist.md` (ou créer `android-rebuild-checklist.md`) pour expliciter la fusion du snippet + copie du service.

## 3. `CallKitManager.swift` — vérifier `recordPermission` avant AVAudioSession
- **Ajouter** un helper statique `public static func hasRecordPermission() -> Bool` renvoyant `AVAudioSession.sharedInstance().recordPermission == .granted`.
- **Modifier `reportOutgoing(to:)`** pour appeler ce helper AVANT le `CXStartCallAction` :
  - Si `.denied` → afficher une `UIAlertController` native (« Microphone access required » / « Accès microphone requis ») avec bouton « Open Settings » (`UIApplication.shared.open(URL(string: UIApplicationOpenSettingsURLString)!)`) et « Cancel », puis retourner sans démarrer la transaction. Aucun crash, aucun `pjsua_call_make_call` lancé.
  - Si `.undetermined` → appeler `requestRecordPermission { granted in ... }` et n'appeler `reportOutgoing` que si granted, sinon même alerte.
- **Aucune modification** dans `didActivate` / `didDeactivate` : la garde vit uniquement avant l'appel sortant.
- Ce fichier est explicitement autorisé par ce prompt (override de la contrainte précédente).

## 4. `DialerScreen.tsx` — guard sur `micStatus` avant d'appeler
- **Importer `usePermissions`** et `PermissionBlockedScreen`.
- **Modifier `startCall`** :
  ```ts
  if (micStatus !== 'granted') {
    setShowMicBlocked(true);
    return;
  }
  ```
- **Ajouter** un état local `showMicBlocked` + un rendu conditionnel qui affiche `<PermissionBlockedScreen perm="microphone" onContinueWithout={() => setShowMicBlocked(false)} />` par-dessus le dialer quand actif. Ainsi l'utilisateur voit un écran neutre avec **Ouvrir les Réglages** et peut fermer sans crasher l'appel.
- **Désactiver visuellement** l'orbe d'appel (`disabled={... || micStatus !== 'granted'}`) et ajouter un `title` accessible.
- **Vérifier** qu'aucune autre entrée (redial, click-to-call depuis les recents) ne bypass ce guard — factoriser `startCall` si nécessaire, ou ajouter le guard dans le hook `useSoftphone.call()`.

## Vérifications
- Typecheck `npx tsgo --noEmit` sur `apps/ava-softphone-mobile`.
- Grep : plus aucune référence à `lemtel.permissionAsked.v1` ou `loadAsked` / `saveAsked`.
- Grep : `FOREGROUND_SERVICE_MICROPHONE` présent dans le snippet.
- Lecture manuelle de `reportOutgoing` : la garde de `recordPermission` précède `callController.request`.
- Lecture manuelle de `DialerScreen.startCall` : le guard `micStatus !== 'granted'` précède `sp.call(num)`.
- Après merge côté user : `git pull && npm i && npx cap sync && npx cap run android` puis vérification manuelle : refuser mic → l'orbe est disabled + tap → BlockedScreen s'affiche.

## Fichiers non touchés
`CapacitorSip.swift`, `Main.storyboard`, `project.pbxproj`, `RTPAudioSession.swift` (contraintes toujours en vigueur ; seul `CallKitManager.swift` est explicitement autorisé par ce prompt).
