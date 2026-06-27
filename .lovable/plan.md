## Objectif

1. Refaire la page d'auth de `/mplanipret` :
   - Logos **AVA Statistic** + **Planiprêt** côte à côte en haut.
   - Mention **"POWERED BY AVA · DEVELOPED BY AVA"** en bas.
   - 100 % bilingue **FR / EN** (titres, labels, placeholders, messages d'erreur, consentements légaux, footer).
   - Contenu et métadonnées prêts pour soumission **App Store + Google Play**.

2. Ajouter dans l'en-tête de l'app mobile (visible après login) trois contrôles, comme dans `/m` Lemtel :
   - Switch **langue FR/EN** (en haut à droite).
   - Switch **thème dark / light**.
   - Bouton **profil + statut** (Disponible / Occupé / Pause / Hors-ligne + changement de mot de passe), identique à `ProfileSheet` de Lemtel mobile.

Aucune logique backend, Supabase ou Edge Function n'est modifiée. Pas de touche à `/planipret/admin` ni à Lemtel.

---

## Périmètre des fichiers

### Nouveau
- `src/lib/i18n/mplanipret.ts` — petit dictionnaire FR/EN dédié à l'app mobile Planiprêt (clés `auth.*`, `header.*`, `profile.*`, `status.*`, `legal.*`).
- `src/hooks/useMplanipretLang.ts` — hook qui lit/écrit `mplanipret-lang` dans `localStorage` (défaut = navigateur, fallback FR) et expose `t(key)`.
- `src/hooks/useMplanipretTheme.ts` — hook qui pose `data-pp-theme="light|dark"` sur `.planipret-mobile-scope` et persiste dans `localStorage`.
- `src/components/planipret/mobile/MobileAuthScreen.tsx` — écran d'auth complet (logos, formulaire, langues, liens légaux, footer AVA).
- `src/components/planipret/mobile/MobileHeaderControls.tsx` — barre droite : `LangToggle` + `ThemeToggle` + bouton profil (ouvre `MobileProfileSheet`).
- `src/components/planipret/mobile/MobileProfileSheet.tsx` — drawer : avatar, nom, extension, sélecteur de statut (Disponible / Occupé / Pause / Hors-ligne), changement mot de passe, langue, thème, déconnexion. S'appuie uniquement sur `supabase.auth.updateUser` et `planipret_profiles.status` (colonnes déjà existantes).

### Modifiés (UI uniquement)
- `src/pages/planipret/PlanipretMobile.tsx`
  - Remplace le bloc `accessError === "unauthenticated"` par `<MobileAuthScreen onLoggedIn={loadProfile} />`.
  - Insère `<MobileHeaderControls />` dans le `<header>` à droite, à la place du bouton ⚙️ seul (l'icône paramètres devient un item du `MobileProfileSheet`).
  - Wrappe tous les libellés FR en dur (`"Accueil"`, `"Appels"`, footer, etc.) via `t()` du hook.
- `src/index.css` (scope `.planipret-mobile-scope`) — ajoute tokens `--pp-*` pour le mode **light** sous `[data-pp-theme="light"]`. Aucun changement aux tokens existants (dark reste défaut).

### Métadonnées store (préparation soumission)
- `apps/ava-softphone-mobile/store-metadata/planipret/metadata.txt` (EN) et `metadata-fr.txt` (FR) — titre, sous-titre, description longue, mots-clés, URL support, URL politique de confidentialité, catégorie (Business / Finance), classification d'âge 4+.
- `public/planipret-manifest.json` — vérifier `name`, `short_name`, `description` (déjà en place, juste mettre à jour le `description` bilingue minimal côté FR).
- README court `apps/ava-softphone-mobile/docs/planipret-store-submission.md` listant les checklists App Store / Play Store (screenshots requis, Info.plist déjà OK pour micro/contacts, Privacy Nutrition Labels, Data Safety form Google).

---

## Détails fonctionnels

### Écran d'auth (`MobileAuthScreen`)

Structure verticale dans le « téléphone » (390 × 844) :

```text
┌────────────────────────────┐
│   [AVA logo]   [PP logo]   │   ← deux logos côte à côte, 56×56
│   Planiprêt × AVA          │
│                            │
│   {auth.welcomeTitle}      │
│   {auth.welcomeSubtitle}   │
│                            │
│   [Courriel / Email]       │
│   [Mot de passe / Password]│
│   [ Se connecter / Sign in]│
│   {auth.forgotPassword}    │
│                            │
│   {legal.tos} · {privacy}  │
│                            │
│   POWERED BY [AVA] · DEV…  │
└────────────────────────────┘
```

- Switch FR/EN en haut-droite de l'écran d'auth (mêmes contrôles que dans le header, pour qu'on puisse changer avant login).
- Switch thème en haut-droite aussi.
- Validation : email + password obligatoires, messages d'erreur bilingues.
- Appelle exactement la même requête qu'aujourd'hui : `supabase.auth.signInWithPassword(...)` puis `loadProfile()`.
- Liens légaux pointent vers `/legal/terms` et `/legal/privacy` (déjà existants côté Planiprêt) — ouverts dans un drawer in-app pour respecter les guidelines App Store.

### En-tête mobile (`MobileHeaderControls`)

À droite du header, dans cet ordre (44×44 cible tactile) :
1. `LangToggle` — pilule `FR | EN`, identique visuellement à `LanguageSwitcher` du desktop Lemtel.
2. `ThemeToggle` — icône `Sun`/`Moon`, bascule `data-pp-theme`.
3. Bouton **avatar/initiales** avec pastille de statut colorée (vert/orange/rouge/gris) — ouvre `MobileProfileSheet`.

### Profil + statut (`MobileProfileSheet`)

Drawer bottom-sheet (réutilise le pattern `Dialer`) avec :
- Bandeau identité (avatar, nom complet, extension SIP, courriel).
- **Statut** : 4 boutons radio — `available`, `busy`, `break`, `offline`. UPDATE `planipret_profiles` (colonne `status` déjà présente) + toast.
- **Changer mot de passe** : 2 inputs (nouveau / confirmation), `supabase.auth.updateUser({ password })`.
- **Langue** + **Thème** dupliqués ici pour découverte.
- **Notifications** : raccourci vers réglages OS (placeholder).
- **Se déconnecter** : `supabase.auth.signOut()` puis retour à l'écran d'auth.

### Bilinguisation

Toutes les chaînes FR en dur dans `PlanipretMobile.tsx` (titres, placeholders, "Chargement…", "Application non activée", "Contacter le support", labels d'onglets, "POWERED BY / DEVELOPED BY") passent par `t()` du nouveau hook.
Les écrans enfants (`MHome`, `MCalls`, etc.) ne sont **pas** touchés dans ce plan — leur bilinguisation est un travail séparé.

### Préparation App Store / Play Store

Documenté dans `planipret-store-submission.md` :

- **iOS** : `Info.plist` déjà à jour (micro, contacts, notifications, réseau local). Ajouter `CFBundleLocalizations = [fr, en]` et `CFBundleDevelopmentRegion = fr_CA`. Privacy Manifest (`PrivacyInfo.xcprivacy`) déjà présent.
- **Android** : `strings.xml` + `strings-fr/strings.xml` (libellé app FR). `AndroidManifest.xml` `android:supportsRtl="false"`. Data Safety form : auth (email), audio (micro), contacts.
- Screenshots requis listés (6.7" iPhone, 5.5" iPhone, tablette 12.9", Pixel, tablette 10"), 3 mockups : auth bilingue, accueil, appel actif.
- Politique de confidentialité et CGU : URLs publiques `/legal/privacy` et `/legal/terms`.
- Classification : Business (iOS), Finance (Play). Âge 4+ / Everyone.

---

## Tests / validation

- Build typecheck via le pipeline existant.
- Vérification manuelle : `/mplanipret` non-connecté → nouvel écran d'auth, switch FR↔EN met à jour tout le texte, switch thème inverse les couleurs, login fonctionne.
- Vérification manuelle : connecté → en-tête montre les 3 contrôles, drawer profil change le statut (vérifier en DB via `planipret_profiles.status`), changement de mot de passe fonctionne, déconnexion ramène à l'écran d'auth.
- `tests/mplanipret-routing.spec.ts` reste vert (aucune route modifiée).

---

## Hors périmètre

- Pas de modification de `MHome`, `MCalls`, `MMessages`, `MContacts`, `MMore` (sauf si tu confirmes vouloir aussi les bilinguiser maintenant).
- Pas de changement des Edge Functions, RLS, ou schéma DB.
- Pas de toucher au portail admin `/planipret/admin` ni à Lemtel `/m`.
