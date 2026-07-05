## État actuel

Après audit du codebase Lovable, la plupart des fichiers listés dans le prompt **n'existent pas** ici :
- ❌ `PermissionGate.tsx`, `PermissionSoftPrompt.tsx`, `PermissionBlockedScreen.tsx`, `permissionState.ts`, `MobileApp.tsx`, `nativeBoot.ts` → **absents**.
- ⚠️ `src/hooks/usePermissions.ts` existe mais c'est **RBAC org** (rôles admin/moderator), pas des permissions device — **ne pas supprimer**, ça casserait 15+ pages.
- ✅ `MobilePermissionsOnboarding.tsx` (Planipret) → déjà supprimé au tour précédent.
- ✅ Micro demandé au moment de l'appel dans Lemtel (`LemtelSoftphone.tsx` L90 `getUserMedia`) et Planipret (`useMplanipretSoftphone.ts` L219 `ensureMicPermission`).

## Ce qui reste à faire dans le web Lovable

### 1. Remplacer `MicPermissionDialog` (Planipret) par une bannière inline

Actuellement `MicPermissionDialog.tsx` est un **modal plein écran** monté depuis `PlanipretMobile.tsx` (L327-329) — non conforme au standard demandé (« simple inline banner in dialer only, NOT a full screen »).

- Créer `src/components/planipret/mobile/MicDeniedBanner.tsx` : bandeau slim sous le dialer avec message FR/EN + bouton « Ouvrir les réglages » (deep-link `app-settings:` sur iOS, `package:<id>` sur Android via `@capacitor/app`).
- Dans `PlanipretMobile.tsx` : remplacer `<MicPermissionDialog>` par `<MicDeniedBanner>`, garder l'état `micDialog` mais retirer la logique « retry pending call » (l'utilisateur retapera Appeler après avoir activé le micro).
- Supprimer `MicPermissionDialog.tsx`.

### 2. Ajouter une bannière `micDenied` inline dans le softphone Lemtel

Dans `src/components/lemtel/LemtelSoftphone.tsx` : capturer `NotAllowedError` dans `call()` (L87-93), setter `micDenied` et afficher la même bannière compacte au-dessus du clavier. Ne pas bloquer l'UI.

### 3. Créer `src/lib/native/requestNotificationsOnce.ts`

Helper partagé (idempotent via `@capacitor/preferences` clé `notif_permission_asked`) qui appelle `PushNotifications.requestPermissions()` **une seule fois** sur natif. No-op sur web.

### 4. L'appeler après login réussi dans les deux apps

- `src/components/planipret/mobile/MobileAuthScreen.tsx` (après `signInWithPassword` OK).
- `src/pages/planipret/PlanipretMobile.tsx` L495 (même endroit).
- Point d'entrée Lemtel équivalent (à confirmer — le softphone Lemtel n'a pas d'écran de login séparé ; à appeler lors du premier montage authentifié dans `LemtelSoftphone.tsx` si `user` présent).

## Ce qui NE doit PAS être modifié depuis Lovable

Ces fichiers vivent dans le **repo GitHub natif exporté**, pas dans ce projet Lovable :
- `SipConnectionService.kt` (Step 6) → à créer dans `android/app/src/main/java/com/lemtel/softphone/` du repo exporté.
- `AndroidManifest.xml` (permissions + `<service>`) → dans le repo exporté.
- `Info.plist` → dans le repo exporté (déjà OK selon Step 7).
- `CapacitorSip.swift`, `CallKitManager.swift`, `Main.storyboard`, `project.pbxproj`, `RTPAudioSession.swift`, `AppBridgeViewController.swift` → non touchés.

Je peux vous fournir les snippets prêts à coller pour ces fichiers natifs, mais le commit doit se faire dans votre repo GitHub, pas ici.

## Fichiers modifiés (web Lovable)

- **Créés** : `src/lib/native/requestNotificationsOnce.ts`, `src/components/planipret/mobile/MicDeniedBanner.tsx`
- **Modifiés** : `src/pages/planipret/PlanipretMobile.tsx`, `src/components/planipret/mobile/MobileAuthScreen.tsx`, `src/components/lemtel/LemtelSoftphone.tsx`
- **Supprimés** : `src/components/planipret/mobile/MicPermissionDialog.tsx`

## Vérification

- `tsgo` doit passer.
- Preview : `/planipret/mobile` → l'écran login s'affiche direct, pas de pré-écran permissions ; taper un numéro puis Appeler → dialog OS micro natif ; refuser → bannière inline (pas de modal plein écran).
