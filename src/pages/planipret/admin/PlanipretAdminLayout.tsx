import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Phone, MessageSquare, Voicemail, Plug, BarChart3, LogOut, ShieldCheck, CheckSquare, Search } from "lucide-react";
import SessionTimeoutModal from "@/components/planipret/SessionTimeoutModal";
import { useAdminRealtime } from "@/hooks/useAdminRealtime";
import NotificationsBell from "@/components/planipret/admin/NotificationsBell";
import CommandPalette from "@/components/planipret/admin/CommandPalette";

const SSO_URL = "https://avastatistic.ca/login?redirect=planipret";

const LINKS = [
  { to: "/planipret/admin/overview", label: "Vue d'ensemble", Icon: LayoutDashboard, emoji: "🏠" },
  { to: "/planipret/admin/users", label: "Courtiers", Icon: Users, emoji: "👥", badge: "brokers" as const },
  { to: "/planipret/admin/calls", label: "Appels", Icon: Phone, emoji: "📞", badge: "missed" as const },
  { to: "/planipret/admin/messages", label: "Messages", Icon: MessageSquare, emoji: "💬" },
  { to: "/planipret/admin/voicemails", label: "Voicemails", Icon: Voicemail, emoji: "📬" },
  { to: "/planipret/admin/reports", label: "Rapports", Icon: BarChart3, emoji: "📊" },
  { to: "/planipret/admin/integrations", label: "Intégrations", Icon: Plug, emoji: "🔌", badge: "integrations" as const },
  { to: "/planipret/admin/compliance", label: "Conformité", Icon: ShieldCheck, emoji: "🔏" },
  { to: "/planipret/admin/audit-checklist", label: "Audit système", Icon: CheckSquare, emoji: "✅", badge: "audit" as const },
];

const PAGE_TITLES: Record<string, string> = {
  "/planipret/admin/overview": "Vue d'ensemble",
  "/planipret/admin/users": "Gestion des courtiers",
  "/planipret/admin/calls": "Historique des appels",
  "/planipret/admin/messages": "Messages",
  "/planipret/admin/voicemails": "Boîtes vocales",
  "/planipret/admin/integrations": "Intégrations",
  "/planipret/admin/reports": "Rapports & Analytics",
  "/planipret/admin/audit-checklist": "Audit système",
  "/planipret/admin/compliance": "Conformité PIPEDA · Loi 25",
};

const initials = (n?: string) => (n ?? "A").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "A";

export default function PlanipretAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [missingIntegrations, setMissingIntegrations] = useState(0);
  const [missedCalls, setMissedCalls] = useState(0);
  const [brokerCount, setBrokerCount] = useState(0);
  const [auditScore, setAuditScore] = useState<number | null>(null);
  const { status: rtStatus } = useAdminRealtime();
  const realtimeOk = rtStatus === "live";
  const [paletteOpen, setPaletteOpen] = useState(false);

  // Keyboard shortcuts: Cmd/Ctrl+K palette, "g <key>" navigation, "/" focus palette
  useEffect(() => {
    let gPressed = 0;
    const MAP: Record<string, string> = {
      o: "/planipret/admin/overview", u: "/planipret/admin/users",
      c: "/planipret/admin/calls", m: "/planipret/admin/messages",
      v: "/planipret/admin/voicemails", r: "/planipret/admin/reports",
      i: "/planipret/admin/integrations",
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
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { window.location.href = SSO_URL; return; }
      const user = session.user;
      const { data } = await supabase.from("planipret_profiles").select("*").eq("user_id", user.id).maybeSingle();
      if (!data) { window.location.href = SSO_URL; return; }
      if (data.role !== "admin") { navigate("/mplanipret", { replace: true }); return; }
      setProfile(data);
      setLoading(false);

      // Sidebar badges
      try {
        const { count: bc } = await supabase.from("planipret_profiles").select("*", { count: "exact", head: true });
        setBrokerCount(bc ?? 0);
      } catch { /* ignore */ }
      try {
        const since = new Date(); since.setHours(0, 0, 0, 0);
        const { count: mc } = await supabase
          .from("planipret_phone_calls").select("*", { count: "exact", head: true })
          .eq("direction", "inbound").eq("status", "missed").gte("created_at", since.toISOString());
        setMissedCalls(mc ?? 0);
      } catch { /* ignore */ }
      try {
        const { data: sec } = await supabase.functions.invoke("pp-integration-secrets");
        const present = new Set(((sec as any)?.items ?? []).filter((i: any) => i.has_keys?.length).map((i: any) => i.provider));
        const required = ["elevenlabs", "anthropic", "maestro", "microsoft"];
        setMissingIntegrations(required.filter((p) => !present.has(p)).length);
      } catch { /* ignore */ }
      try {
        const cached = localStorage.getItem("pp:audit:score");
        if (cached) setAuditScore(Number(cached));
      } catch { /* ignore */ }
    })();
  }, [navigate]);




  const logout = async () => { await supabase.auth.signOut(); window.location.href = SSO_URL; };

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

      {/* Sidebar — 240px */}
      <aside className="hidden md:flex flex-col fixed left-0 top-0 h-screen w-[240px] z-40"
        style={{ background: "#040B16", borderRight: "1px solid #0A1E35", fontFamily: "'DM Sans', sans-serif" }}>
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center" style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg, #1A4A8A, #2E9BDC)",
              fontSize: 16, lineHeight: 1,
            }}>🏠</div>
            <div className="min-w-0">
              <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 14, color: "#E8EDF5", letterSpacing: "0.04em" }}>PLANIPRÊT</div>
              <div style={{ fontWeight: 500, fontSize: 10, color: "#2E9BDC" }}>AI Portal · Admin</div>
            </div>
          </div>
          <div style={{ height: 1, marginTop: 12, background: "linear-gradient(90deg, #2E9BDC, transparent)", opacity: 0.35 }} />
        </div>
        <nav className="flex-1 px-2.5 py-3 space-y-0.5 overflow-y-auto">
          {LINKS.map(({ to, label, Icon, badge }) => (
            <NavLink key={to} to={to}
              className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg transition"
              style={({ isActive }) => isActive
                ? { background: "#0D2A4A", border: "1px solid rgba(46,155,220,0.2)", color: "#E8EDF5", fontSize: 13, fontWeight: 500 }
                : { color: "#4A7FA5", border: "1px solid transparent", fontSize: 13, fontWeight: 500 }
              }>
              {({ isActive }) => (
                <>
                  <Icon className="w-4 h-4" style={{ color: isActive ? "#2E9BDC" : "currentColor" }} />
                  <span className="flex-1">{label}</span>
                  {badge === "brokers" && brokerCount > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#8FA8C0", background: "#0D1F35", border: "1px solid #0E2A45", borderRadius: 6, padding: "1px 6px" }}>{brokerCount}</span>
                  )}
                  {badge === "missed" && missedCalls > 0 && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#fff", background: "#E84C4C", borderRadius: 999, minWidth: 16, height: 16, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{missedCalls}</span>
                  )}
                  {badge === "integrations" && missingIntegrations > 0 && (
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: "#F5A623", boxShadow: "0 0 8px rgba(245,166,35,.6)" }} />
                  )}
                  {badge === "audit" && auditScore !== null && (
                    <span style={{ fontSize: 9, fontWeight: 700, color: "#F5A623", background: "#2A1A00", border: "1px solid #4A3000", borderRadius: 6, padding: "1px 6px" }}>{auditScore}%</span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div style={{ padding: 14, borderTop: "1px solid #0A1E35" }}>
          <div className="flex items-center gap-3">
            <div className="rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ width: 36, height: 36, background: "linear-gradient(135deg, #1A4A8A, #2E9BDC)" }}>
              {initials(profile?.full_name)}
            </div>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 12, fontWeight: 600, color: "#E8EDF5" }} className="truncate">{profile?.full_name ?? "Admin"}</p>
              <p style={{ fontSize: 10, color: "#4A7FA5" }}>Super Admin</p>
            </div>
            <button onClick={logout} title="Déconnexion"
              className="flex items-center justify-center rounded-lg transition"
              style={{ width: 28, height: 28, color: "#4A7FA5", border: "1px solid transparent" }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "#0D1F35"; e.currentTarget.style.color = "#E84C4C"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#4A7FA5"; }}>
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="hidden md:flex flex-1 flex-col ml-[240px]">
        <header className="sticky top-0 flex items-center justify-between px-6 z-30"
          style={{ height: 64, background: "#060D1A", borderBottom: "1px solid #0A1E35" }}>
          <h1 style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 18, color: "var(--pp-text-primary)" }}>{title}</h1>
          <div className="flex items-center gap-4">
            <button onClick={() => setPaletteOpen(true)}
              className="flex items-center gap-2 px-3 h-8 rounded-lg text-xs transition"
              style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border)", color: "var(--pp-text-muted)", minWidth: 220 }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = "var(--pp-brand-accent)")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "var(--pp-bg-border)")}>
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Rechercher…</span>
              <kbd className="font-mono text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--pp-bg-deep)", border: "1px solid var(--pp-bg-border)" }}>⌘K</kbd>
            </button>
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
      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      <SessionTimeoutModal />
    </div>
  );
}
