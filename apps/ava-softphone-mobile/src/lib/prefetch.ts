/**
 * Préchargement opportuniste des données les plus consultées.
 *
 * Utilise `requestIdleCallback` (avec fallback `setTimeout`) pour ne pas
 * bloquer le premier rendu. Les appels passent par `mobileApi.*` qui est déjà
 * dédupliqué (in-flight) — donc inoffensif si la page demande la même donnée.
 *
 * Les résultats sont stockés dans le cache partagé `useAutoSync` via
 * `seedAutoSyncCache(cacheKey, value)` pour un affichage instantané.
 */
import { mobileApi } from './mobileApi';
import { seedAutoSyncCache } from '../hooks/useAutoSync';

type Task = { key: string; run: () => Promise<unknown> };

const TASKS: Task[] = [
  { key: 'mobile.me',         run: () => mobileApi.me() },
  { key: 'mobile.dashboard',  run: () => mobileApi.dashboard() },
  { key: 'mobile.calls.7',    run: () => mobileApi.calls({ rangeDays: 7 }) },
  { key: 'mobile.voicemails', run: () => mobileApi.voicemails() },
  { key: 'mobile.threads',    run: () => mobileApi.threads() },
];

let started = false;

export function startPrefetch() {
  if (started) return; started = true;
  const schedule = (cb: () => void) => {
    const ric = (globalThis as any).requestIdleCallback as undefined | ((c: () => void, o?: { timeout: number }) => number);
    if (ric) ric(cb, { timeout: 2_000 });
    else setTimeout(cb, 600);
  };
  schedule(() => {
    // Exécute en série pour ne pas saturer le réseau mobile.
    (async () => {
      for (const t of TASKS) {
        try {
          const v = await t.run();
          seedAutoSyncCache(t.key, v);
        } catch { /* silencieux : pas critique */ }
      }
    })();
  });
}
