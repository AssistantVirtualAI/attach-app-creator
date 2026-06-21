import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, PhoneMissed, MessageSquare, Voicemail, ArrowDownLeft, ArrowUpRight, X } from "lucide-react";
import type { PlanipretMobileContext } from "../PlanipretMobile";

const PRIMARY = "#1F4E79";
const SUCCESS = "#27AE60";
const DANGER = "#E74C3C";
const ACCENT = "#2E86C1";

export default function MHome() {
  const { profile } = useOutletContext<PlanipretMobileContext>();
  const [stats, setStats] = useState({ calls: 0, missed: 0, sms: 0, voicemails: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [sipOnline, setSipOnline] = useState(false);

  const dateLabel = new Date().toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const load = async () => {
    if (!profile) return;
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
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [profile?.user_id]);

  const reconnect = async () => {
    await supabase.functions.invoke("ns-auth");
    load();
  };

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
          <Stat icon={<Phone className="w-4 h-4" />} value={stats.calls} label="Appels aujourd'hui" color={PRIMARY} />
          <Stat icon={<PhoneMissed className="w-4 h-4" />} value={stats.missed} label="Appels manqués" color={DANGER} badge />
          <Stat icon={<MessageSquare className="w-4 h-4" />} value={stats.sms} label="SMS non lus" color={ACCENT} />
          <Stat icon={<Voicemail className="w-4 h-4" />} value={stats.voicemails} label="Voicemails non écoutés" color={PRIMARY} />
        </div>
      </section>

      {/* Card 2: recent calls */}
      <section className="bg-white rounded-2xl shadow-sm p-4">
        <h2 className="text-sm font-semibold mb-3" style={{ color: PRIMARY }}>Appels récents</h2>
        {recent.length === 0 ? (
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
