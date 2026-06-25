import { useEffect, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";

import { supabase } from "@/integrations/supabase/client";
import {
  Phone, PhoneMissed, MessageSquare, Voicemail,
  ArrowDownLeft, ArrowUpRight, X, Calendar, Headphones, Bot,
  BellOff, Flame, Sparkles, ChevronRight,
} from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";
import { toast } from "sonner";
import AvaVoiceAgent from "@/components/planipret/mobile/AvaVoiceAgent";
import PWAInstallBanner from "@/components/planipret/PWAInstallBanner";
import { TEMP_EMOJI } from "@/components/planipret/leadHelpers";
import { useMaestroPipelineToasts } from "@/hooks/useMaestroPipelineToasts";

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded ${className}`}
      style={{ background: "var(--pp-bg-elevated)" }}
    />
  );
}

export default function MHome() {
  const { profile, registerRefresh, openDialer, reloadProfile } =
    useOutletContext<PlanipretMobileContext>();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ calls: 0, missed: 0, sms: 0, voicemails: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [events, setEvents] = useState<any[] | null>(null);
  const [eventsState, setEventsState] = useState<"loading" | "ready" | "no_m365" | "error">("loading");
  const [brief, setBrief] = useState<string | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(true);
  const [sipOnline, setSipOnline] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [dueReminders, setDueReminders] = useState<any[]>([]);
  const [maestroCounts, setMaestroCounts] = useState<any | null>(null);

  useMaestroPipelineToasts(profile?.user_id);

  const openAgent = async () => {
    try {
      const p = await navigator.permissions.query({ name: "microphone" as PermissionName });
      if (p.state === "denied") {
        toast.error("🎙️ Accès au microphone refusé. Autorisez-le dans votre navigateur.");
        return;
      }
    } catch { /* ignore */ }
    setAgentOpen(true);
  };

  const dateLabel = new Date().toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long",
  });

  const loadStats = async () => {
    if (!profile) return;
    setStatsLoading(true);
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const startIso = start.toISOString();
    const nowIso = new Date().toISOString();

    const [callsRes, missedRes, smsRes, vmRes, recentRes, hotRes, remRes] = await Promise.all([
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).gte("started_at", startIso),
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("direction", "missed").gte("started_at", startIso),
      supabase.from("planipret_phone_messages").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).is("read_at", null).eq("direction", "inbound"),
      supabase.from("planipret_voicemails").select("id", { count: "exact", head: true }).eq("user_id", profile.user_id).eq("is_read", false).eq("folder", "inbox"),
      supabase.from("planipret_phone_calls").select("id, direction, from_number, from_name, to_number, to_name, started_at, lead_score, lead_temperature").eq("user_id", profile.user_id).order("started_at", { ascending: false }).limit(3),
      supabase.from("planipret_phone_calls").select("id, from_number, from_name, to_number, to_name, lead_score, lead_temperature, started_at, direction").eq("user_id", profile.user_id).gte("started_at", startIso).gte("lead_score", 8).order("lead_score", { ascending: false }).limit(5),
      supabase.from("planipret_reminders").select("*").eq("user_id", profile.user_id).eq("status", "pending").lte("scheduled_at", nowIso).order("scheduled_at", { ascending: true }).limit(10),
    ]);

    setStats({
      calls: callsRes.count ?? 0,
      missed: missedRes.count ?? 0,
      sms: smsRes.count ?? 0,
      voicemails: vmRes.count ?? 0,
    });
    setRecent(recentRes.data ?? []);
    setHotLeads(hotRes.data ?? []);
    setDueReminders(remRes.data ?? []);
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

  const loadMaestroCounts = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("maestro-counts", { body: {} });
      if (error) return;
      setMaestroCounts((data as any)?.counts ?? data ?? null);
    } catch { /* silent */ }
  };

  useEffect(() => { loadStats(); loadEvents(); loadMaestroCounts(); /* eslint-disable-next-line */ }, [profile?.user_id]);
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

  const reconnect = async () => {
    toast.loading("Reconnexion SIP…", { id: "sip-reconnect" });
    await supabase.functions.invoke("ns-auth");
    toast.dismiss("sip-reconnect");
    loadStats();
  };

  const firstName = (profile?.full_name ?? "Courtier").split(" ")[0];

  return (
    <div className="p-4 space-y-4 pb-8" style={{ background: "var(--pp-bg-base)", minHeight: "100%" }}>
      <PWAInstallBanner />

      {/* ===== Header ===== */}
      <header className="flex items-start justify-between pt-2">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.18em]" style={{ color: "var(--pp-text-muted)" }}>
            {dateLabel}
          </p>
          <h1 className="text-2xl font-bold mt-0.5" style={{ color: "var(--pp-text-primary)" }}>
            Bonjour, <span style={{ color: "var(--pp-brand-accent)" }}>{firstName}</span>
          </h1>
        </div>
        <button
          onClick={reconnect}
          className={sipOnline ? "pp-status-ok" : "pp-status-off"}
          style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "6px 10px", borderRadius: 999, fontSize: 11, fontWeight: 600,
          }}
        >
          <span
            style={{
              width: 6, height: 6, borderRadius: 999,
              background: sipOnline ? "var(--pp-success)" : "var(--pp-danger)",
              boxShadow: sipOnline ? "0 0 8px var(--pp-success)" : "0 0 8px var(--pp-danger)",
            }}
          />
          {sipOnline ? "En ligne" : "Hors ligne"}
        </button>
      </header>

      {/* ===== DND BANNER ===== */}
      {profile?.dnd_enabled && (
        <div
          className="rounded-2xl p-3 flex items-center gap-3"
          style={{
            background: "rgba(232,76,76,0.08)",
            border: "1px solid rgba(232,76,76,0.30)",
            backdropFilter: "blur(12px)",
          }}
        >
          <BellOff className="w-5 h-5" style={{ color: "var(--pp-danger)" }} />
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold" style={{ color: "var(--pp-danger)" }}>
              Mode Ne pas déranger actif
            </div>
            <div className="text-[11px]" style={{ color: "var(--pp-text-secondary)" }}>
              AVA répond à vos appels automatiquement
            </div>
          </div>
          <button
            onClick={async () => {
              await supabase.from("planipret_profiles").update({ dnd_enabled: false }).eq("user_id", profile.user_id);
              await reloadProfile();
              toast.success("Mode DND désactivé");
            }}
            className="text-[11px] font-semibold px-2.5 py-1 rounded-md text-white"
            style={{ background: "var(--pp-danger)" }}
          >
            Désactiver
          </button>
        </div>
      )}

      {/* ===== PRIORITY HERO ===== */}
      {(dueReminders.length > 0 || hotLeads.length > 0) && (() => {
        const overdue = dueReminders[0];
        const hot = !overdue ? hotLeads[0] : null;
        const target = overdue ?? hot;
        if (!target) return null;
        const name = overdue ? (overdue.contact_name ?? overdue.contact_number) : (hot.from_name ?? hot.from_number ?? hot.to_number);
        const phone = overdue ? overdue.contact_number : (hot.from_number ?? hot.to_number);
        const reason = overdue
          ? `Rappel en retard${overdue.note ? ` • ${overdue.note}` : ""}`
          : `Lead chaud • Score ${hot.lead_score}/10`;
        return (
          <section
            className="rounded-2xl p-4 relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, rgba(232,76,76,0.18), rgba(232,76,76,0.04))",
              border: "1px solid rgba(232,76,76,0.35)",
              boxShadow: "0 8px 32px rgba(232,76,76,0.18)",
            }}
          >
            <div
              className="absolute -top-10 -right-10 w-32 h-32 rounded-full"
              style={{ background: "rgba(232,76,76,0.25)", filter: "blur(40px)" }}
            />
            <div className="relative">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="w-4 h-4" style={{ color: "var(--pp-danger)" }} />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em]" style={{ color: "var(--pp-danger)" }}>
                  Priorité maintenant
                </span>
              </div>
              <div className="text-lg font-bold truncate" style={{ color: "var(--pp-text-primary)" }}>
                {name ?? "—"}
              </div>
              <div className="text-xs mb-3" style={{ color: "var(--pp-text-secondary)" }}>
                {reason}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => openDialer(phone ?? undefined)}
                  className="flex-1 py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2"
                  style={{ background: "linear-gradient(135deg, var(--pp-success), #00A88A)" }}
                >
                  <Phone className="w-4 h-4" /> Appeler
                </button>
                {overdue && (
                  <button
                    onClick={async () => {
                      const next = new Date(Date.now() + 3600 * 1000).toISOString();
                      await supabase.from("planipret_reminders").update({ scheduled_at: next }).eq("id", overdue.id);
                      loadStats();
                    }}
                    className="px-3 py-2.5 rounded-xl text-xs"
                    style={{
                      background: "var(--pp-bg-elevated)",
                      border: "1px solid var(--pp-bg-border-2)",
                      color: "var(--pp-text-secondary)",
                    }}
                  >
                    Reporter 1h
                  </button>
                )}
              </div>
            </div>
          </section>
        );
      })()}

      {/* ===== STATS GRID ===== */}
      <section className="grid grid-cols-2 gap-3">
        {statsLoading ? (
          <>{[0, 1, 2, 3].map((i) => <Shimmer key={i} className="h-24" />)}</>
        ) : (
          <>
            <StatCard
              icon={<Phone className="w-4 h-4" />}
              value={stats.calls}
              label="Appels"
              accent="var(--pp-brand-accent)"
            />
            <StatCard
              icon={<PhoneMissed className="w-4 h-4" />}
              value={stats.missed}
              label="Manqués"
              accent="var(--pp-danger)"
              pulse={stats.missed > 0}
            />
            <StatCard
              icon={<MessageSquare className="w-4 h-4" />}
              value={stats.sms}
              label="SMS non lus"
              accent="var(--pp-success)"
            />
            <StatCard
              icon={<Voicemail className="w-4 h-4" />}
              value={stats.voicemails}
              label="Voicemails"
              accent="var(--pp-agent)"
            />
          </>
        )}
      </section>

      {/* ===== AI BRIEF ===== */}
      <section
        className="rounded-2xl p-4"
        style={{
          background: "linear-gradient(135deg, rgba(155,127,232,0.12), rgba(46,155,220,0.06))",
          border: "1px solid rgba(155,127,232,0.25)",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4" style={{ color: "var(--pp-agent)" }} />
            <h2 className="text-sm font-semibold" style={{ color: "var(--pp-text-primary)" }}>
              Brief IA du jour
            </h2>
          </div>
          <button
            onClick={playBrief}
            disabled={briefLoading}
            className="text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5 disabled:opacity-50 font-semibold"
            style={{
              background: "linear-gradient(135deg, var(--pp-agent), #6C3CE1)",
              color: "white",
              boxShadow: "0 2px 12px rgba(155,127,232,0.4)",
            }}
          >
            <Headphones className="w-3 h-3" /> {briefLoading ? "..." : "Écouter"}
          </button>
        </div>
        {briefLoading ? (
          <div className="space-y-2">
            <Shimmer className="h-3 w-3/4" />
            <Shimmer className="h-3 w-full" />
            <Shimmer className="h-3 w-2/3" />
          </div>
        ) : brief ? (
          <p className="text-sm whitespace-pre-line" style={{ color: "var(--pp-text-primary)" }}>
            {brief}
          </p>
        ) : (
          <p className="text-xs" style={{ color: "var(--pp-text-muted)" }}>
            Touchez « Écouter » pour générer votre résumé du jour.
          </p>
        )}
      </section>

      {/* ===== MAESTRO SNAPSHOT ===== */}
      {maestroCounts && (() => {
        const tasks = maestroCounts.tasks_due_today ?? maestroCounts.tasks_today ?? maestroCounts.open_tasks ?? 0;
        const appts = maestroCounts.appointments_today ?? maestroCounts.todays_appointments ?? 0;
        const leadsToCall = maestroCounts.leads_to_call ?? maestroCounts.followups_due ?? 0;
        if (tasks + appts + leadsToCall === 0) return null;
        return (
          <section
            className="rounded-2xl p-3 grid grid-cols-3 gap-2"
            style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}
          >
            <MaestroBadge label="Tâches" value={tasks} accent="var(--pp-brand-accent)" onClick={() => navigate("/mplanipret/contacts")} />
            <MaestroBadge label="RDV jour" value={appts} accent="var(--pp-agent)" onClick={() => navigate("/mplanipret/home")} />
            <MaestroBadge label="À rappeler" value={leadsToCall} accent="var(--pp-danger)" onClick={() => navigate("/mplanipret/calls?tab=missed")} />
          </section>
        );
      })()}

      {/* ===== HOT LEADS ===== */}
      {hotLeads.length > 0 && (
        <section className="pp-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: "var(--pp-text-primary)" }}>
              <Flame className="w-4 h-4" style={{ color: "var(--pp-danger)" }} /> Leads chauds
            </h2>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--pp-text-muted)" }}>
              {hotLeads.length}
            </span>
          </div>
          <ul className="space-y-1">
            {hotLeads.map((l) => {
              const name = l.from_name || l.from_number || l.to_name || l.to_number;
              const phone = l.from_number || l.to_number;
              return (
                <li
                  key={l.id}
                  className="flex items-center gap-3 py-2 px-2 rounded-lg"
                  style={{ background: "rgba(232,76,76,0.04)" }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--pp-text-primary)" }}>
                      {name ?? "—"}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--pp-text-muted)" }}>
                      {TEMP_EMOJI.hot} Score {l.lead_score}/10
                    </p>
                  </div>
                  <button
                    onClick={() => openDialer(phone ?? undefined)}
                    className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white"
                    style={{ background: "var(--pp-danger)" }}
                  >
                    Rappeler
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {/* ===== DUE REMINDERS ===== */}
      {dueReminders.length > 0 && (
        <section className="pp-card rounded-2xl p-4">
          <h2 className="text-sm font-semibold mb-3" style={{ color: "var(--pp-text-primary)" }}>
            ⏰ À rappeler
          </h2>
          <ul className="space-y-1">
            {dueReminders.map((r) => (
              <li key={r.id} className="flex items-center gap-2 py-2 px-2 rounded-lg" style={{ background: "var(--pp-bg-elevated)" }}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--pp-text-primary)" }}>
                    {r.contact_name ?? r.contact_number ?? "—"}
                  </p>
                  {r.note && (
                    <p className="text-[11px] truncate" style={{ color: "var(--pp-text-muted)" }}>{r.note}</p>
                  )}
                </div>
                <button
                  onClick={() => openDialer(r.contact_number ?? undefined)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-white"
                  style={{ background: "var(--pp-brand-accent)" }}
                >
                  <Phone className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={async () => {
                    await supabase.from("planipret_reminders").update({ status: "done" }).eq("id", r.id);
                    loadStats();
                  }}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-xs"
                  style={{
                    background: "var(--pp-bg-surface)",
                    border: "1px solid var(--pp-bg-border-2)",
                    color: "var(--pp-success)",
                  }}
                >
                  ✓
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ===== APPOINTMENTS ===== */}
      <section className="pp-card rounded-2xl p-4">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5" style={{ color: "var(--pp-text-primary)" }}>
          <Calendar className="w-4 h-4" style={{ color: "var(--pp-brand-accent)" }} /> Prochains rendez-vous
        </h2>
        {eventsState === "loading" && (
          <div className="space-y-2"><Shimmer className="h-10" /><Shimmer className="h-10" /></div>
        )}
        {eventsState === "no_m365" && (
          <div className="text-center py-3">
            <p className="text-xs mb-2" style={{ color: "var(--pp-text-muted)" }}>
              Connectez Microsoft 365 pour voir vos RDV
            </p>
            <button
              onClick={() => navigate("/mplanipret/more")}
              className="text-xs px-3 py-1.5 rounded-full text-white font-semibold"
              style={{ background: "var(--pp-brand-accent)" }}
            >
              Connecter
            </button>
          </div>
        )}
        {eventsState === "error" && (
          <div className="text-center py-3">
            <p className="text-xs mb-2" style={{ color: "var(--pp-text-muted)" }}>
              Impossible de charger les RDV
            </p>
            <button
              onClick={loadEvents}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{
                border: "1px solid var(--pp-bg-border-2)",
                color: "var(--pp-text-secondary)",
              }}
            >
              Réessayer
            </button>
          </div>
        )}
        {eventsState === "ready" && (events?.length === 0 ? (
          <p className="text-xs text-center py-2" style={{ color: "var(--pp-text-muted)" }}>
            Aucun rendez-vous aujourd'hui 🎉
          </p>
        ) : (
          <ul className="space-y-2">
            {events!.map((e, i) => {
              const t = e.start?.dateTime ? new Date(e.start.dateTime + (e.start.timeZone === "UTC" ? "Z" : "")) : null;
              return (
                <li key={i} className="flex items-center gap-3 py-2">
                  <div
                    className="px-2 py-1 rounded-lg text-xs font-bold tabular-nums"
                    style={{
                      background: "rgba(46,155,220,0.12)",
                      color: "var(--pp-brand-accent)",
                      border: "1px solid rgba(46,155,220,0.25)",
                    }}
                  >
                    {t ? t.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
                  </div>
                  <span className="text-sm truncate" style={{ color: "var(--pp-text-primary)" }}>
                    {e.subject ?? "(Sans titre)"}
                  </span>
                </li>
              );
            })}
          </ul>
        ))}
      </section>

      {/* ===== RECENT CALLS ===== */}
      <section className="pp-card rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold" style={{ color: "var(--pp-text-primary)" }}>
            Appels récents
          </h2>
          <button
            onClick={() => navigate("/mplanipret/calls")}
            className="text-[11px] flex items-center gap-0.5"
            style={{ color: "var(--pp-brand-accent)" }}
          >
            Tout voir <ChevronRight className="w-3 h-3" />
          </button>
        </div>
        {statsLoading ? (
          <div className="space-y-2">{[0, 1, 2].map((i) => <Shimmer key={i} className="h-10" />)}</div>
        ) : recent.length === 0 ? (
          <p className="text-sm py-4 text-center" style={{ color: "var(--pp-text-muted)" }}>
            Aucun appel
          </p>
        ) : (
          <ul className="space-y-1">
            {recent.map((c) => {
              const inbound = c.direction === "inbound";
              const missed = c.direction === "missed";
              const Icon = missed ? X : inbound ? ArrowDownLeft : ArrowUpRight;
              const color = missed ? "var(--pp-danger)" : inbound ? "var(--pp-brand-accent)" : "var(--pp-success)";
              const name = inbound || missed ? (c.from_name || c.from_number) : (c.to_name || c.to_number);
              const phone = inbound || missed ? c.from_number : c.to_number;
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-3 py-2.5 px-2 rounded-lg active:opacity-70"
                  onClick={() => openDialer(phone ?? undefined)}
                >
                  <span
                    className="w-8 h-8 rounded-full flex items-center justify-center"
                    style={{ background: "var(--pp-bg-elevated)", color }}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--pp-text-primary)" }}>
                      {name ?? "Inconnu"}
                    </p>
                    <p className="text-[11px]" style={{ color: "var(--pp-text-muted)" }}>
                      {c.started_at ? new Date(c.started_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ===== FLOATING AVA AGENT BUTTON ===== */}
      {profile?.voice_agent_enabled && (
        <button
          onClick={openAgent}
          aria-label="Parler à AVA"
          className={`fixed right-4 z-30 w-[52px] h-[52px] rounded-full flex items-center justify-center text-white active:scale-95 transition ${agentOpen ? "ring-4 ring-emerald-400/60" : ""}`}
          style={{
            background: "linear-gradient(135deg, var(--pp-agent), #6C3CE1)",
            boxShadow: "0 8px 24px rgba(155,127,232,0.5)",
            bottom: "calc(94px + 60px + 24px)",
          }}
        >
          <Bot className="w-6 h-6" />
        </button>
      )}

      {agentOpen && profile?.user_id && <AvaVoiceAgent userId={profile.user_id} onClose={() => setAgentOpen(false)} />}
    </div>
  );
}

function StatCard({
  icon, value, label, accent, pulse,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent: string;
  pulse?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-3 relative overflow-hidden"
      style={{
        background: "var(--pp-bg-surface)",
        border: "1px solid var(--pp-bg-border-2)",
      }}
    >
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{ background: `linear-gradient(90deg, transparent, ${accent}, transparent)`, opacity: 0.6 }}
      />
      <div className="flex items-center justify-between mb-2">
        <span
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: `${accent}1A`, color: accent }}
        >
          {icon}
        </span>
        {pulse && value > 0 && (
          <span
            className="w-2 h-2 rounded-full pp-pulse-red"
            style={{ background: "var(--pp-danger)" }}
          />
        )}
      </div>
      <div className="text-2xl font-bold tabular-nums" style={{ color: "var(--pp-text-primary)" }}>
        {value}
      </div>
      <div className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: "var(--pp-text-muted)" }}>
        {label}
      </div>
    </div>
  );
}

function MaestroBadge({ label, value, accent, onClick }: { label: string; value: number; accent: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center py-2 rounded-xl transition active:scale-95"
      style={{ background: "var(--pp-bg-elevated)", border: `1px solid ${accent}33` }}
    >
      <div className="text-xl font-bold tabular-nums" style={{ color: accent }}>{value}</div>
      <div className="text-[10px] uppercase tracking-wide" style={{ color: "var(--pp-text-muted)" }}>{label}</div>
    </button>
  );
}
