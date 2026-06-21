import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Home, Phone, MessageSquare, Voicemail, MoreHorizontal, Phone as PhoneIcon, X, Delete, Plus, Lock } from "lucide-react";
import { toast } from "sonner";
import planipretLogo from "@/assets/planipret-logo.png.asset.json";
import avaWordmark from "@/assets/ava-wordmark.svg";
import { usePullToRefresh, PullIndicator } from "@/hooks/usePullToRefresh";
import { useRealtimeManager } from "@/hooks/useRealtimeManager";
import InboundCallOverlay, { type InboundCall } from "@/components/InboundCallOverlay";
import { OfflineBanner } from "@/components/PlanipretErrorBoundary";
import SessionTimeoutModal from "@/components/planipret/SessionTimeoutModal";
import PrivacyConsentGate from "@/components/planipret/PrivacyConsentGate";
import UniversalSearchBar from "@/components/planipret/UniversalSearchBar";

const ACCENT = "#2E9BDC";

export type PlanipretMobileContext = { profile: any; reloadProfile: () => Promise<void>; openDialer: (number?: string) => void; registerRefresh: (fn: (() => Promise<void> | void) | null) => void };

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
        <motion.div className="absolute inset-0 z-30 flex flex-col"
          style={{ background: "var(--pp-bg-surface)", borderTop: "1px solid var(--pp-bg-border-2)", borderRadius: "24px 24px 0 0" }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
          <div className="pt-3 pb-2 flex flex-col items-center relative">
            <div style={{ width: 36, height: 4, background: "var(--pp-bg-border-2)", borderRadius: 2 }} />
            <button onClick={onClose} className="absolute right-3 top-3 p-1.5 rounded-full" style={{ color: "var(--pp-text-secondary)" }}><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 flex flex-col px-6 pt-4">
            <div className="text-center min-h-[60px] flex items-center justify-center">
              <span style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 600,
                fontSize: number ? 34 : 16,
                color: number ? "var(--pp-text-primary)" : "var(--pp-text-faint)",
                letterSpacing: "-0.01em",
              }}>
                {number || "Entrer un numéro…"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-6 mx-auto" style={{ maxWidth: 280 }}>
              {KEYS.map((k) => (
                <button key={k.d} onClick={() => append(k.d)}
                  className="flex flex-col items-center justify-center transition active:scale-95"
                  style={{
                    width: 64, height: 64, borderRadius: "50%",
                    background: "var(--pp-bg-elevated)",
                    border: "1px solid var(--pp-bg-border-2)",
                  }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 22, color: "var(--pp-text-primary)", lineHeight: 1 }}>{k.d}</span>
                  {k.l && <span style={{ fontSize: 9, color: "var(--pp-text-muted)", marginTop: 2, letterSpacing: "0.05em" }}>{k.l}</span>}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 items-center gap-3 mt-6 mx-auto" style={{ maxWidth: 280 }}>
              <button onClick={() => append("+")} className="mx-auto flex items-center justify-center"
                style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={startCall} disabled={!number || calling}
                className="mx-auto flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition"
                style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #0D5C2A, #00D4AA)", boxShadow: "0 4px 20px rgba(0,212,170,0.4)" }}>
                <PhoneIcon className="w-7 h-7" />
              </button>
              <button onClick={back} onContextMenu={(e) => { e.preventDefault(); setNumber(""); }}
                className="mx-auto flex items-center justify-center"
                style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                <Delete className="w-5 h-5" />
              </button>
            </div>
            {calling && <div className="mt-4 text-center text-sm" style={{ color: "var(--pp-text-muted)" }}>Appel en cours…</div>}
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
  const [unreadMsg, setUnreadMsg] = useState(0);
  const [unreadVm, setUnreadVm] = useState(0);
  const [inbound, setInbound] = useState<InboundCall>(null);
  const openDialer = (n?: string) => { setDialerInit(n); setDialerOpen(true); };
  const refreshFn = useRef<(() => Promise<void> | void) | null>(null);
  const registerRefresh = (fn: (() => Promise<void> | void) | null) => { refreshFn.current = fn; };
  const handlePull = async () => { if (refreshFn.current) await refreshFn.current(); };
  const { ref: scrollRef, pullDist, refreshing, threshold } = usePullToRefresh(handlePull);

  const onInboundRinging = useCallback((row: any) => {
    setInbound({ call_id: row.id, from_number: row.from_number, caller_name: row.caller_name });
  }, []);
  const onAiInsight = useCallback((row: any) => {
    toast(`🤖 Analyse IA disponible`, {
      description: String(row.ai_summary ?? "").slice(0, 80),
      duration: 8000,
      action: { label: "Voir", onClick: () => navigate(`/mplanipret/calls?call=${row.id}`) },
    });
  }, [navigate]);
  useRealtimeManager(profile?.user_id, { onInboundRinging, onAiInsight });

  useEffect(() => {
    if (!profile?.user_id) return;
    const refreshCounts = async () => {
      const [{ count: mc }, { count: vc }] = await Promise.all([
        supabase.from("planipret_phone_messages").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("direction", "inbound").is("read_at", null),
        supabase.from("planipret_voicemails").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("folder", "inbox").eq("is_read", false),
      ]);
      setUnreadMsg(mc ?? 0); setUnreadVm(vc ?? 0);
    };
    refreshCounts();
    const ch = supabase
      .channel("mplanipret-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_phone_messages", filter: `user_id=eq.${profile.user_id}` }, refreshCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_voicemails", filter: `user_id=eq.${profile.user_id}` }, refreshCounts)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id, location.pathname]);

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
    if (location.pathname === "/mplanipret") navigate("/mplanipret/home", { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: "#030810", color: "var(--pp-text-muted, #4A7FA5)" }}>Chargement…</div>;

  if (profile && profile.mobile_app_enabled === false) {
    return (
      <Frame>
        <div className="h-full flex items-center justify-center p-6" style={{ background: "var(--pp-bg-base)" }}>
          <div className="pp-card p-6 text-center max-w-xs" style={{ padding: 24 }}>
            <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-4" style={{ background: "rgba(46,155,220,0.12)", color: "var(--pp-brand-accent)" }}>
              <Lock className="w-7 h-7" />
            </div>
            <h2 style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 18, color: "var(--pp-text-primary)", marginBottom: 8 }}>Application non activée</h2>
            <p style={{ fontSize: 13, color: "var(--pp-text-secondary)", marginBottom: 16 }}>Votre accès à l'application mobile n'a pas encore été activé. Contactez votre administrateur Planiprêt.</p>
            <a href="mailto:support@avastatistic.ca" className="pp-btn-primary inline-block">Contacter le support</a>
          </div>
        </div>
      </Frame>
    );
  }

  return (
    <Frame>
      <div className="h-full flex flex-col relative overflow-hidden" style={{ background: "var(--pp-bg-base)" }}>
        {/* Top brand header */}
        <header className="flex items-center gap-2 px-4 pt-3 pb-2"
          style={{ background: "linear-gradient(180deg, #0A1628 0%, #060D1A 100%)", borderBottom: "1px solid var(--pp-bg-border)" }}>
          <img src={planipretLogo.url} alt="Planiprêt" className="w-8 h-8 rounded-lg object-cover" />
          <span style={{ fontFamily: "Inter,sans-serif", fontWeight: 700, fontSize: 14, color: "var(--pp-text-primary)", letterSpacing: "-0.01em" }}>Planiprêt</span>
          <span className="ml-auto flex items-center gap-1.5">
            <span className="pp-live-dot" />
            <span style={{ fontSize: 10, color: "var(--pp-success)", fontWeight: 600 }}>SIP</span>
          </span>
        </header>

        <UniversalSearchBar />
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-[96px]">
          <PullIndicator pullDist={pullDist} refreshing={refreshing} threshold={threshold} color={ACCENT} />
          <Outlet context={{ profile, reloadProfile: loadProfile, openDialer, registerRefresh } satisfies PlanipretMobileContext} />
        </div>
        <SessionTimeoutModal />
        {profile && <PrivacyConsentGate profile={profile} onAccepted={loadProfile} />}

        {/* FAB */}
        <button onClick={() => setDialerOpen(true)}
          className="absolute left-1/2 -translate-x-1/2 z-20 rounded-full flex items-center justify-center text-white active:scale-95 transition"
          style={{
            background: "linear-gradient(135deg, #1A4A8A, #2E9BDC)",
            boxShadow: "0 4px 24px rgba(46,155,220,0.5)",
            width: 52, height: 52, bottom: 78,
          }}
          aria-label="Composer un numéro">
          <PhoneIcon className="w-6 h-6" />
        </button>

        {/* Tab bar */}
        <nav className="absolute bottom-[22px] inset-x-0 grid grid-cols-5 z-10"
          style={{
            height: 64,
            background: "rgba(6,13,26,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid var(--pp-bg-border)",
          }}>
          {TABS.map((t, i) => {
            const badge = t.to.endsWith("/messages") ? unreadMsg : t.to.endsWith("/voicemail") ? unreadVm : 0;
            return (
              <NavLink key={t.to} to={t.to}
                className={({ isActive }) =>
                  `relative flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${i === 2 ? "invisible" : ""}`
                }
                style={({ isActive }) => ({ color: isActive ? "var(--pp-brand-accent)" : "var(--pp-text-faint)" })}>
                {({ isActive }) => (
                  <>
                    <div className="relative">
                      <t.Icon className="w-5 h-5" strokeWidth={isActive ? 2.5 : 1.8} />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                          style={{ background: "var(--pp-danger)" }}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span>{t.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Powered by AVA footer */}
        <div className="absolute bottom-0 inset-x-0 h-[22px] flex items-center justify-center gap-1.5 z-10"
          style={{ background: "var(--pp-bg-deep)", borderTop: "1px solid var(--pp-bg-border)" }}>
          <span style={{ fontSize: 9, color: "var(--pp-text-faint)", letterSpacing: "0.1em" }}>Powered by</span>
          <img src={avaWordmark} alt="AVA" className="h-2.5 opacity-60" />
        </div>

        <Dialer open={dialerOpen} onClose={() => setDialerOpen(false)} initial={dialerInit} />
        <InboundCallOverlay call={inbound} onClose={() => setInbound(null)} />
        <OfflineBanner />
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="planipret-scope min-h-screen w-full flex items-center justify-center md:p-6" style={{ background: "#030810" }}>
      <div className="overflow-hidden w-full md:w-[390px] md:h-[844px] h-screen md:rounded-[40px]"
        style={{
          background: "var(--pp-bg-base)",
          border: "2px solid var(--pp-bg-border-2)",
          boxShadow: "0 0 0 1px #040B16, 0 40px 100px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.04)",
        }}>
        {children}
      </div>
    </div>
  );
}
