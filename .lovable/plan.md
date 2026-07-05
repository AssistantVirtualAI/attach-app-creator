## Objectif
Refonte du `PermissionGate` mobile pour respecter les guidelines Apple/Google et les exigences App Store : **une seule langue à l'écran**, **une permission par étape**, **aucun texte rouge alarmant**, **aucun badge technique**, et flux avec 3 états clairs (prompt / denied / granted).

## État actuel
Le tour précédent a déjà introduit `usePermissions`, `PermissionSoftPrompt`, `PermissionBlockedScreen` et refactoré `PermissionGate`. Il reste 5 écarts vs le prompt de spec :

1. Le gate ne demande **que** le microphone — les étapes Contacts et Notifications ont été retirées; le prompt exige un flux 3 étapes (mic requis, contacts optionnel, notifs optionnel).
2. `PermissionSoftPrompt` mélange encore deux icônes/couleurs par permission — OK sauf que le libellé du bouton "Not now" doit devenir "Continue without calls" pour le mic (comme spec) et "Skip this step" pour contacts/notifs.
3. `PermissionBlockedScreen` : le libellé du bouton fantôme doit être "Continue without calls" (mic) / "Skip this step" (autres). Déjà proche ; à harmoniser.
4. La détection de langue passe par `useT()` (qui lit `localStorage`, avec fallback `navigator.language`). Ajouter un **fallback direct `navigator.language`** dans les composants si le contexte I18n n'est pas monté (sécurité).
5. Vérifier qu'aucun composant amont ne réintroduit les badges de statut / boutons "Run diagnostic" en prod (le nouveau `PermissionGate` les a supprimés — à confirmer en lisant les usages).

## Livrables

### 1. `apps/ava-softphone-mobile/src/components/PermissionGate.tsx` — étendre le flux
- Passer d'un flux 1 étape (mic seul) à **3 étapes séquentielles** :
  1. `microphone` (requis, mais Skip disponible en denied → « Continue without calls »)
  2. `contacts` (optionnel, Skip toujours disponible → « Skip this step »)
  3. `notifications` (optionnel, Skip toujours disponible → « Skip this step »)
- Auto-avance quand une permission passe à `granted` ou `unavailable`.
- Si `blocked` → afficher `PermissionBlockedScreen`, sinon `PermissionSoftPrompt`.
- Aucune barre de progression multi-étapes visible (petits dots discrets uniquement — ou rien).
- Aucun badge de statut technique (`🎤 Mic denied` etc.) — supprimé.
- Bouton "Run diagnostic" retiré ou conditionné à `import.meta.env.DEV`.

### 2. `PermissionSoftPrompt.tsx` — paramétrer le libellé "skip"
- Ajouter une prop optionnelle `skipLabel?: string`.
- Le composant utilise `useT().lang` pour choisir FR ou EN — jamais les deux.
- Si `skipLabel` non fourni : défaut "Not now / Plus tard" selon la langue.

### 3. `PermissionBlockedScreen.tsx` — harmoniser les libellés
- Déjà OK côté monolingue et couleurs (`#94A3B8` neutres, pas de rouge).
- S'assurer que le bouton "Continuer sans …" utilise la copie exacte : « Continue without calls » (mic), « Skip this step » (contacts, notifs).

### 4. `hooks/usePermissions.ts` — inchangé
Déjà expose `micStatus`, `contactsStatus`, `notifStatus` avec `granted | denied | blocked | unavailable | unknown`, plus `requestMicrophonePermission()`, `requestContactsPermission()`, `requestNotificationsPermission()`, `openSettings()`. Écoute déjà `App.appStateChange` pour re-check après retour des Réglages.

### 5. `lib/permissionState.ts` — inchangé
La distinction denied/blocked (via flag "asked" en localStorage) reste la source de vérité.

### 6. Nettoyage
- Retirer l'import de `PermissionDiagPanel` du gate (ou le gater derrière `import.meta.env.DEV`).
- Rechercher et supprimer toute string bilingue résiduelle du type `"X · Y"` dans `PermissionGate.tsx` et composants voisins.

## Détails techniques

**Détection de langue (fallback direct, sans I18nProvider) :**
```ts
const detectLang = (): 'fr' | 'en' => {
  try { const v = localStorage.getItem('ava-language'); if (v === 'fr' || v === 'en') return v; } catch {}
  return (navigator.language || 'en').toLowerCase().startsWith('fr') ? 'fr' : 'en';
};
```
Utilisé uniquement en fallback ; `useT()` reste la source primaire.

**Palette autorisée pour les messages denied/blocked :**
- Texte informatif : `#94A3B8` (slate-400)
- Texte secondaire : `#64748B` (slate-500)
- Warning éventuel : `#F59E0B` (ambre)
- Jamais : `#EF4444`, `#DC2626`, `#F87171`

**Structure finale du gate :**
```
intro → microphone → contacts → notifications → done → onComplete()
        │            │          │
        ├ prompt: SoftPrompt(Allow / Continue without calls)
        ├ denied: SoftPrompt (re-prompt possible)
        ├ blocked: BlockedScreen(Open Settings / Continue without calls)
        └ granted|unavailable: skip auto
```

**Fichiers à NE PAS toucher** (rappel spec) :
`CapacitorSip.swift`, `CallKitManager.swift`, `Main.storyboard`, `project.pbxproj`, `RTPAudioSession.swift`.

## Vérification
- Typecheck `npx tsgo --noEmit` sur `apps/ava-softphone-mobile`.
- Grep `rg "·"` sur les composants Permission* → doit être vide (plus de séparateur bilingue).
- Grep `rg "#EF4444|#DC2626|#F87171"` sur les composants Permission* → doit être vide.
- Après merge : `git pull && npm i && npx cap sync && npx cap run android` (et `ios`) côté utilisateur pour valider sur device.

## Hors-scope
- Manifest Android (`RECORD_AUDIO`, `READ_CONTACTS`, `POST_NOTIFICATIONS`) et `Info.plist` iOS (`NSMicrophoneUsageDescription`, `NSContactsUsageDescription`, `NSUserNotificationsUsageDescription`) sont déjà présents dans `native-config/*.snippet` et fusionnés dans les projets natifs.
