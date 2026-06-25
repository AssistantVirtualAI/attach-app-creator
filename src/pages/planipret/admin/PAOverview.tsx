import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Users, MessageSquare, Bot, ArrowUpRight, ArrowDownLeft, X, Sparkles, Flame, Clock, TrendingUp, TrendingDown } from "lucide-react";
import { TEMP_COLORS, TEMP_EMOJI } from "@/components/planipret/leadHelpers";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, Legend,
} from "recharts";

const ACCENT = "#2E9BDC";
const SUCCESS = "#00D4AA";
const WARNING = "#F5A623";
const AGENT = "#9B7FE8";
const DANGER = "#E84C4C";

const initials = (n?: string) =>
  (n ?? "?").split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";

function KpiCard({ icon, title, value, subtitle, trend, color }: { icon: any; title: string; value: number | string; subtitle: string; trend?: number; color: string }) {
  const trendUp = (trend ?? 0) >= 0;
  return (
    <div className="pp-card" style={{ padding: 20 }}>
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ background: `${color}1A`, color, border: `1px solid ${color}33` }}>
          {icon}
        </div>
        {trend !== undefined && (
          <span className="flex items-center gap-0.5 text-[11px] font-semibold tabular-nums" style={{ color: trendUp ? SUCCESS : DANGER }}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trendUp ? "+" : ""}{trend}%
          </span>
        )}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: "var(--pp-text-primary)" }}>{value}</div>
      <p style={{ fontSize: 12, color: "var(--pp-text-secondary)", marginTop: 8 }}>{title}</p>
      <p style={{ fontSize: 11, color: "var(--pp-text-faint)", marginTop: 2 }}>{subtitle}</p>
    </div>
  );
}

function ChartCard({ title, children, action }: { title: string; children: any; action?: any }) {
  return (
    <div className="pp-card" style={{ padding: 20 }}>
      <div className="flex items-center justify-between mb-4">
        <h2 style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: 14, color: "var(--pp-text-primary)" }}>{title}</h2>
        {action}
      </div>
      {children}
    </div>
  );
}

const TooltipDark = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--pp-bg-deep)", border: "1px solid var(--pp-bg-border-2)", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "var(--pp-text-primary)" }}>
      {label && <div style={{ color: "var(--pp-text-muted)", marginBottom: 4 }}>{label}</div>}
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center gap-2">
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: p.color || p.fill }} />
          <span>{p.name}: <strong>{p.value}</strong></span>
        </div>
      ))}
    </div>
  );
};

export default function PAOverview() {
  const [stats, setStats] = useState({ calls: 0, callsYest: 0, brokers: 0, brokersTotal: 0, sms: 0, ava: 0, smsYest: 0, voicemailsUnread: 0 });
  const [recent, setRecent] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [hotLeads, setHotLeads] = useState<any[]>([]);
  const [pendingByBroker, setPendingByBroker] = useState<Array<{ name: string; total: number; overdue: number }>>([]);
  const [series7d, setSeries7d] = useState<Array<{ day: string; appels: number; sms: number }>>([]);
  const [directionDist, setDirectionDist] = useState<Array<{ name: string; value: number; color: string }>>([]);
  const [topBrokers, setTopBrokers] = useState<Array<{ name: string; calls: number }>>([]);

  const load = async () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const sevenDaysAgo = new Date(today); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
    const todayIso = today.toISOString();
    const yestIso = yest.toISOString();
    const sevenIso = sevenDaysAgo.toISOString();

    const [c1, c2, bAct, bAll, sms, smsY, ava, vm, rec, bList, calls7d, sms7d, callsByDir, topCalls] = await Promise.all([
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).gte("started_at", todayIso),
      supabase.from("planipret_phone_calls").select("id", { count: "exact", head: true }).gte("started_at", yestIso).lt("started_at", todayIso),
      supabase.from("planipret_profiles").select("id", { count: "exact", head: true }).eq("mobile_app_enabled", true),
      supabase.from("planipret_profiles").select("id", { count: "exact", head: true }),
      supabase.from("planipret_phone_messages").select("id", { count: "exact", head: true }).gte("created_at", todayIso),
      supabase.from("planipret_phone_messages").select("id", { count: "exact", head: true }).gte("created_at", yestIso).lt("created_at", todayIso),
      supabase.from("ai_request_audit_log").select("id", { count: "exact", head: true }).gte("created_at", todayIso).like("action", "elevenlabs_tool:%"),
      supabase.from("planipret_voicemails").select("id", { count: "exact", head: true }).eq("is_read", false),
      supabase.from("planipret_phone_calls").select("id, user_id, direction, from_number, to_number, duration_seconds, started_at, ai_summary, planipret_profiles!inner(full_name)").order("started_at", { ascending: false }).limit(20),
      supabase.from("planipret_profiles").select("user_id, full_name, mobile_app_enabled, updated_at").order("updated_at", { ascending: false }),
      supabase.from("planipret_phone_calls").select("started_at").gte("started_at", sevenIso),
      supabase.from("planipret_phone_messages").select("created_at").gte("created_at", sevenIso),
      supabase.from("planipret_phone_calls").select("direction").gte("started_at", sevenIso),
      supabase.from("planipret_phone_calls").select("user_id, planipret_profiles!inner(full_name)").gte("started_at", sevenIso),
    ]);

    setStats({
      calls: c1.count ?? 0, callsYest: c2.count ?? 0,
      brokers: bAct.count ?? 0, brokersTotal: bAll.count ?? 0,
      sms: sms.count ?? 0, smsYest: smsY.count ?? 0,
      ava: ava.count ?? 0, voicemailsUnread: vm.count ?? 0,
    });
    setRecent(rec.data ?? []);
    setBrokers((bList.data ?? []).slice(0, 10));

    // 7d series
    const days: Array<{ day: string; appels: number; sms: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      days.push({ day: d.toLocaleDateString("fr-CA", { weekday: "short" }), appels: 0, sms: 0 });
      (calls7d.data ?? []).forEach((c: any) => { if (c.started_at?.slice(0, 10) === key) days[days.length - 1].appels++; });
      (sms7d.data ?? []).forEach((m: any) => { if (m.created_at?.slice(0, 10) === key) days[days.length - 1].sms++; });
    }
    setSeries7d(days);

    // Direction distribution
    const distMap: Record<string, number> = { inbound: 0, outbound: 0, missed: 0 };
    (callsByDir.data ?? []).forEach((c: any) => { if (c.direction in distMap) distMap[c.direction]++; });
    setDirectionDist([
      { name: "Entrants", value: distMap.inbound, color: ACCENT },
      { name: "Sortants", value: distMap.outbound, color: SUCCESS },
      { name: "Manqués", value: distMap.missed, color: DANGER },
    ]);

    // Top 5 brokers by call volume 7d
    const topMap: Record<string, { name: string; calls: number }> = {};
    (topCalls.data ?? []).forEach((c: any) => {
      const name = c.planipret_profiles?.full_name ?? "—";
      const key = c.user_id;
      if (!topMap[key]) topMap[key] = { name, calls: 0 };
      topMap[key].calls += 1;
    });
    setTopBrokers(Object.values(topMap).sort((a, b) => b.calls - a.calls).slice(0, 5));

    // Hot leads
    const { data: hot } = await supabase
      .from("planipret_phone_calls")
      .select("id, user_id, from_number, from_name, to_number, to_name, lead_score, started_at, planipret_profiles!inner(full_name)")
      .gte("started_at", todayIso)
      .gte("lead_score", 8)
      .order("lead_score", { ascending: false })
      .limit(8);
    setHotLeads((hot ?? []) as any);

    // Pending reminders
    const nowIso = new Date().toISOString();
    const { data: rems } = await supabase
      .from("planipret_reminders")
      .select("user_id, scheduled_at, status, planipret_profiles!inner(full_name)")
      .eq("status", "pending");
    const agg: Record<string, { name: string; total: number; overdue: number }> = {};
    (rems ?? []).forEach((r: any) => {
      const name = r.planipret_profiles?.full_name ?? "—";
      const key = r.user_id;
      if (!agg[key]) agg[key] = { name, total: 0, overdue: 0 };
      agg[key].total += 1;
      if (r.scheduled_at < nowIso) agg[key].overdue += 1;
    });
    setPendingByBroker(Object.values(agg).sort((a, b) => b.overdue - a.overdue || b.total - a.total).slice(0, 8));
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-overview")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_calls" }, () => load())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "planipret_phone_messages" }, () => load())
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "planipret_profiles" }, () => load())
      .subscribe();
    const t = window.setInterval(load, 30000);
    return () => { supabase.removeChannel(ch); window.clearInterval(t); };
  }, []);

  const callsTrend = stats.callsYest > 0 ? Math.round(((stats.calls - stats.callsYest) / stats.callsYest) * 100) : undefined;
  const smsTrend = stats.smsYest > 0 ? Math.round(((stats.sms - stats.smsYest) / stats.smsYest) * 100) : undefined;

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={<Phone className="w-5 h-5" />} title="Appels aujourd'hui" value={stats.calls} subtitle="vs hier" trend={callsTrend} color={ACCENT} />
        <KpiCard icon={<Users className="w-5 h-5" />} title="Courtiers actifs" value={stats.brokers} subtitle={`sur ${stats.brokersTotal} courtiers`} color={SUCCESS} />
        <KpiCard icon={<MessageSquare className="w-5 h-5" />} title="SMS aujourd'hui" value={stats.sms} subtitle="envoyés + reçus" trend={smsTrend} color={WARNING} />
        <KpiCard icon={<Bot className="w-5 h-5" />} title="Sessions AVA aujourd'hui" value={stats.ava} subtitle={`${stats.voicemailsUnread} voicemails non lus`} color={AGENT} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <ChartCard title="Activité 7 derniers jours">
            <div style={{ width: "100%", height: 240 }}>
              <ResponsiveContainer>
                <AreaChart data={series7d} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCalls" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ACCENT} stopOpacity={0.5} />
                      <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSms" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={WARNING} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={WARNING} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="day" stroke="#4A7FA5" fontSize={11} />
                  <YAxis stroke="#4A7FA5" fontSize={11} />
                  <Tooltip content={<TooltipDark />} />
                  <Legend wrapperStyle={{ fontSize: 11, color: "#8FA8C0" }} />
                  <Area type="monotone" dataKey="appels" name="Appels" stroke={ACCENT} strokeWidth={2} fill="url(#gradCalls)" />
                  <Area type="monotone" dataKey="sms" name="SMS" stroke={WARNING} strokeWidth={2} fill="url(#gradSms)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <ChartCard title="Distribution des appels (7j)">
          <div style={{ width: "100%", height: 240 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={directionDist} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {directionDist.map((d, i) => <Cell key={i} fill={d.color} stroke="var(--pp-bg-surface)" strokeWidth={2} />)}
                </Pie>
                <Tooltip content={<TooltipDark />} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#8FA8C0" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      {/* Top brokers + Hot leads */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Top 5 courtiers (7j)">
          <div style={{ width: "100%", height: 240 }}>
            {topBrokers.length === 0 ? (
              <p style={{ fontSize: 12, color: "var(--pp-text-faint)" }} className="text-center py-8">Aucune donnée</p>
            ) : (
              <ResponsiveContainer>
                <BarChart data={topBrokers} layout="vertical" margin={{ top: 4, right: 16, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                  <XAxis type="number" stroke="#4A7FA5" fontSize={11} />
                  <YAxis type="category" dataKey="name" stroke="#4A7FA5" fontSize={11} width={120} />
                  <Tooltip content={<TooltipDark />} cursor={{ fill: "rgba(46,155,220,0.08)" }} />
                  <Bar dataKey="calls" name="Appels" fill={ACCENT} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </ChartCard>

        <ChartCard title="Top leads chauds aujourd'hui" action={
          <Link to="/planipret/admin/leads" style={{ fontSize: 11, color: ACCENT }} className="hover:underline">Voir tous →</Link>
        }>
          {hotLeads.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--pp-text-faint)" }} className="text-center py-8">Aucun lead chaud aujourd'hui</p>
          ) : (
            <ul className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {hotLeads.map((l) => {
                const contact = l.from_name ?? l.from_number ?? l.to_name ?? l.to_number ?? "—";
                return (
                  <li key={l.id} className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(232,76,76,0.06)", borderLeft: `3px solid ${TEMP_COLORS.hot}` }}>
                    <Flame className="w-3.5 h-3.5 flex-shrink-0" style={{ color: TEMP_COLORS.hot }} />
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 12, color: "var(--pp-text-primary)" }}>{l.planipret_profiles?.full_name ?? "—"}</p>
                      <p className="truncate" style={{ fontSize: 11, color: "var(--pp-text-muted)" }}>{contact}</p>
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 700, color: TEMP_COLORS.hot }}>{TEMP_EMOJI.hot} {l.lead_score}/10</span>
                    <span style={{ fontSize: 10, color: "var(--pp-text-faint)" }}>{new Date(l.started_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </ChartCard>
      </div>

      {/* Recent activity + Brokers online */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <div className="lg:col-span-3 pp-card" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: 14, color: "var(--pp-text-primary)", marginBottom: 12 }}>Activité récente</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--pp-bg-border-2)" }}>
                  {["Courtier", "Dir.", "Numéro", "Durée", "Heure", "IA"].map((h) => (
                    <th key={h} className="py-2 text-left" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((c) => {
                  const inb = c.direction === "inbound", missed = c.direction === "missed";
                  const Icon = missed ? X : inb ? ArrowDownLeft : ArrowUpRight;
                  const col = missed ? DANGER : inb ? ACCENT : SUCCESS;
                  const num = inb || missed ? c.from_number : c.to_number;
                  return (
                    <tr key={c.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }} className="hover:bg-white/[0.02]">
                      <td className="py-2.5 truncate max-w-[140px]" style={{ fontSize: 12, color: "var(--pp-text-primary)" }}>{(c as any).planipret_profiles?.full_name ?? "—"}</td>
                      <td><Icon className="w-3.5 h-3.5" style={{ color: col }} /></td>
                      <td style={{ fontSize: 12, color: "var(--pp-text-secondary)" }}>{num ?? "—"}</td>
                      <td style={{ fontSize: 12, color: "var(--pp-text-muted)" }}>{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : "—"}</td>
                      <td style={{ fontSize: 11, color: "var(--pp-text-faint)" }}>{c.started_at ? new Date(c.started_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""}</td>
                      <td>{c.ai_summary && <Sparkles className="w-3.5 h-3.5" style={{ color: AGENT }} />}</td>
                    </tr>
                  );
                })}
                {recent.length === 0 && <tr><td colSpan={6} className="py-6 text-center" style={{ fontSize: 11, color: "var(--pp-text-faint)" }}>Aucun appel récent</td></tr>}
              </tbody>
            </table>
          </div>
        </div>

        <div className="lg:col-span-2 pp-card" style={{ padding: 20 }}>
          <h2 style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: 14, color: "var(--pp-text-primary)", marginBottom: 12 }}>Courtiers</h2>
          <ul className="space-y-1 max-h-[420px] overflow-y-auto">
            {brokers.map((b) => {
              const online = b.mobile_app_enabled;
              return (
                <li key={b.user_id} className="flex items-center gap-3 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, #1A4A8A, #2E9BDC)", color: "#fff", fontSize: 10, fontWeight: 700 }}>
                    {initials(b.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="truncate" style={{ fontSize: 12, color: "var(--pp-text-primary)" }}>{b.full_name}</p>
                    <p style={{ fontSize: 10, color: "var(--pp-text-faint)" }}>{b.updated_at ? new Date(b.updated_at).toLocaleString("fr-CA", { hour: "2-digit", minute: "2-digit" }) : ""}</p>
                  </div>
                  <span className="flex items-center gap-1" style={{ fontSize: 10 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: online ? SUCCESS : "var(--pp-text-faint)", boxShadow: online ? `0 0 6px ${SUCCESS}` : "none" }} />
                    <span style={{ color: online ? SUCCESS : "var(--pp-text-faint)" }}>{online ? "Actif" : "Inactif"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Pending reminders */}
      {pendingByBroker.length > 0 && (
        <div className="pp-card" style={{ padding: 20 }}>
          <h2 className="flex items-center gap-2 mb-3" style={{ fontFamily: "Inter,sans-serif", fontWeight: 600, fontSize: 14, color: "var(--pp-text-primary)" }}>
            <Clock className="w-4 h-4" style={{ color: WARNING }} /> Rappels en attente
          </h2>
          <ul className="space-y-1">
            {pendingByBroker.map((p, i) => (
              <li key={i} className="flex items-center gap-2 py-2" style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                <span className="flex-1 truncate" style={{ fontSize: 12, color: "var(--pp-text-primary)" }}>{p.name}</span>
                <span style={{ fontSize: 11, color: "var(--pp-text-muted)" }} className="tabular-nums">{p.total} en attente</span>
                {p.overdue > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-white" style={{ fontSize: 10, fontWeight: 700, background: DANGER }}>
                    {p.overdue} en retard
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
