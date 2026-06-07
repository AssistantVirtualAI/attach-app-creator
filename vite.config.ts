import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

const BUILD_ID = Date.now().toString(36);
const BUILD_TIME = new Date().toISOString();

const avaCacheBustPlugin = (): Plugin => {
  let outDir = "dist";
  const bootScript = `
    <meta name="ava-build-id" content="${BUILD_ID}" />
    <meta name="ava-build-time" content="${BUILD_TIME}" />
    <script>
      (() => {
        const BUILD_ID = "${BUILD_ID}";
        const BUILD_TIME = "${BUILD_TIME}";
        const isProd = !location.hostname.includes("lovableproject.com") && location.hostname !== "localhost" && location.port !== "8080";
        if (!isProd) return;
        const VERSION_KEY = "ava_app_build_id";
        const FORCE_KEY = "ava_force_reload_count:" + BUILD_ID;
        const EVENTS_KEY = "ava_cache_bust_events";
        const STYLE_RELOAD_KEY = "ava_style_reload_count:" + BUILD_ID;
        const remember = (event, details = {}) => {
          const entry = { at: new Date().toISOString(), buildId: BUILD_ID, event, details };
          console.info("%c[AVA cache-bust]", "color:#0023e6;font-weight:700", entry);
          try {
            const events = JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]").slice(-24);
            events.push(entry);
            localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
            window.__avaCacheBustEvents = events;
          } catch (_) {}
        };
        const clearBrowserCaches = async () => {
          const regs = await navigator.serviceWorker?.getRegistrations?.().catch(() => []) || [];
          await Promise.all(regs.map((reg) => reg.unregister()));
          const keys = await window.caches?.keys?.().catch(() => []) || [];
          await Promise.all(keys.map((key) => caches.delete(key)));
          remember("cache-cleared", { serviceWorkers: regs.length, caches: keys.length });
        };
        const hasRuntimeStyles = () => {
          if (!document.body) return true;
          const probe = document.createElement("div");
          probe.className = "hidden p-4 bg-primary text-primary-foreground rounded-lg";
          document.body.appendChild(probe);
          const hasTokens = !!getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
          const styles = getComputedStyle(probe);
          const ok = hasTokens && styles.display === "none" && styles.paddingTop !== "0px";
          probe.remove();
          return ok;
        };
        const injectStylesheet = (href) => new Promise((resolve) => {
          const absolute = new URL(href, location.origin).toString();
          if ([...document.querySelectorAll('link[rel="stylesheet"]')].some((link) => link.href === absolute)) return resolve(true);
          const link = document.createElement("link");
          link.rel = "stylesheet";
          link.href = absolute + (absolute.includes("?") ? "&" : "?") + "_ava_css=" + Date.now().toString(36);
          link.onload = () => resolve(true);
          link.onerror = () => resolve(false);
          document.head.appendChild(link);
        });
        const repairStyles = async (reason) => {
          if (hasRuntimeStyles()) return remember("style-check-ok", { reason });
          remember("missing-styles", { reason, href: location.href });
          try {
            const res = await fetch("/version.json?_ava_css=" + Date.now().toString(36), { cache: "no-store", headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
            const latest = res.ok ? await res.json() : null;
            await Promise.all((latest?.css || []).map(injectStylesheet));
            await new Promise((resolve) => setTimeout(resolve, 700));
            if (hasRuntimeStyles()) return remember("styles-recovered", { source: "version-json" });
          } catch (error) {
            remember("style-repair-failed", { message: String(error?.message || error) });
          }
          const count = Number(sessionStorage.getItem(STYLE_RELOAD_KEY) || "0") + 1;
          sessionStorage.setItem(STYLE_RELOAD_KEY, String(count));
          if (count <= 3) return hardReload("missing-styles-" + reason);
          remember("style-reload-loop-stopped", { reason, count });
        };
        const hardReload = async (reason) => {
          const count = Number(sessionStorage.getItem(FORCE_KEY) || "0") + 1;
          sessionStorage.setItem(FORCE_KEY, String(count));
          remember("hard-reload", { reason, count });
          if (count > 3) return remember("reload-loop-stopped", { reason });
          await clearBrowserCaches();
          const url = new URL(location.href);
          url.searchParams.set("_ava_b", BUILD_ID);
          url.searchParams.set("_r", Date.now().toString(36));
          location.replace(url.toString());
        };
        const checkVersion = async () => {
          const stored = localStorage.getItem(VERSION_KEY);
          if (stored && stored !== BUILD_ID && new URL(location.href).searchParams.get("_ava_b") !== BUILD_ID) {
            localStorage.setItem(VERSION_KEY, BUILD_ID);
            return hardReload("html-build-changed");
          }
          localStorage.setItem(VERSION_KEY, BUILD_ID);
          try {
            const res = await fetch("/version.json?_r=" + Date.now().toString(36), { cache: "no-store", headers: { "Cache-Control": "no-store", Pragma: "no-cache" } });
            if (res.ok) {
              const latest = await res.json();
              remember("version-check", { current: BUILD_ID, latest: latest.buildId });
              if (latest.buildId && latest.buildId !== BUILD_ID) return hardReload("version-json-newer");
            }
          } catch (error) {
            remember("version-check-failed", { message: String(error?.message || error) });
          }
        };
        window.__avaCacheBust = { BUILD_ID, BUILD_TIME, checkVersion, hardReload, clearBrowserCaches, events: () => JSON.parse(localStorage.getItem(EVENTS_KEY) || "[]") };
        clearBrowserCaches();
        checkVersion();
        window.addEventListener("error", (event) => {
          const target = event.target;
          if (target?.tagName === "LINK" && target.rel === "stylesheet") {
            remember("stylesheet-load-error", { href: target.href });
            setTimeout(() => repairStyles("stylesheet-error"), 200);
          }
        }, true);
        const runStyleRepair = () => setTimeout(() => repairStyles("boot"), 1000);
        if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", runStyleRepair, { once: true }); else runStyleRepair();
        window.addEventListener("pageshow", runStyleRepair);
        window.addEventListener("focus", runStyleRepair);
        setInterval(checkVersion, 60000);
        document.addEventListener("visibilitychange", () => { if (!document.hidden) checkVersion(); });
      })();
    </script>`;

  return {
    name: "ava-cache-bust",
    configResolved(config) {
      outDir = config.build.outDir;
    },
    transformIndexHtml(html: string) {
      return html.replace("</head>", `${bootScript}\n</head>`);
    },
    closeBundle() {
      const indexPath = path.resolve(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const html = fs.readFileSync(indexPath, "utf8");
      const cssLinks = Array.from(html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["'][^>]*>/g)).map((match) => match[1]);
      fs.copyFileSync(indexPath, path.resolve(outDir, `index.${BUILD_ID}.html`));
      fs.writeFileSync(path.resolve(outDir, "version.json"), JSON.stringify({ buildId: BUILD_ID, buildTime: BUILD_TIME, index: `index.${BUILD_ID}.html`, css: cssLinks }));
    },
  };
};

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      protocol: "wss",
      clientPort: 443,
    },
    headers: {
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
    watch: {
      usePolling: true,
      interval: 1000,
    },
  },
  define: {
    __APP_BUILD_ID__: JSON.stringify(BUILD_ID),
    __APP_BUILD_TIME__: JSON.stringify(BUILD_TIME),
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  plugins: [react(), avaCacheBustPlugin(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
