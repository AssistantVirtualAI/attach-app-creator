import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Users, MessageSquare, Bot, ArrowUpRight, ArrowDownLeft, X, Sparkles, Flame, Clock } from "lucide-react";
import { TEMP_COLORS, TEMP_EMOJI } from "@/components/planipret/leadHelpers";

const COLORS = { calls: "#2E86C1", users: "#27AE60", sms: "#F39C12", agent: "#8B5CF6" };

function KpiCard({ icon, title, value, subtitle, color }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}15`, color }}>{icon}</div>
      </div>
      <div className="text-[36px] font-bold leading-none" style={{ color: "#0F1924" }}>{value}</div>
      <p className="text-xs text-slate-500 mt-2">{title}</p>
      <p className="text-[11px] text-slate-400 mt-0.5">{subtitle}</p>
    </div>
  );
}

export default function PAOverview() {
  const [stats, setStats] = useState({ calls: 0, callsYest: 0, brokers: 0, brokersTotal: 0, sms: 0, ava: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [pendingByBroker, setPendingByBroker] = useState<Array<{ name: string; total: number; overdue: number }>>([]);

  const load = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const todayIso = today.toISOString();
    const yestIso = yest.toISOString();

    const [c1, c2, bAct, bAll, sms, ava, rec, bList] = await Promise.all([
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).gte("started_at", todayIso),
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).gte("started_at", yestIso).lt("started_at", todayIso),
      supabase.from("planipret_profiles").select("id", { count: "exact", head: true }).eq("mobile_app_enabled", true),
      supabase.from("planipret_profiles").select("id", { count: "exact", head: true }),
      supabase.from("planipret_phone_messages").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("ai_request_audit_log").select("id", { count: "exact", head: true }).gte("created_at", todayIso).like("action", "elevenlabs_tool:%"),
      supabase.from("planipret_phone_calls").select("id, user_id, direction, from_number, to_number, duration_seconds, started_at, ai_summary, planipret_profiles!inner(full_name)").order("started_at", { ascending: false }).limit(20),
      supabase.from("planipret_profiles").select("user_id, full_name, mobile_app_enabled, updated_at").order("updated_at", { ascending: false }),
    ]);

    setStats({
      calls: c1.count ?? 0, callsYest: c2.count ?? 0,
      brokers: bAct.count ?? 0, brokersTotal: bAll.count ?? 0,
      sms: sms.count ?? 0, ava: ava.count ?? 0,
    });
    setRecent(rec.data ?? []);
    setBrokers((bList.data ?? []).slice(0, 12));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-overview")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_calls" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "planipret_profiles" }, () => load())
      .subscribe();
    const t = window.setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
  }, []);

  const trend = stats.callsYest > 0 ? Math.round(((stats.calls - stats.callsYest) / stats.callsYest) * 100) : 0;
  const trendStr = stats.callsYest === 0 ? "vs hier: —" : `vs hier: ${trend >= 0 ? "+" : ""}${trend}%`;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Phone className="w-5 h-5" />} title="Appels aujourd'hui" value={stats.calls} subtitle={trendStr} color={COLORS.calls} />
        <KpiCard icon={<Users className="w-5 h-5" />} title="Courtiers actifs" value={stats.brokers} subtitle={`sur ${stats.brokersTotal} courtiers`} color={COLORS.users} />
        <KpiCard icon={<MessageSquare className="w-5 h-5" />} title="SMS aujourd'hui" value={stats.sms} subtitle="envoyés + reçus" color={COLORS.sms} />
        <KpiCard icon={<Bot className="w-5 h-5" />} title="Sessions AVA aujourd'hui" value={stats.ava} subtitle="agent vocal actif" color={COLORS.agent} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3" style={{ color: "#0F1924" }}>Activité récente</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-400 border-b">
                  <th className="py-2">Courtier</th><th>Dir.</th><th>Numéro</th><th>Durée</th><th>Heure</th><th>IA</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const inb = c.direction === "inbound", missed = c.direction === "missed";
                  const Icon = missed ? X : inb ? ArrowDownLeft : ArrowUpRight;
                  const col = missed ? "#E74C3C" : inb ? COLORS.calls : "#27AE60";
                  const num = inb || missed ? c.from_number : c.to_number;
                  return (
                    <tr key={c.id} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 text-slate-700 truncate max-w-[140px]">{(c as any).planipret_profiles?.full_name ?? "—"}</td>
                      <td><Icon className="w-3.5 h-3.5" style={{ color: col }} /></td>
                      <td className="text-slate-600">{num ?? "—"}</td>
                      <td className="text-slate-500">{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : "—"}</td>
                      <td className="text-slate-400 text-xs">{c.started_at ? new Date(c.started_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""}</td>
                      <td>{c.ai_summary && <Sparkles className="w-3.5 h-3.5" style={{ color: COLORS.agent }} />}</td>
                    </tr>
                  );
                })}
                {recent.length === 0 && <tr><td colSpan={6} className="py-6 text-center text-slate-400 text-xs">Aucun appel récent</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-xl shadow-sm p-5">
          <h2 className="font-semibold mb-3" style={{ color: "#0F1924" }}>Courtiers en ligne</h2>
          <ul className="space-y-2 max-h-[420px] overflow-y-auto">
            {brokers.map((b) => {
              const online = b.mobile_app_enabled;
              return (
                <li key={b.user_id} className="flex items-center gap-3 py-2 border-b border-slate-50">
                  <div className="w-8 h-8 rounded-full text-white text-[10px] font-bold flex items-center justify-center" style={{ background: "#1F4E79" }}>
                    {initials(b.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate" style={{ color: "#0F1924" }}>{b.full_name}</p>
                    <p className="text-[11px] text-slate-400">{b.updated_at ? new Date(b.updated_at).toLocaleString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                  </div>
                  <span className="flex items-center gap-1 text-[11px]">
                    <span className={`w-2 h-2 rounded-full ${online ? "bg-green-500" : "bg-slate-300"}`} />
                    <span className="text-slate-500">{online ? "En ligne" : "Hors ligne"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* RGPD / retention notice */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3">
        <div className="text-amber-600 text-xl leading-none">⚠️</div>
        <div className="flex-1">
          <p className="font-semibold text-sm text-amber-900">Rétention des données</p>
          <p className="text-xs text-amber-800 mt-1">
            Les enregistrements d'appels sont supprimés par NetSapiens après 90 jours.
            Aucune purge automatique n'est configurée pour les transcriptions et analyses IA.
          </p>
          <p className="text-[11px] text-amber-700 mt-2">
            Pour configurer la rétention : <code className="bg-amber-100 px-1 rounded">planipret_settings.retention_days</code>
          </p>
        </div>
      </div>
    </div>
  );
}

function initials(n?: string) { return (n ?? "?").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?"; }
