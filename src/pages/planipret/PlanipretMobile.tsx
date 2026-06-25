import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { Home, Phone, MessageSquare, Users, Phone as PhoneIcon, X, Delete, Plus, Lock, PhoneOff, Bot, Settings as SettingsIcon } from "lucide-react";
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
import { OnboardingTutorial } from "@/components/planipret/OnboardingTutorial";
import { useAvaNavigation } from "@/hooks/useAvaNavigation";
import AvaVoiceAgent from "@/components/planipret/mobile/AvaVoiceAgent";

const ACCENT = "#2E9BDC";

export type PlanipretMobileContext = { profile: any; reloadProfile: () => Promise<void>; openDialer: (number?: string) => void; openAva: () => void; registerRefresh: (fn: (() => Promise<void> | void) | null) => void };

const TABS = [
  { to: "/mplanipret/home", label: "Accueil", Icon: Home },
  { to: "/mplanipret/calls", label: "Appels", Icon: Phone },
  { to: "_fab", label: "", Icon: Bot },
  { to: "/mplanipret/messages", label: "Messages", Icon: MessageSquare },
  { to: "/mplanipret/contacts", label: "Contacts", Icon: Users },
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
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (open) setNumber(initial ?? ""); }, [open, initial]);
  const append = (c: string) => setNumber((n) => (n + c).slice(0, 20));
  const back = () => setNumber((n) => n.slice(0, -1));
  const startHold = () => {
    if (holdTimer.current) clearTimeout(holdTimer.current);
    holdTimer.current = setTimeout(() => { setNumber(""); holdTimer.current = null; }, 1000);
  };
  const endHold = () => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; back(); } };
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
        <motion.div className="absolute inset-x-0 bottom-0 z-30 flex flex-col"
          style={{
            height: "85%",
            background: "var(--pp-bg-surface)",
            border: "1px solid var(--pp-bg-border-2)",
            borderRadius: "24px 24px 0 0",
            boxShadow: "0 -8px 32px rgba(0,0,0,0.5)",
          }}
          initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }} transition={{ type: "spring", damping: 28, stiffness: 280 }}>
          <div className="pt-3 pb-2 flex flex-col items-center relative">
            <div style={{ width: 36, height: 4, background: "var(--pp-bg-border-2)", borderRadius: 2 }} />
            <button onClick={onClose} className="absolute right-3 top-3 p-2.5 rounded-full" style={{ color: "var(--pp-text-secondary)", minWidth: 44, minHeight: 44 }} aria-label="Fermer"><X className="w-5 h-5 mx-auto" /></button>
          </div>
          <div className="flex-1 flex flex-col px-6 pt-4 overflow-hidden">
            <div className="text-center min-h-[56px] flex items-center justify-center px-5 py-5">
              <span style={{
                fontFamily: "Inter, sans-serif",
                fontWeight: 300,
                fontSize: number ? 32 : 16,
                color: number ? "var(--pp-text-primary)" : "var(--pp-text-faint)",
                letterSpacing: "-0.01em",
              }}>
                {number || "Entrer un numéro…"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-2 mx-auto" style={{ maxWidth: 288 }}>
              {KEYS.map((k) => (
                <button key={k.d} onClick={() => append(k.d)}
                  className="flex flex-col items-center justify-center transition active:scale-[0.92] pp-keypad-btn"
                  style={{
                    width: 72, height: 72, borderRadius: "50%",
                    background: "var(--pp-bg-elevated)",
                    border: "1px solid var(--pp-bg-border-2)",
                  }}>
                  <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 600, fontSize: 26, color: "var(--pp-text-primary)", lineHeight: 1 }}>{k.d}</span>
                  {k.l && <span style={{ fontFamily: "DM Sans, sans-serif", fontSize: 9, color: "var(--pp-text-muted)", marginTop: 3, letterSpacing: "0.05em" }}>{k.l}</span>}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 items-center gap-3 mt-5 mx-auto" style={{ maxWidth: 288 }}>
              <button onClick={() => append("+")} className="mx-auto flex items-center justify-center active:scale-95 transition"
                style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-muted)" }} aria-label="Plus">
                <Plus className="w-5 h-5" />
              </button>
              <button onClick={startCall} disabled={!number || calling}
                className="mx-auto flex items-center justify-center text-white disabled:opacity-50 active:scale-95 transition"
                style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #0D5C2A, #00D4AA)", boxShadow: "0 4px 20px rgba(0,212,170,0.5)" }} aria-label="Appeler">
                <PhoneIcon className="w-7 h-7" />
              </button>
              <button
                onPointerDown={startHold}
                onPointerUp={endHold}
                onPointerLeave={() => { if (holdTimer.current) { clearTimeout(holdTimer.current); holdTimer.current = null; } }}
                onContextMenu={(e) => { e.preventDefault(); setNumber(""); }}
                className="mx-auto flex items-center justify-center active:scale-95 transition"
                style={{ width: 48, height: 48, borderRadius: "50%", background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-muted)" }} aria-label="Effacer (hold 1s pour tout effacer)">
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
  const [avaOpen, setAvaOpen] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const openDialer = (n?: string) => { setDialerInit(n); setDialerOpen(true); };
  const openAva = () => setAvaOpen(true);
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
  useAvaNavigation(profile?.user_id);

  // Detect active outbound/in-progress call → FAB pulses red & hangs up on tap
  useEffect(() => {
    if (!profile?.user_id) return;
    const refreshActive = async () => {
      const { data } = await supabase
        .from("planipret_phone_calls")
        .select("id,status")
        .eq("user_id", profile.user_id)
        .in("status", ["active", "in_progress", "answered", "ringing"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setActiveCallId((data as any)?.id ?? null);
    };
    refreshActive();
    const ch = supabase
      .channel("mplanipret-active-call")
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_phone_calls", filter: `user_id=eq.${profile.user_id}` }, refreshActive)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [profile?.user_id]);

  const hangupActive = async () => {
    if (!activeCallId) return;
    const { error } = await supabase.functions.invoke("ns-calls", { body: { action: "hangup", call_id: activeCallId } });
    if (error) toast.error("Échec raccrocher"); else toast.success("Appel raccroché");
  };

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
    if (!user) { navigate("/planipret/login?redirect=/mplanipret", { replace: true }); return; }
    const { data } = await supabase.from("planipret_profiles").select("*").eq("user_id", user.id).maybeSingle();
    if (!data) { navigate("/planipret/login?redirect=/mplanipret", { replace: true }); return; }
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
        <div ref={scrollRef} className="flex-1 overflow-y-auto pb-[110px]">
          <PullIndicator pullDist={pullDist} refreshing={refreshing} threshold={threshold} color={ACCENT} />
          <Outlet context={{ profile, reloadProfile: loadProfile, openDialer, openAva, registerRefresh } satisfies PlanipretMobileContext} />
        </div>
        <SessionTimeoutModal />
        {profile && <PrivacyConsentGate profile={profile} onAccepted={loadProfile} />}
        {profile && profile.consent_accepted_at && !profile.onboarding_completed && (
          <OnboardingTutorial profile={profile} onDone={loadProfile} />
        )}

        {/* AVA Voice floating button (gated by voice_agent_enabled) */}
        {profile?.voice_agent_enabled && (
          <button onClick={openAva}
            className="absolute z-20 rounded-full flex items-center justify-center text-white active:scale-95 transition"
            style={{
              right: 16, bottom: 152,
              width: 52, height: 52,
              background: "linear-gradient(135deg, #2D1A5A, #9B7FE8)",
              boxShadow: "0 4px 20px rgba(155,127,232,0.5)",
              animation: "pp-glow-purple 2s ease-in-out infinite",
            }}
            aria-label="Parler à AVA">
            <Bot className="w-6 h-6" />
          </button>
        )}

        {/* Center FAB — bleu (idle) ou rouge pulsant (appel actif) */}
        <button onClick={activeCallId ? hangupActive : () => setDialerOpen(true)}
          className="absolute left-1/2 -translate-x-1/2 z-20 rounded-full flex items-center justify-center text-white active:scale-95 transition"
          style={{
            background: activeCallId
              ? "linear-gradient(135deg, #5A1010, #E84C4C)"
              : "linear-gradient(135deg, #1A4A8A, #2E9BDC)",
            boxShadow: activeCallId
              ? "0 4px 24px rgba(232,76,76,0.6)"
              : "0 4px 24px rgba(46,155,220,0.6)",
            animation: activeCallId ? "pp-pulse-red 1.5s infinite" : undefined,
            width: 58, height: 58, bottom: 76,
          }}
          aria-label={activeCallId ? "Raccrocher" : "Composer un numéro"}>
          {activeCallId ? <PhoneOff className="w-6 h-6" /> : <PhoneIcon className="w-6 h-6" />}
        </button>


        {/* Tab bar (5 tabs + center FAB placeholder = 5 grid columns) */}
        <nav className="absolute bottom-[22px] inset-x-0 grid grid-cols-5 z-10"
          style={{
            height: 70,
            background: "rgba(4,11,22,0.97)",
            backdropFilter: "blur(20px)",
            borderTop: "1px solid var(--pp-bg-border-2)",
          }}>
          {TABS.map((t) => {
            if (t.to === "_fab") return <div key="fab-slot" />;
            const badge = t.to.endsWith("/messages") ? unreadMsg : 0;
            return (
              <NavLink key={t.to} to={t.to}
                className="relative flex flex-col items-center justify-center gap-1 text-[9px] font-semibold pt-1.5"
                style={({ isActive }) => ({ color: isActive ? "var(--pp-brand-accent)" : "var(--pp-text-faint)" })}>
                {({ isActive }) => (
                  <>
                    {isActive && (
                      <span className="absolute top-1 w-1 h-1 rounded-full" style={{ background: "var(--pp-brand-accent)" }} />
                    )}
                    <div className="relative">
                      <t.Icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2.4 : 1.8} />
                      {badge > 0 && (
                        <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full text-white text-[9px] font-bold flex items-center justify-center"
                          style={{ background: "var(--pp-danger)" }}>
                          {badge > 9 ? "9+" : badge}
                        </span>
                      )}
                    </div>
                    <span style={{ letterSpacing: "0.02em" }}>{t.label}</span>
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
        {avaOpen && profile?.user_id && (
          <AvaVoiceAgent userId={profile.user_id} onClose={() => setAvaOpen(false)} />
        )}
        <OfflineBanner />
      </div>
    </Frame>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="planipret-scope min-h-screen w-full flex items-center justify-center md:p-6" style={{ background: "#020610" }}>
      <div className="overflow-hidden w-full md:w-[390px] md:h-[844px] h-screen md:rounded-[44px] relative"
        style={{
          background: "#060D1A",
          border: "2px solid #1A3A5A",
          boxShadow: "0 0 0 8px #040B16, 0 40px 120px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)",
        }}>
        {children}
      </div>
    </div>
  );
}

