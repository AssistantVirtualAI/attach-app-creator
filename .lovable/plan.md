# Réorganisation de la barre de navigation mobile

## Objectif
Faire correspondre la barre du bas à la capture d'écran fournie :
**Contacts · Chats · Calls · Keypad · Speed dial** — supprimer Home, supprimer complètement le bouton AVA (chatbot) flottant au centre.

## 1. `components/BottomTabs.tsx` — refonte
- Supprimer le bouton circulaire AVA flottant au centre et toute la logique associée (gradient, label "AVA").
- Remplacer le type `Tab` actif par les 5 onglets visibles : `contacts | chats | calls | keypad | speeddial` (les anciens identifiants `home`, `ava`, `more`, `voicemail`, `sms`, `queues`, `messages`, `settings` restent dans le type pour les deep-links mais ne sont plus rendus dans la barre).
- Grille `gridTemplateColumns: 'repeat(5, 1fr)'`.
- Icônes (lucide) :
  - Contacts → `User`
  - Chats → `MessageCircle` (ou icône bulle de discussion)
  - Calls → `Phone`
  - Keypad → `Grid3x3` (style pavé numérique)
  - Speed dial → `LayoutGrid` (4 points / grille)
- L'onglet actif garde le style bleu surligné comme dans la photo (texte bleu, icône bleue).

## 2. `MobileApp.tsx` — routage
- Onglet par défaut : `keypad` (au lieu de `home`).
- Mapping des routes rendues :
  - `contacts` → `ContactsScreen`
  - `chats` → `MessagesHubScreen` (réutilise l'écran de messagerie existant)
  - `calls` → `CallsScreen`
  - `keypad` → `DialerScreen`
  - `speeddial` → nouvel écran (voir §4)
- Conserver les routes existantes pour deep-links (`home`, `ava`, `more`, etc.) mais ne plus les afficher dans la barre.
- Supprimer le redirect automatique vers `ava` dans le gestionnaire de notifications (ou le laisser ouvrir `chats`).
- Remplacer `setTab('home')` initial par `setTab('keypad')`.

## 3. `SettingsScreen.tsx` — masquer AVA chatbot
- Supprimer toute entrée/lien menant à `AVAChatScreen` ou au "AVA Assistant / Chatbot" dans la page Réglages.
- Retirer également le `DialerFab` "AVA" s'il apparaît dans d'autres écrans liés aux réglages.

## 4. Nouvel écran `screens/SpeedDialScreen.tsx`
- Grille de favoris (contacts épinglés) avec appel rapide via `sp.call(number)` ou Click-to-Call.
- Données depuis `mobileApi.getContacts({ favorite: true })` (fallback : liste vide avec état "Ajoutez des favoris").
- Skeletons pendant le chargement (cohérent avec les autres écrans).

## 5. i18n
- Ajouter clés `tabs.contacts`, `tabs.chats`, `tabs.keypad`, `tabs.speeddial` (fr + en).
- Supprimer `tabs.home` et `tabs.ava` de la barre (clés peuvent rester pour compat).

## Fichiers touchés
- `apps/ava-softphone-mobile/src/components/BottomTabs.tsx` (refonte)
- `apps/ava-softphone-mobile/src/MobileApp.tsx` (routage + tab initial)
- `apps/ava-softphone-mobile/src/screens/SettingsScreen.tsx` (suppression entrées AVA)
- `apps/ava-softphone-mobile/src/screens/SpeedDialScreen.tsx` (nouveau)
- `apps/ava-softphone-mobile/src/lib/i18n.ts` (nouvelles clés)

## Hors scope
- Pas de modification du backend / edge functions.
- `AVAChatScreen` reste accessible via deep-link (`?tab=ava`) mais n'est plus exposé dans l'UI.
