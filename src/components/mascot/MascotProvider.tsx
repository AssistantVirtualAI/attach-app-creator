import { lazy, Suspense, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import MascotFox from "./MascotFox";

const MascotPanel = lazy(() => import("./MascotPanel"));

// Routes where the mascot must NOT appear.
const HIDE_PREFIXES = [
  "/", // exact landing only — handled below
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

  useEffect(() => {
    setHidden(!shouldShow(pathname));
  }, [pathname]);

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
      {/* Launcher */}
      <button
        type="button"
        aria-label="Open Lemtel assistant"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-[59] w-16 h-16 rounded-full bg-background/70 backdrop-blur-xl border border-primary/40 shadow-[0_0_24px_hsl(var(--primary)/0.4)] hover:scale-110 transition-transform"
      >
        <MascotFox listening={!open} />
        <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-primary animate-pulse ring-2 ring-background" />
      </button>
    </>
  );
}
