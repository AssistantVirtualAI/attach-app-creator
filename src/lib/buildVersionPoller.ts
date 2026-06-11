// Polls /version.json periodically so any new build triggers a clean hard-reload.
// Complements the boot-time check installed by vite.config.ts.
import { BUILD_ID, hardReload } from "@/lib/version";

const POLL_MS = 60_000;
let started = false;

async function checkOnce(reason: string) {
  try {
    // Prefer the cache-bust hook injected by vite.config (handles toast + reload loop guard).
    const w = window as any;
    if (typeof w?.__avaCacheBust?.checkVersion === "function") {
      await w.__avaCacheBust.checkVersion();
      return;
    }
    const res = await fetch(`/version.json?_r=${Date.now().toString(36)}`, {
      cache: "no-store",
      headers: { "Cache-Control": "no-store", Pragma: "no-cache" },
    });
    if (!res.ok) return;
    const latest = await res.json();
    if (latest?.buildId && latest.buildId !== BUILD_ID) {
      console.warn(`[AVA] new build detected (${reason}): ${latest.buildId} ≠ ${BUILD_ID}`);
      await hardReload(`poller-${reason}`);
    }
  } catch (e) {
    console.warn("[AVA] build-version poll failed", e);
  }
}

export function startBuildVersionPoller() {
  if (started || typeof window === "undefined") return;
  started = true;
  window.setInterval(() => checkOnce("interval"), POLL_MS);
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkOnce("visibility");
  });
  window.addEventListener("online", () => checkOnce("online"));
}

if (typeof window !== "undefined") startBuildVersionPoller();
