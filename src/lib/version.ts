// Build-time injected constants (see vite.config.ts `define`)
declare const __APP_BUILD_ID__: string;
declare const __APP_BUILD_TIME__: string;

export const BUILD_ID: string =
  typeof __APP_BUILD_ID__ !== "undefined" ? __APP_BUILD_ID__ : "dev";
export const BUILD_TIME: string =
  typeof __APP_BUILD_TIME__ !== "undefined" ? __APP_BUILD_TIME__ : new Date().toISOString();

export const APP_VERSION = `v${BUILD_TIME.slice(0, 10)}·${BUILD_ID}`;

/**
 * Hard reload — clears caches, unregisters service workers, then bypasses
 * the HTTP cache via a one-shot query param. Works on Chrome / Safari /
 * Firefox / iOS Safari / Android Chrome.
 */
export async function hardReload(reason = "manual") {
  try {
    console.warn(`[AVA] Hard reload triggered (${reason}). Build ${APP_VERSION}`);
    localStorage.removeItem("ava_app_build_id");
    const sw = await navigator.serviceWorker?.getRegistrations?.();
    await Promise.all((sw || []).map((r) => r.unregister()));
    const keys = await window.caches?.keys?.();
    await Promise.all((keys || []).map((k) => caches.delete(k)));
  } catch (e) {
    console.warn("[AVA] cache clear failed", e);
  }
  const url = new URL(location.href);
  url.searchParams.set("_ava_b", BUILD_ID);
  url.searchParams.set("_r", Date.now().toString(36));
  location.replace(url.toString());
}
