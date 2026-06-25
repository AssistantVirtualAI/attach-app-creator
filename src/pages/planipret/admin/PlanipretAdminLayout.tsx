import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Phone, MessageSquare, Voicemail, Plug, BarChart3, LogOut, ClipboardList, ShieldCheck, Flame, Zap, CheckSquare } from "lucide-react";
import SessionTimeoutModal from "@/components/planipret/SessionTimeoutModal";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import NotificationsBell from "@/components/planipret/admin/NotificationsBell";
import CommandPalette from "@/components/planipret/admin/CommandPalette";

const LINKS = [
  { to: "/planipret/admin/overview", label: "Vue d'ensemble", Icon: LayoutDashboard },
  { to: "/planipret/admin/users", label: "Utilisateurs", Icon: Users },
  { to: "/planipret/admin/calls", label: "Appels", Icon: Phone },
  { to: "/planipret/admin/leads", label: "Leads & Pipeline", Icon: Flame },
  { to: "/planipret/admin/messages", label: "Messages", Icon: MessageSquare },
  { to: "/planipret/admin/voicemails", label: "Voicemails", Icon: Voicemail },
  { to: "/planipret/admin/templates", label: "Templates SMS", Icon: Zap },
  { to: "/planipret/admin/reports", label: "Rapports", Icon: BarChart3 },
  { to: "/planipret/admin/audit", label: "Journal d'audit", Icon: ClipboardList },
  { to: "/planipret/admin/compliance", label: "Conformité", Icon: ShieldCheck },
  { to: "/planipret/admin/audit-checklist", label: "Audit système", Icon: CheckSquare },
  { to: "/planipret/admin/integrations", label: "Intégrations", Icon: Plug },
];

const PAGE_TITLES: Record<string, string> = {
  "/planipret/admin/overview": "Vue d'ensemble",
  "/planipret/admin/users": "Gestion des utilisateurs",
  "/planipret/admin/calls": "Appels",
  "/planipret/admin/leads": "Leads & Pipeline",
  "/planipret/admin/messages": "Messages",
  "/planipret/admin/voicemails": "Voicemails",
  "/planipret/admin/integrations": "Intégrations",
  "/planipret/admin/reports": "Rapports",
  "/planipret/admin/audit": "Journal d'audit",
  "/planipret/admin/audit-checklist": "Audit système",
  "/planipret/admin/compliance": "Conformité",
};

const initials = (n?: string) => (n ?? "A").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "A";

export default function PlanipretAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [missingIntegrations, setMissingIntegrations] = useState(0);
  const { status: rtStatus } = useAdminRealtime();
  const realtimeOk = rtStatus === "live";
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Keyboard shortcuts: Cmd/Ctrl+K palette, "g <key>" navigation, "/" focus palette
  useEffect(() => {
    let gPressed = 0;
    const MAP: Record<string, string> = {
      o: "/planipret/admin/overview", u: "/planipret/admin/users",
      c: "/planipret/admin/calls", l: "/planipret/admin/leads",
      m: "/planipret/admin/messages", v: "/planipret/admin/voicemails",
      r: "/planipret/admin/reports",
    };
    const isTyping = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t) return false;
      const tag = t.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable;
    };
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault(); setPaletteOpen((o) => !o); return;
      }
      if (isTyping(e)) return;
      if (e.key === "/") { e.preventDefault(); setPaletteOpen(true); return; }
      if (e.key === "g") { gPressed = Date.now(); return; }
      if (gPressed && Date.now() - gPressed < 1000 && MAP[e.key.toLowerCase()]) {
        gPressed = 0; navigate(MAP[e.key.toLowerCase()]);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [navigate]);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/planipret/login", { replace: true }); return; }
      const { data } = await supabase.from("planipret_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (!data || data.role !== "admin") { navigate("/mplanipret", { replace: true }); return; }
      setProfile(data);
      setLoading(false);
      try {
        const { data: sec } = await supabase.functions.invoke("pp-integration-secrets");
        const present = new Set(((sec as any)?.items ?? []).filter((i: any) => i.has_keys?.length).map((i: any) => i.provider));
        const required = ["elevenlabs", "anthropic", "maestro", "microsoft"];
        setMissingIntegrations(required.filter((p) => !present.has(p)).length);
      } catch { /* ignore */ }
    })();
  }, [navigate]);




  const logout = async () => { await supabase.auth.signOut(); navigate("/login", { replace: true }); };

  if (loading) return <div className="planipret-scope min-h-screen flex items-center justify-center" style={{ color: "var(--pp-text-muted)" }}>Chargement…</div>;

  const title = PAGE_TITLES[location.pathname] ?? "Tableau de bord";
  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="planipret-scope min-h-screen flex" style={{ background: "var(--pp-bg-base)" }}>
      {/* Mobile redirect notice */}
      <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-6" style={{ background: "var(--pp-bg-base)" }}>
        <div className="text-center max-w-xs pp-card" style={{ padding: 24 }}>
          <h2 style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 18, color: "var(--pp-text-primary)", marginBottom: 8 }}>Dashboard admin</h2>
          <p style={{ fontSize: 13, color: "var(--pp-text-secondary)", marginBottom: 16 }}>Le dashboard admin est optimisé pour desktop. Sur mobile, utilisez l'application courtier.</p>
          <button onClick={() => navigate("/mplanipret")} className="pp-btn-primary">Ouvrir l'app mobile</button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-[260px] z-40"
        style={{ background: "var(--pp-bg-deep)", borderRight: "1px solid var(--pp-bg-border)" }}>
        <div className="px-5 pt-5 pb-4" style={{ borderBottom: "1px solid var(--pp-bg-border)" }}>
          <div style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 16, color: "var(--pp-text-primary)", letterSpacing: "0.04em" }}>
            PLANIPRÊT
          </div>
          <div style={{ fontFamily: "DM Sans,sans-serif", fontWeight: 500, fontSize: 10, color: "var(--pp-brand-accent)", marginTop: 2 }}>
            AI Portal · Admin
          </div>
          <div style={{ height: 1, marginTop: 12, background: "linear-gradient(90deg, var(--pp-brand-accent), transparent)", opacity: 0.4 }} />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {LINKS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition"
              style={({ isActive }) => isActive
                ? {
                    background: "linear-gradient(135deg, #0D2A4A, #091E35)",
                    border: "1px solid rgba(46,155,220,0.25)",
                    color: "var(--pp-text-primary)",
                  }
                : { color: "var(--pp-text-muted)", border: "1px solid transparent" }
              }>
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4" style={{ color: isActive ? "var(--pp-brand-accent)" : "currentColor" }} />
                  <span className="flex-1">{label}</span>
                  {to === "/planipret/admin/integrations" && missingIntegrations > 0 && (
                    <span className="text-[9px] font-bold text-white rounded-full flex items-center justify-center"
                      style={{ background: "var(--pp-danger)", width: 18, height: 18 }}>
                      {missingIntegrations}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4" style={{ borderTop: "1px solid var(--pp-bg-border)" }}>
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ width: 36, height: 36, background: "linear-gradient(135deg, #1A4A8A, #2E9BDC)" }}>
              {initials(profile?.full_name)}
            </div>
            <div className="min-w-0">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--pp-text-primary)" }} className="truncate">{profile?.full_name ?? "Admin"}</p>
              <p style={{ fontSize: 10, color: "var(--pp-text-faint)" }}>Super Admin</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm transition"
            style={{ color: "var(--pp-text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "var(--pp-bg-elevated)")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="hidden md:flex flex-1 flex-col ml-[260px]">
        <header className="sticky top-0 h-14 flex items-center justify-between px-6 z-30"
          style={{ background: "var(--pp-bg-base)", borderBottom: "1px solid var(--pp-bg-border)" }}>
          <h1 style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 18, color: "var(--pp-text-primary)" }}>{title}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"
              style={{
                background: realtimeOk ? "#0D3D2A" : "var(--pp-bg-elevated)",
                border: `1px solid ${realtimeOk ? "#1A5A3F" : "var(--pp-bg-border-2)"}`,
                borderRadius: 20, padding: "4px 12px",
              }}>
              <span className={realtimeOk ? "pp-live-dot" : ""} style={!realtimeOk ? { width: 6, height: 6, borderRadius: "50%", background: "var(--pp-text-faint)" } : undefined} />
              <span style={{ fontSize: 10, fontWeight: 600, color: realtimeOk ? "var(--pp-success)" : "var(--pp-text-muted)" }}>
                {realtimeOk ? "En direct" : "Reconnexion…"}
              </span>
            </div>
            <NotificationsBell />
            <span className="capitalize" style={{ fontSize: 10, color: "var(--pp-text-muted)" }}>{dateLabel}</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet context={{ profile }} />
        </main>
      </div>
      <SessionTimeoutModal />
    </div>
  );
}
