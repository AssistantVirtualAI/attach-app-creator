# Transcripts persistants + diffusion partout

## Objectif
Quand un appel est transcrit (voice-to-text Whisper + analyse Claude), le résultat doit être :
1. **Sauvegardé automatiquement** une seule fois (déjà partiellement le cas côté serveur).
2. **Jamais relancé** pour le même appel — toute réouverture sur n'importe quelle app affiche le transcript existant instantanément, sans re-consommer de tokens.
3. **Diffusé en temps réel** dans toutes les surfaces : softphone mobile (AVA), softphone desktop, portail web (lemtel/telephony/admin).

## État actuel (vérifié)
- `ai-transcribe-call` court-circuite déjà si `pbx_call_transcripts` existe pour l'appel (sauf `force=true`). ✅
- `ai-analyze-call` court-circuite déjà si `pbx_ai_insights` existe (sauf `force=true`). ✅
- `pbx_ai_insights` est dans la publication realtime. ✅
- `pbx_call_transcripts` n'est **pas** dans la publication realtime. ❌
- Aucun client (mobile, desktop, portail) ne s'abonne aux changements de transcript / insight pour rafraîchir l'écran. ❌
- Aucun déclencheur automatique ne lance la transcription dès qu'un enregistrement arrive ; l'utilisateur doit cliquer sur "Transcrire" la première fois. ❌

## Plan

### 1. Base de données
- Ajouter `pbx_call_transcripts` à la publication `supabase_realtime` (avec `REPLICA IDENTITY FULL`).
- Ajouter un index unique `(call_record_id)` sur `pbx_call_transcripts` (un seul transcript par appel) pour garantir l'idempotence et accélérer le cache hit.
- Ajouter un trigger `AFTER INSERT` sur `pbx_call_recordings` qui insère une ligne dans `pbx_ai_jobs` (status `queued`, kind `transcribe`) — sans appeler l'edge function depuis Postgres (pas d'http côté DB).
- Ajouter une fonction `pg_notify('pbx_ai_jobs_new', ...)` déclenchée par le trigger, écoutée par un mini worker existant si présent ; sinon, l'app mobile / portail consomment la file via realtime sur `pbx_ai_jobs` et envoient au edge.

### 2. Edge functions
- `ai-transcribe-call` :
  - Idempotence renforcée : utiliser `upsert` sur `(call_record_id)` au lieu de `delete` + `insert` (évite la fenêtre où un autre client lit "rien").
  - À la fin de la sauvegarde, faire un `channel('ai-transcripts:{organization_id}').send(broadcast {call_record_id, transcript_text, provider})` pour les clients non abonnés à postgres_changes.
- `ai-analyze-call` :
  - Diffuser également sur `channel('ai-insights:{organization_id}')` (en plus du canal user déjà présent).

### 3. Mobile (AVA softphone)
- `useCallAi.ts` : retirer toute logique qui force `run()` automatiquement quand `data?.transcript` est déjà non vide. Le `load()` initial reste, mais n'enchaîne **jamais** sur `run()` sauf clic explicite.
- Ajouter une souscription realtime dans `useCallAi` : `postgres_changes` sur `pbx_call_transcripts` filtrée par `call_record_id` et sur `pbx_ai_insights` filtrée par `call_record_id` → merge dans `data` quand un événement arrive.
- `RecordingsScreen.tsx` : si la ligne possède déjà `has_transcript=true` (déduit du join), n'afficher **pas** le bouton "Transcrire" ; afficher "Voir transcript".

### 4. Desktop (AVA softphone desktop)
- `CallIntelligencePanel.tsx` / `AIInsights.tsx` : ajouter la même souscription realtime sur `pbx_call_transcripts` + `pbx_ai_insights` pour l'appel ouvert.
- Lecture initiale identique au mobile, via `useCallIntelligence` qui déjà cache 24 h côté React Query : invalider la query sur réception d'événement realtime.

### 5. Portail web
- `src/pages/lemtel/admin/AdminRecordings.tsx` et `src/pages/telephony/TelephonyAI.tsx` : même souscription realtime ; quand un transcript ou un insight arrive pour un appel listé, invalider la query React Query correspondante.
- `useCallIntelligence.ts` : ajouter dans le hook un `useEffect` qui s'abonne à `postgres_changes` sur les deux tables filtré par `call_record_id` et appelle `qc.setQueryData(key, ...)`.

### 6. UX
- Bouton "Transcrire" devient "Re-transcrire (forcer)" quand un transcript existe déjà, avec confirmation et `force:true` (consomme des tokens).
- Badge "Transcrit ✓" sur la ligne d'appel dans toutes les listes (mobile, desktop, portail).

## Détails techniques

```sql
-- Migration
ALTER TABLE public.pbx_call_transcripts REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pbx_call_transcripts;

CREATE UNIQUE INDEX IF NOT EXISTS pbx_call_transcripts_call_record_id_uniq
  ON public.pbx_call_transcripts (call_record_id);
```

```ts
// useCallAi.ts — ajout
useEffect(() => {
  if (!callId) return;
  const ch = supabase.channel(`call-ai:${callId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_call_transcripts', filter: `call_record_id=eq.${callId}` }, () => load())
    .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_ai_insights',     filter: `call_record_id=eq.${callId}` }, () => load())
    .subscribe();
  return () => { supabase.removeChannel(ch); };
}, [callId, load]);
```

## Hors périmètre
- Pas de changement sur la pipeline d'enregistrement audio ni le lecteur.
- Pas de changement sur les permissions/RLS existantes ; les souscriptions realtime respectent les policies déjà en place sur `pbx_call_transcripts` et `pbx_ai_insights`.
- Pas de modification de `src/integrations/supabase/client.ts` ni des fichiers Landing.
