## Objectif
Quand un admin Lemtel active l'app pour un end-user (toggle `app_access_enabled`, ou bouton "Send invite" / "Resend invite"), le user reçoit un email Lemtel branded contenant un résumé + un bouton **"View my credentials"** qui ouvre une page hébergée sécurisée affichant : domain, username, password (masqué par défaut avec Hide/Show + copy), QR code (auto-detect SIP URI / JSON AVA), et les badges de téléchargement App Store / Google Play / Mac OS / Windows / Linux.

## Architecture

### 1. Table `lemtel_softphone_invites` (nouvelle)
- `token` (text, unique, 32 chars base64url) — partagé dans l'URL
- `softphone_user_id` (uuid → lemtel_softphone_users / pbx_softphone_users)
- `email` (text)
- `expires_at` (timestamptz, 7 jours)
- `consumed_at` (timestamptz, nullable — premier reveal du password)
- `view_count` (int, default 0)
- `created_by` (uuid), `created_at`
- RLS : seul service_role lit/écrit ; l'edge function gère l'accès anonyme via token.

### 2. Edge Function `lemtel-invite-send` (nouvelle)
- Body : `{ softphone_user_id, regenerate_password?: boolean }`
- Vérifie que l'appelant est admin Lemtel ou super_admin.
- (Optionnel) Régénère le mot de passe SIP via `softphone-reset-password` puis le persiste.
- Crée un row dans `lemtel_softphone_invites` avec token cryptographique.
- Envoie l'email via Resend (template HTML Ringotel-style, Lemtel branding) avec le lien `https://avastatistic.ca/lemtel/setup/{token}`.
- Retourne `{ ok, invite_url, expires_at, email_sent }`.

### 3. Edge Function `lemtel-invite-redeem` (nouvelle, public)
- GET `?token=...&reveal=0|1`
- Sans `reveal=1` : retourne `{ display_name, extension, domain, wss_url, masked_password, qr_payload }`.
- Avec `reveal=1` : retourne `password` en clair, incrémente `view_count`, set `consumed_at`.
- Refuse si expiré.
- `qr_payload` = JSON `{ v:1, type:"ava-softphone", domain, ext, password, wss, displayName }` (l'app AVA mobile détecte) avec préfixe scannable aussi en `sip:ext:pwd@domain` pour fallback softphones tiers (deux QR sur la page : un "Auto-setup AVA app", un "Standard SIP").

### 4. Page React `src/pages/lemtel/SoftphoneSetup.tsx` (route publique `/lemtel/setup/:token`)
- Logo Lemtel en header centré (`/lemtel-logo.png`).
- Titre : « Get your softphone login credentials ».
- Carte credentials (style Ringotel) : Domain, Username, Password (Hide/Show + Copy chacun) à gauche, QR code à droite avec toggle "AVA app" / "Standard SIP".
- Section « Download the softphone app » :
  - Boutons primaires : App Store, Google Play, Mac OS (Apple Silicon + Intel), Windows, Linux AppImage, Chrome Extension (`/lemtel-chrome-extension.zip`).
  - "Also available on" pour les variantes secondaires.
- Animation framer-motion d'apparition, design glass-morphism cohérent avec le reste (token semantic, dark/light auto).
- Toast feedback sur copie.
- État expiré / déjà consommé → message clair + bouton "Request new invite" (mailto admin).
- État loading squelette.

### 5. Intégration UI admin (`src/pages/telephony/TelephonyUsers.tsx`)
- Nouveau bouton icône **📧 "Send invite"** dans la colonne actions de chaque user.
- Auto-trigger lors de l'activation initiale : à la création via `provision-softphone-user`, appeler aussi `lemtel-invite-send` (option `auto_invite: true` par défaut).
- Lors du re-toggle de `app_access_enabled` de false→true → toast suggérant "Renvoyer l'invitation ?" avec action.
- Indicateur "Invite envoyée le {date}" sous le nom du user (depuis `lemtel_softphone_invites`).

### 6. Template email (Ringotel-style, dans `lemtel-invite-send`)
- Header : bandeau bleu Lemtel (#0023e6 → #1d4ed8) avec logo + tagline "Unified Communications".
- Hero : « Welcome to Lemtel Telecom, {displayName} ».
- Bloc résumé : Extension, Email, Portal — pas de mot de passe en clair.
- CTA primaire bouton : **« View my login credentials → »** vers `/lemtel/setup/{token}` (expire dans 7 jours).
- Bloc « Download the softphone app » avec badges officiels Apple / Google Play / Mac OS encodés en SVG inline.
- Footer Lemtel + support.

### 7. Sécurité
- Token 32 bytes random base64url (≥190 bits d'entropie).
- Lien à expiration courte (7j), audit `view_count`.
- Pas de password dans l'email — uniquement dans la page après clic explicite "Show".
- Service-role-only RLS, fonction redeem vérifie expiration + statut.
- Headers `Cache-Control: no-store` + `X-Robots-Tag: noindex` sur la page de setup.

## Sections techniques
- **Tables / migrations** : `lemtel_softphone_invites` + GRANTs + RLS + index sur `token`.
- **Edge functions à créer** : `lemtel-invite-send`, `lemtel-invite-redeem`.
- **Edge functions à modifier** : `provision-softphone-user` (auto-call invite-send à la fin).
- **Routes** : ajouter `/lemtel/setup/:token` dans `src/App.tsx` (publique, hors AppSeparationGuard).
- **Assets** : utiliser `/lemtel-logo.png` déjà présent ; QR généré côté client avec `qrcode` (à installer).
- **Dépendance** : `bun add qrcode @types/qrcode`.
- **Secrets** : `RESEND_API_KEY` (déjà utilisé par `provision-softphone-user`).
- **Aucun impact** sur Planipret / AVA orgs.

## Livrables visibles
1. Email Lemtel branded reçu par l'end-user à l'activation.
2. Page `/lemtel/setup/:token` avec QR + credentials + downloads.
3. Bouton « Send invite » dans Telephony Users.
4. Renvoi automatique d'invite proposé au re-enable.