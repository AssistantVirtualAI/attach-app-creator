/**
 * backgroundSync — keeps call history, queues, voicemail and recordings fresh
 * even when the app is in the background.
 *
 * Strategy:
 *  - Native: register a BGTaskScheduler / WorkManager job via
 *    @capacitor/background-runner (when installed). Falls back gracefully.
 *  - Silent push: when a notification arrives, the App listener in
 *    useAutoSync triggers an immediate refresh.
 *  - Foreground: useAutoSync handles interval + visibility refresh.
 *
 * This module is intentionally tolerant: missing plugin -> no-op, so the
 * web preview keeps working.
 */
import { Capacitor } from '@capacitor/core';

const TASK_ID = 'com.lemtel.softphone.sync';
const INTERVAL_MIN = 15;

type SyncFn = () => Promise<void>;

let registered = false;
const runners = new Set<SyncFn>();

export function registerBackgroundSync(run: SyncFn) {
  runners.add(run);
  return () => runners.delete(run);
}

async function runAll() {
  await Promise.allSettled(Array.from(runners).map((r) => r()));
}

export async function initBackgroundSync() {
  if (registered) return;
  registered = true;

  if (!Capacitor.isNativePlatform()) return;

  // Best-effort registration. The plugin is optional; if not installed,
  // background refresh is delivered by silent pushes + foreground sync.
  try {
    // @ts-ignore — optional plugin
    const mod = await import('@capacitor/background-runner').catch(() => null);
    if (!mod) return;
    const { BackgroundRunner } = mod as any;
    await BackgroundRunner.dispatchEvent({
      label: TASK_ID,
      event: 'syncPbx',
      details: { intervalMinutes: INTERVAL_MIN },
    }).catch(() => {});
  } catch {
    /* ignore — plugin absent */
  }
}

/** Called from a silent push or BG event to fan out a sync to all consumers. */
export async function triggerBackgroundSync() {
  try {
    await runAll();
  } catch {
    /* swallow */
  }
}
