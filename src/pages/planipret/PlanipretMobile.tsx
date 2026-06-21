import { useEffect, useState } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Home, Phone, MessageSquare, Voicemail, MoreHorizontal, Phone as PhoneIcon, X, Delete, Plus, Lock } from "lucide-react";
import { toast } from "sonner";

const PRIMARY = "#1F4E79";
const ACCENT = "#2E86C1";
const SUCCESS = "#27AE60";
const DANGER = "#E74C3C";
const BG = "#F8F9FA";

export type PlanipretMobileContext = { profile: any; reloadProfile: () => Promise<void>; openDialer: (number?: string) => void };

const TABS = [
  { to: "/mplanipret/home", label: "Accueil", Icon: Home },
  { to: "/mplanipret/calls", label: "Appels", Icon: Phone },
  { to: "/mplanipret/messages", label: "Messages", Icon: MessageSquare },
  { to: "/mplanipret/voicemail", label: "Boîte voc.", Icon: Voicemail },
  { to: "/mplanipret/more", label: "Plus", Icon: MoreHorizontal },
];

const KEYS: Array<{ d: string; l?: string }> = [
  { d: "1", l: "" }, { d: "2", l: "ABC" }, { d: "3", l: "DEF" },
  { d: "4", l: "GHI" }, { d: "5", l: "JKL" }, { d: "6", l: "MNO" },
  { d: "7", l: "PQRS" }, { d: "8", l: "TUV" }, { d: "9", l: "WXYZ" },
  { d: "*" }, { d: "0", l: "+" }, { d: "#" },
];

function Dialer({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: string }) {
  const [number, setNumber] = useState("");
  const [calling, setCalling] = useState(false);
  useEffect(() => { if (open) setNumber(initial ?? ""); }, [open, initial]);
  const append = (c: string) => setNumber((n) => (n + c).slice(0, 20));
  const back = () => setNumber((n) => n.slice(0, -1));
  const startCall = async () => {
    if (!number) return;
    setCalling(true);
    const { data, error } = await supabase.functions.invoke("ns-calls", { body: { action: "start", destination: number } });
    setCalling(false);
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec de l'appel");
      return;
    }
    toast.success("Appel lancé");
    setNumber("");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="absolute inset-0 z-30 flex flex-col" style={{ background: "white" }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
          <div className="pt-3 pb-2 flex flex-col items-center relative">
            <div className="w-10 h-1.5 rounded-full bg-slate-300" />
            <button onClick={onClose} className="absolute right-3 top-3 p-1.5 rounded-full hover:bg-slate-100"><X className="w-5 h-5 text-slate-600" /></button>
          </div>
          <div className="flex-1 flex flex-col px-6 pt-4">
            <div className="text-center min-h-[60px] flex items-center justify-center">
              <span className={`font-light tracking-wide ${number ? "text-4xl text-slate-900" : "text-lg text-slate-400"}`}>
                {number || "Entrer un numéro..."}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6 mx-auto" style={{ maxWidth: 280 }}>
              {KEYS.map((k) => (
                <button key={k.d} onClick={() => append(k.d)}
                  className="w-20 h-20 rounded-full bg-slate-100 active:bg-slate-200 flex flex-col items-center justify-center transition">
                  <span className="text-3xl font-light text-slate-900 leading-none">{k.d}</span>
                  {k.l && <span className="text-[10px] tracking-widest text-slate-500 mt-0.5">{k.l}</span>}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 items-center gap-3 mt-6 mx-auto" style={{ maxWidth: 280 }}>
              <button onClick={() => append("+")} className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-700">
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={startCall} disabled={!number || calling}
                className="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-white shadow-lg disabled:opacity-50"
                style={{ background: SUCCESS }}>
                <PhoneIcon className="w-7 h-7" />
              </button>
              <button onClick={back} onContextMenu={(e) => { e.preventDefault(); setNumber(""); }}
                className="w-16 h-16 rounded-full bg-slate-100 mx-auto flex items-center justify-center text-slate-700">
                <Delete className="w-5 h-5" />
              </button>
            </div>
            {calling && <div className="mt-4 text-center text-sm text-slate-500">Appel en cours…</div>}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function PlanipretMobile() {
  const navigate = useNavigate();
  const location = useLocation();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dialerOpen, setDialerOpen] = useState(false);
  const [dialerInit, setDialerInit] = useState<string | undefined>(undefined);
  const openDialer = (n?: string) => { setDialerInit(n); setDialerOpen(true); };

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { navigate("/planipret/login", { replace: true }); return; }
    const { data } = await supabase.from("planipret_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) { navigate("/planipret/login", { replace: true }); return; }
    setProfile(data);
    setLoading(false);
  };

  useEffect(() => {
    loadProfile();
    // Redirect /mplanipret → /mplanipret/home
    if (location.pathname === "/mplanipret") navigate("/mplanipret/home", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-500" style={{ background: "#e5e7eb" }}>Chargement…</div>;

  // Access disabled screen
  if (profile && profile.mobile_app_enabled === false) {
    return (
      <Frame>
        <div className="h-full flex items-center justify-center p-6" style={{ background: BG }}>
          <div className="bg-white rounded-2xl p-6 text-center shadow-md max-w-xs">
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: `${PRIMARY}15`, color: PRIMARY }}>
              <Lock className="w-7 h-7" />
            </div>
            <h2 className="font-semibold text-lg mb-2" style={{ color: "#1A1A2E" }}>Application non activée</h2>
            <p className="text-sm text-slate-600 mb-4">Votre accès à l'application mobile n'a pas encore été activé. Contactez votre administrateur Planiprêt.</p>
            <a href="mailto:support@avastatistic.ca" className="inline-block px-4 py-2 rounded-lg text-white text-sm font-medium" style={{ background: PRIMARY }}>
              Contacter le support
            </a>
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="h-full flex flex-col relative overflow-hidden" style={{ background: BG }}>
        <div className="flex-1 overflow-y-auto pb-24">
          <Outlet context={{ profile, reloadProfile: loadProfile } satisfies PlanipretMobileContext} />
        </div>

        {/* FAB */}
        <button onClick={() => setDialerOpen(true)}
          className="absolute left-1/2 -translate-x-1/2 z-20 rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition"
          style={{ background: PRIMARY, width: 60, height: 60, bottom: 50 }} aria-label="Composer un numéro">
          <PhoneIcon className="w-6 h-6" />
        </button>

        {/* Tab bar */}
        <nav className="absolute bottom-0 inset-x-0 h-[72px] bg-white border-t border-slate-200 grid grid-cols-5 z-10">
          {TABS.map((t, i) => (
            <NavLink key={t.to} to={t.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${i === 2 ? "invisible" : ""} ${isActive ? "" : "text-slate-400"}`
              }
              style={({ isActive }) => isActive ? { color: PRIMARY } : undefined}>
              {({ isActive }) => (
                <>
                  <t.Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} fill={isActive ? "currentColor" : "none"} fillOpacity={isActive ? 0.15 : 0} />
                  <span>{t.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <Dialer open={dialerOpen} onClose={() => setDialerOpen(false)} />
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-200 md:p-6">
      <div className="bg-white shadow-2xl overflow-hidden w-full md:w-[390px] md:h-[844px] h-screen md:rounded-[40px]">
        {children}
      </div>
    </div>
  );
}
