import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneMissed, MessageSquare, Voicemail, ArrowDownLeft, ArrowUpRight, X, Calendar, Headphones, Bot } from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";
import { toast } from "sonner";
import VoiceAgent from "@/components/VoiceAgent";

const PRIMARY = "#1F4E79";
const SUCCESS = "#27AE60";
const DANGER = "#E74C3C";
const ACCENT = "#2E86C1";

function Shimmer({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-slate-200 rounded ${className}`} />;
}

export default function MHome() {
  const { profile, registerRefresh } = useOutletContext<PlanipretMobileContext>();
  const [stats, setStats] = useState({ calls: 0, missed: 0, sms: 0, voicemails: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [events, setEvents] = useState<any[] | null>(null);
  const [eventsState, setEventsState] = useState<"loading" | "ready" | "no_m365" | "error">("loading");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sipOnline, setSipOnline] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  const openAgent = async () => {
    try {
      const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (p.state === "denied") { toast.error("🎙️ Accès au microphone refusé. Autorisez-le dans votre navigateur."); return; }
    } catch { /* ignore */ }
    setAgentOpen(true);
  };

  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const loadStats = async () => {
    if (!profile) return;
    setStatsLoading(true);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();

    const [callsRes, missedRes, smsRes, vmRes, recentRes] = await Promise.all([
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).gte("started_at", startIso),
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("direction", "missed").gte("started_at", startIso),
      supabase.from("planipret_phone_messages").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).is("read_at", null).eq("direction", "inbound"),
      supabase.from("planipret_voicemails").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("is_read", false).eq("folder", "inbox"),
      supabase.from("planipret_phone_calls").select("id, direction, from_number, from_name, to_number, to_name, started_at").eq("user_id", profile.user_id).order("started_at", { ascending: false }).limit(3),
    ]);

    setStats({
      calls: callsRes.count ?? 0,
      missed: missedRes.count ?? 0,
      sms: smsRes.count ?? 0,
      voicemails: vmRes.count ?? 0,
    });
    setRecent(recentRes.data ?? []);
    setSipOnline(!!profile.ns_jwt && (!profile.ns_jwt_expires_at || new Date(profile.ns_jwt_expires_at) > new Date()));
    setStatsLoading(false);
  };

  const loadEvents = async () => {
    if (!profile) return;
    if (!profile.ms365_access_token) { setEventsState("no_m365"); return; }
    setEventsState("loading");
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const end = new Date(today); end.setHours(23, 59, 59, 999);
    const { data, error } = await supabase.functions.invoke("ms365-actions", {
      body: { action: "list_calendar_events", payload: { start: today.toISOString(), end: end.toISOString() } },
    });
    if (error || !(data as any)?.success) { setEventsState("error"); return; }
    setEvents(((data as any).events ?? []).slice(0, 2));
    setEventsState("ready");
  };

  useEffect(() => { loadStats(); loadEvents(); /* eslint-disable-next-line */ }, [profile?.user_id]);
  useEffect(() => {
    registerRefresh(async () => { await Promise.all([loadStats(), loadEvents()]); });
    return () => registerRefresh(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.user_id]);


  const playBrief = async () => {
    setBriefLoading(true);
    const { data, error } = await supabase.functions.invoke("ai-daily-brief", { body: {} });
    setBriefLoading(false);
    if (error || !(data as any)?.success) { toast.error("Impossible de générer le brief"); return; }
    setBrief((data as any).briefing_text);
  };

  const reconnect = async () => { await supabase.functions.invoke("ns-auth"); loadStats(); };

  return (
    <div className="p-4 space-y-4">
      <header className="flex items-start justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#1A1A2E" }}>Bonjour, {profile?.full_name ?? "Courtier"}</h1>
          <p className="text-xs text-slate-500 mt-0.5 capitalize">{dateLabel}</p>
        </div>
        <button onClick={reconnect} className="flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-white border border-slate-200">
          <span className="w-2 h-2 rounded-full" style={{ background: sipOnline ? SUCCESS : DANGER }} />
          <span style={{ color: sipOnline ? SUCCESS : DANGER }}>{sipOnline ? "En ligne" : "Hors ligne"}</span>
        </button>
      </header>

      {/* Card 1: stats */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: PRIMARY }}>Résumé du jour</h2>
        <div className="grid grid-cols-2 gap-3">
          {statsLoading ? (
            <>{[0,1,2,3].map((i) => <Shimmer key={i} className="h-20" />)}</>
          ) : (
            <>
              <Stat icon={<Phone className="w-4 h-4" />} value={stats.calls} label="Appels aujourd'hui" color={PRIMARY} />
              <Stat icon={<PhoneMissed className="w-4 h-4" />} value={stats.missed} label="Appels manqués" color={DANGER} badge />
              <Stat icon={<MessageSquare className="w-4 h-4" />} value={stats.sms} label="SMS non lus" color={ACCENT} />
              <Stat icon={<Voicemail className="w-4 h-4" />} value={stats.voicemails} label="Voicemails non écoutés" color={PRIMARY} />
            </>
          )}
        </div>
      </section>

      {/* Brief IA */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold" style={{ color: PRIMARY }}>Brief IA du jour</h2>
          <button onClick={playBrief} disabled={briefLoading}
            className="text-xs px-3 py-1.5 rounded-full text-white flex items-center gap-1.5 disabled:opacity-50"
            style={{ background: PRIMARY }}>
            <Headphones className="w-3.5 h-3.5" /> {briefLoading ? "..." : "Écouter mon brief"}
          </button>
        </div>
        {briefLoading ? (
          <div className="space-y-2">
            <Shimmer className="h-3 w-3/4" />
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-2/3" />
          </div>
        ) : brief ? (
          <p className="text-sm text-slate-700 whitespace-pre-line">{brief}</p>
        ) : (
          <p className="text-xs text-slate-400">Touchez « Écouter mon brief » pour générer votre résumé.</p>
        )}
      </section>

      {/* Prochains RDV */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: PRIMARY }}>
          <Calendar className="w-4 h-4" /> Prochains rendez-vous
        </h2>
        {eventsState === "loading" && (
          <div className="space-y-2"><Shimmer className="h-10" /><Shimmer className="h-10" /></div>
        )}
        {eventsState === "no_m365" && (
          <div className="text-center py-3">
            <p className="text-xs text-slate-500 mb-2">Connectez Microsoft 365 pour voir vos RDV</p>
            <a href="/mplanipret/more" className="inline-block text-xs px-3 py-1.5 rounded-full text-white" style={{ background: PRIMARY }}>Connecter</a>
          </div>
        )}
        {eventsState === "error" && (
          <div className="text-center py-3">
            <p className="text-xs text-slate-500 mb-2">Impossible de charger les RDV</p>
            <button onClick={loadEvents} className="text-xs px-3 py-1.5 rounded-full border border-slate-300">Réessayer</button>
          </div>
        )}
        {eventsState === "ready" && (events?.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-2">Aucun rendez-vous aujourd'hui 🎉</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {events!.map((e, i) => {
              const t = e.start?.dateTime ? new Date(e.start.dateTime + (e.start.timeZone === "UTC" ? "Z" : "")) : null;
              return (
                <li key={i} className="py-2 flex items-center gap-2">
                  <span className="text-xs font-semibold tabular-nums" style={{ color: PRIMARY }}>
                    {t ? t.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                  </span>
                  <span className="text-sm text-slate-700 truncate">{e.subject ?? "(Sans titre)"}</span>
                </li>
              );
            })}
          </ul>
        ))}
      </section>

      {/* Card: recent calls */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: PRIMARY }}>Appels récents</h2>
        {statsLoading ? (
          <div className="space-y-2">{[0,1,2].map((i) => <Shimmer key={i} className="h-10" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-sm text-slate-400 py-4 text-center">Aucun appel</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {recent.map((c) => {
              const inbound = c.direction === "inbound";
              const missed = c.direction === "missed";
              const Icon = missed ? X : inbound ? ArrowDownLeft : ArrowUpRight;
              const color = missed ? DANGER : inbound ? ACCENT : SUCCESS;
              const name = inbound || missed ? (c.from_name || c.from_number) : (c.to_name || c.to_number);
              return (
                <li key={c.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: `${color}15`, color }}>
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "#1A1A2E" }}>{name ?? "Inconnu"}</p>
                    <p className="text-[11px] text-slate-400">{c.started_at ? new Date(c.started_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {profile?.voice_agent_enabled && (
        <button onClick={openAgent} aria-label="Parler à AVA"
          className={`fixed right-4 z-30 w-[52px] h-[52px] rounded-full flex items-center justify-center text-white shadow-xl active:scale-95 transition ${agentOpen ? "ring-4 ring-emerald-400/60 animate-pulse" : ""}`}
          style={{ background: "linear-gradient(135deg, #6C3CE1, #8B5CF6)", bottom: "calc(94px + 60px + 24px)" }}>
          <Bot className="w-6 h-6" />
        </button>
      )}

      {agentOpen && <VoiceAgent onClose={() => setAgentOpen(false)} />}
    </div>
  );
}

function Stat({ icon, value, label, color, badge }: { icon: React.ReactNode; value: number; label: string; color: string; badge?: boolean }) {
  return (
    <div className="rounded-xl p-3" style={{ background: "#F8F9FA" }}>
      <div className="flex items-center justify-between mb-1">
        <span style={{ color }}>{icon}</span>
        {badge && value > 0 && <span className="text-[10px] font-bold text-white rounded-full px-1.5 py-0.5" style={{ background: DANGER }}>!</span>}
      </div>
      <div className="text-2xl font-bold" style={{ color: "#1A1A2E" }}>{value}</div>
      <div className="text-[10px] text-slate-500 leading-tight mt-0.5">{label}</div>
    </div>
  );
}
