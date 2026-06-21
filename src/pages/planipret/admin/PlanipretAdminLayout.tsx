import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { LayoutDashboard, Users, Phone, MessageSquare, Voicemail, Plug, BarChart3, LogOut, Bell, Menu, X } from "lucide-react";

const NAVY = "#0F1924";
const ACCENT = "#2E86C1";
const PRIMARY = "#1F4E79";

const LINKS = [
  { to: "/dashboard/overview", label: "Vue d'ensemble", Icon: LayoutDashboard },
  { to: "/dashboard/users", label: "Utilisateurs", Icon: Users },
  { to: "/dashboard/calls", label: "Appels", Icon: Phone },
  { to: "/dashboard/messages", label: "Messages", Icon: MessageSquare },
  { to: "/dashboard/voicemails", label: "Voicemails", Icon: Voicemail },
  { to: "/dashboard/integrations", label: "Intégrations", Icon: Plug },
  { to: "/dashboard/reports", label: "Rapports", Icon: BarChart3 },
];

const PAGE_TITLES: Record<string, string> = {
  "/dashboard/overview": "Vue d'ensemble",
  "/dashboard/users": "Gestion des utilisateurs",
  "/dashboard/calls": "Appels",
  "/dashboard/messages": "Messages",
  "/dashboard/voicemails": "Voicemails",
  "/dashboard/integrations": "Intégrations",
  "/dashboard/reports": "Rapports",
};

const initials = (n?: string) => (n ?? "A").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "A";

export default function PlanipretAdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [missingIntegrations, setMissingIntegrations] = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [realtimeOk, setRealtimeOk] = useState(false);

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

  useEffect(() => {
    const ch = supabase.channel("admin-presence").subscribe((s) => setRealtimeOk(s === "SUBSCRIBED"));
    return () => { supabase.removeChannel(ch); };
  }, []);

  const logout = async () => { await supabase.auth.signOut(); navigate("/login", { replace: true }); };

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500">Chargement…</div>;

  const title = PAGE_TITLES[location.pathname] ?? "Tableau de bord";
  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div className="min-h-screen flex" style={{ background: "#F8F9FA" }}>
      {/* Mobile redirect notice */}
      <div className="md:hidden fixed inset-0 z-50 flex items-center justify-center p-6 bg-white">
        <div className="text-center max-w-xs">
          <h2 className="font-semibold text-lg mb-2">Dashboard admin</h2>
          <p className="text-sm text-slate-600 mb-4">Le dashboard admin est optimisé pour desktop. Sur mobile, utilisez l'application courtier.</p>
          <button onClick={() => navigate("/mplanipret")} className="px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: PRIMARY }}>
            Ouvrir l'app mobile
          </button>
        </div>
      </div>

      {/* Sidebar */}
      <aside className={`hidden md:flex flex-col fixed left-0 top-0 h-screen w-[260px] text-white z-40`} style={{ background: NAVY }}>
        <div className="px-5 pt-5 pb-4 border-b border-white/10">
          <div className="font-bold text-[18px] tracking-tight">PLANIPRÊT</div>
          <div className="text-[14px]" style={{ color: ACCENT }}>AI Portal</div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {LINKS.map(({ to, label, Icon }) => (
            <NavLink key={to} to={to}
              className={({ isActive }) => `flex items-center gap-3 px-3 h-11 rounded-lg text-sm transition ${isActive ? "text-white" : "text-slate-400 hover:bg-white/5"}`}
              style={({ isActive }) => isActive ? { background: PRIMARY } : undefined}>
              <Icon className="w-4 h-4" />
              <span className="flex-1">{label}</span>
              {to === "/dashboard/integrations" && missingIntegrations > 0 && (
                <span className="text-[10px] font-bold bg-amber-500 text-white rounded-full px-1.5 py-0.5">{missingIntegrations}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 mb-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ background: PRIMARY }}>
              {initials(profile?.full_name)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{profile?.full_name ?? "Admin"}</p>
              <p className="text-[11px] text-slate-400">Super Admin</p>
            </div>
          </div>
          <button onClick={logout} className="w-full flex items-center gap-2 px-3 h-9 rounded-lg text-sm text-slate-300 hover:bg-white/5">
            <LogOut className="w-4 h-4" /> Déconnexion
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="hidden md:flex flex-1 flex-col ml-[260px]">
        <header className="sticky top-0 h-14 bg-white border-b border-slate-100 flex items-center justify-between px-6 z-30">
          <h1 className="font-bold text-[20px]" style={{ color: "#0F1924" }}>{title}</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`w-2 h-2 rounded-full ${realtimeOk ? "bg-green-500" : "bg-slate-300"}`} />
              <span className="text-slate-500">{realtimeOk ? "En direct" : "Reconnexion..."}</span>
            </div>
            <button className="relative w-9 h-9 rounded-full hover:bg-slate-100 flex items-center justify-center">
              <Bell className="w-4 h-4 text-slate-600" />
            </button>
            <span className="text-xs text-slate-500 capitalize">{dateLabel}</span>
          </div>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">
          <Outlet context={{ profile }} />
        </main>
      </div>
    </div>
  );
}
