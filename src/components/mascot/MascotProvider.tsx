import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import MascotRobot from "./MascotRobot";

const MascotPanel = lazy(() => import("./MascotPanel"));

const HIDE_PREFIXES = [
  "/",
  "/login", "/signup", "/auth",
  "/portals", "/end-user", "/extension/login",
  "/portal/", "/client/portal", "/p/",
  "/features", "/demo-request", "/contact", "/download",
];

function shouldShow(pathname: string): boolean {
  if (pathname === "/") return false;
  for (const p of HIDE_PREFIXES) {
    if (p === "/") continue;
    if (pathname === p || pathname.startsWith(p + "/") || pathname.startsWith(p)) {
      return false;
    }
  }
  return true;
}

export default function MascotProvider() {
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [hidden, setHidden] = useState(false);

  useEffect(() => { setHidden(!shouldShow(pathname)); }, [pathname]);
  if (hidden) return null;

  return (
    <>
      <Suspense fallback={null}>
        {open && (
          <MascotPanel
            open={open}
            onClose={() => setOpen(false)}
            onMinimize={() => setOpen(false)}
          />
        )}
      </Suspense>
      {/* Launcher — TOP-RIGHT so it never overlaps the softphone bottom-right */}
      <button
        type="button"
        aria-label="Open Lemtel assistant"
        onClick={() => setOpen((v) => !v)}
        className="group fixed top-4 right-4 z-[60] w-24 h-28 rounded-2xl bg-background/70 backdrop-blur-xl border border-primary/40 shadow-[0_8px_32px_hsl(var(--primary)/0.35)] hover:scale-105 transition-transform overflow-hidden"
      >
        <MascotRobot listening={!open} compact />
        <span className="absolute top-1 right-1 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse ring-2 ring-background" />
        <span className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold text-foreground/80 opacity-0 group-hover:opacity-100 transition-opacity">
          Ask Lemtel
        </span>
      </button>
    </>
  );
}
