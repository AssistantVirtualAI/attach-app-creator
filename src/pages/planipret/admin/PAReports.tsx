import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, CartesianGrid } from "recharts";
import { Download, Trophy, FileText, RefreshCw, Smartphone, Bot, Plug, Mail, Link2, Users } from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import { usePlanipretBrokerStats } from "@/lib/planipret/brokerStats";
import { usePlanipretNsAutoSync } from "@/hooks/usePlanipretNsAutoSync";
import NsSyncBar from "@/components/planipret/admin/NsSyncBar";

type Range = "week" | "month" | "quarter";

const ACCENT = "#2E9BDC";
const SUCCESS = "#00D4AA";
const DANGER = "#E84C4C";
const GOLD = "#F5C842";
const SILVER = "#C0C0C0";
const BRONZE = "#CD7F32";

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

export default function PAReports() {
  const [range, setRange] = useState<Range>("week");
  const [calls, setCalls] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [avaFeedback, setAvaFeedback] = useState<Array<{ rating: string }>>([]);
  const [reminders, setReminders] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<Record<string, string>>({});
  const [exporting, setExporting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [refreshTick, setRefreshTick] = useState(0);
  const reportRef = useRef<HTMLDivElement>(null);
  const { stats: brokerStats } = usePlanipretBrokerStats();


  const periodLabel = range === "week" ? "7 derniers jours" : range === "month" ? "30 derniers jours" : "3 derniers mois";

  usePlanipretNsAutoSync({ onQueued: () => setRefreshTick((t) => t + 1) });

  useEffect(() => {
    const start = new Date();
    if (range === "week") start.setDate(start.getDate() - 7);
    else if (range === "month") start.setMonth(start.getMonth() - 1);
    else start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    (async () => {
      const startIso = start.toISOString();
      const [{ data: c }, { data: p }, nsUsers, { data: m }, { data: fb }, { data: rem }] = await Promise.all([
        supabase.from("planipret_phone_calls").select("*").gte("started_at", startIso),
        supabase.from("planipret_profiles").select("user_id, full_name, extension, ns_extension"),
        supabase.functions.invoke("pp-ns-users", { body: {} }).catch((error) => ({ data: null, error })),
        supabase.from("planipret_phone_messages").select("id, sent_at, created_at, direction, user_id, extension").gte("sent_at", startIso),
        supabase.from("planipret_ava_feedback").select("rating").gte("created_at", startIso),
        supabase.from("planipret_reminders").select("id, user_id, status, scheduled_at, created_at").gte("created_at", startIso),
      ]);
      setCalls(c ?? []);
      setMessages(m ?? []);
      setAvaFeedback((fb ?? []) as any);
      setReminders(rem ?? []);
      const map: Record<string, string> = {};
      (p ?? []).forEach((x: any) => {
        map[x.user_id] = x.full_name;
        if (x.extension) map[`ext:${x.extension}`] = x.full_name;
        if (x.ns_extension) map[`ext:${x.ns_extension}`] = x.full_name;
      });
      (((nsUsers as any)?.data?.brokers ?? []) as any[]).forEach((x: any) => {
        if (x.extension) map[`ext:${x.extension}`] = x.full_name || `Ext. ${x.extension}`;
        if (x.user_id && !String(x.user_id).startsWith("ns:")) map[x.user_id] = x.full_name || map[x.user_id];
      });
      setBrokers(map);
    })();
  }, [range, refreshTick]);



  const syncAll = async () => {
    setSyncing(true);
    const id = toast.loading("Synchronisation NS-API complète…");
    try {
      const { data, error } = await supabase.functions.invoke("pp-admin-ns-sync", { body: {} });
      if (error) throw error;
      toast.success(`${(data as any)?.extensions ?? (data as any)?.users_total ?? 0} extensions synchronisées · rapports mis à jour sous peu`, { id });
    } catch (e: any) {
      toast.error(`Échec: ${e.message ?? e}`, { id });
    } finally {
      setSyncing(false);
    }
  };

  const byDay = useMemo(() => {
    const map: Record<string, number> = {};
    calls.forEach((c) => {
      const d = new Date(c.started_at).toLocaleDateString("fr-CA", { day: "2-digit", month: "short" });
      map[d] = (map[d] ?? 0) + 1;
    });
    return Object.entries(map).map(([date, count]) => ({ date, count }));
  }, [calls]);

  const byDirection = useMemo(() => {
    const m = { inbound: 0, outbound: 0, missed: 0 };
    calls.forEach((c) => { if (c.direction in m) (m as any)[c.direction]++; });
    return [
      { name: "Entrant", value: m.inbound, color: ACCENT },
      { name: "Sortant", value: m.outbound, color: SUCCESS },
      { name: "Manqué", value: m.missed, color: DANGER },
    ];
  }, [calls]);

  const avgDuration = useMemo(() => {
    const arr = calls.filter((c) => c.duration_seconds).map((c) => c.duration_seconds);
    if (!arr.length) return "—";
    const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
    return `${Math.floor(avg / 60)} min ${Math.floor(avg % 60)} sec`;
  }, [calls]);

  const peakHour = useMemo(() => {
    const h: Record<number, number> = {};
    calls.forEach((c) => { const hh = new Date(c.started_at).getHours(); h[hh] = (h[hh] ?? 0) + 1; });
    const top = Object.entries(h).sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0]}h–${+top[0] + 1}h` : "—";
  }, [calls]);

  const answerRate = useMemo(() => {
    if (!calls.length) return "—";
    const answered = calls.filter((c) => c.direction !== "missed").length;
    return Math.round((answered / calls.length) * 100) + "%";
  }, [calls]);

  const byBroker = useMemo(() => {
    const m: Record<string, any> = {};
    calls.forEach((c) => {
      const k = c.user_id ?? `ext:${c.extension ?? c.metadata?.extension ?? "unknown"}`;
      if (!m[k]) m[k] = { name: brokers[k] ?? (c.extension ? `Ext. ${c.extension}` : "—"), total: 0, in: 0, out: 0, missed: 0, totalDur: 0, durCount: 0 };
      m[k].total++;
      if (c.direction === "inbound") m[k].in++;
      else if (c.direction === "outbound") m[k].out++;
      else if (c.direction === "missed") m[k].missed++;
      if (c.duration_seconds) { m[k].totalDur += c.duration_seconds; m[k].durCount++; }
    });
    return Object.values(m).sort((a: any, b: any) => b.total - a.total);
  }, [calls, brokers]);

  const podium = (byBroker as any[]).slice(0, 3);

  const exportCsv = () => {
    const headers = ["Courtier", "Total", "Entrants", "Sortants", "Manqués", "Durée moy."];
    const lines = [headers.join(",")].concat((byBroker as any[]).map((b: any) =>
      [b.name, b.total, b.in, b.out, b.missed, b.durCount ? Math.round(b.totalDur / b.durCount) + "s" : "—"].map((v) => `"${v}"`).join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rapport-${Date.now()}.csv`; a.click();
  };

  const exportPdf = async () => {
    if (!reportRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: "#0B1437",
        scale: 2,
        useCORS: true,
        logging: false,
      });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW - 20;
      const imgH = (canvas.height * imgW) / canvas.width;
      const dateLabel = new Date().toLocaleDateString("fr-CA");
      pdf.setFillColor(11, 20, 55); pdf.rect(0, 0, pageW, pageH, "F");
      pdf.setTextColor(255, 255, 255); pdf.setFontSize(16);
      pdf.text("Planiprêt — Rapport admin", 10, 12);
      pdf.setFontSize(9); pdf.setTextColor(143, 168, 192);
      pdf.text(`Période : ${range === "week" ? "7 jours" : range === "month" ? "30 jours" : "90 jours"} · Généré le ${dateLabel}`, 10, 18);
      let y = 24, remaining = imgH, srcY = 0;
      const ratio = canvas.width / imgW;
      while (remaining > 0) {
        const sliceH = Math.min(pageH - y - 8, remaining);
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = sliceH * ratio;
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.drawImage(canvas, 0, srcY, canvas.width, sliceCanvas.height, 0, 0, canvas.width, sliceCanvas.height);
        pdf.addImage(sliceCanvas.toDataURL("image/png"), "PNG", 10, y, imgW, sliceH);
        srcY += sliceCanvas.height;
        remaining -= sliceH;
        if (remaining > 0) { pdf.addPage(); pdf.setFillColor(11, 20, 55); pdf.rect(0, 0, pageW, pageH, "F"); y = 10; }
      }
      pdf.save(`planipret-rapport-${range}-${new Date().toISOString().slice(0,10)}.pdf`);
      toast.success("PDF généré");
    } catch (e: any) {
      toast.error("Échec de l'export PDF : " + (e?.message ?? "erreur"));
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <NsSyncBar features={["cdrs", "messages", "recordings"]} onReload={() => setRefreshTick((t) => t + 1)} />
      <div className="flex flex-wrap items-center justify-between gap-2">

        <div className="flex gap-2">
          {(["week", "month", "quarter"] as Range[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className="px-3 py-1.5 rounded-lg text-sm transition"
              style={range === r
                ? { background: ACCENT, color: "#fff", border: `1px solid ${ACCENT}` }
                : { background: "var(--pp-bg-elevated)", color: "var(--pp-text-secondary)", border: "1px solid var(--pp-bg-border-2)" }}>
              {r === "week" ? "Cette semaine" : r === "month" ? "Ce mois" : "3 derniers mois"}
            </button>
          ))}
        </div>
        <button onClick={exportPdf} disabled={exporting}
          className="pp-btn-primary flex items-center gap-2 text-sm disabled:opacity-50">
          <FileText className="w-4 h-4" /> {exporting ? "Génération…" : "Exporter PDF"}
        </button>
      </div>

      <div ref={reportRef} className="space-y-4">

      {/* ───────── SECTION A — État actuel (non filtré par période) ───────── */}
      <div className="pp-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="flex items-center gap-2" style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>
            <Users className="w-4 h-4" style={{ color: ACCENT }} /> Activité des courtiers — État actuel
          </h3>
          <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{ background: "rgba(46,155,220,0.12)", color: ACCENT, border: "1px solid rgba(46,155,220,0.25)" }}>
            Snapshot temps réel
          </span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatTile icon={<Users className="w-3.5 h-3.5" />} label="Courtiers" value={brokerStats.total_courtiers} color={ACCENT} />
          <StatTile icon={<Smartphone className="w-3.5 h-3.5" />} label="App Mobile active" value={brokerStats.app_mobile_active} color={SUCCESS} sub={`sur ${brokerStats.total_courtiers}`} />
          <StatTile icon={<Bot className="w-3.5 h-3.5" />} label="Agent IA actif" value={brokerStats.agent_ia_active} color="#9B7FE8" sub={`sur ${brokerStats.total_courtiers}`} />
          <StatTile icon={<Plug className="w-3.5 h-3.5" />} label="Maestro lié" value={brokerStats.maestro_connected} color="#F5A623" />
          <StatTile icon={<Mail className="w-3.5 h-3.5" />} label="M365 connecté" value={brokerStats.ms365_connected} color="#2E9BDC" />
          <StatTile icon={<Link2 className="w-3.5 h-3.5" />} label="NS lié" value={brokerStats.ns_linked} color={GOLD} />
        </div>
      </div>

      {/* ───────── Sections B+ — Filtrées par période ───────── */}
      <div className="flex items-center gap-2 mt-2">
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
          style={{ background: "rgba(245,200,66,0.12)", color: GOLD, border: "1px solid rgba(245,200,66,0.25)" }}>
          Période sélectionnée · {periodLabel}
        </span>
      </div>

      {/* Podium */}
      {podium.length > 0 && (
        <div className="pp-card p-5">
          <h3 className="flex items-center gap-2 mb-4" style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>
            <Trophy className="w-4 h-4" style={{ color: GOLD }} /> Podium courtiers
          </h3>
          <div className="grid grid-cols-3 gap-3 items-end">
            {[1, 0, 2].map((idx) => {
              const b = podium[idx];
              if (!b) return <div key={idx} />;
              const colors = [GOLD, SILVER, BRONZE];
              const heights = [120, 90, 70];
              const labels = ["🥇", "🥈", "🥉"];
              const c = colors[idx]; const h = heights[idx];
              return (
                <div key={idx} className="text-center">
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{labels[idx]}</div>
                  <div className="truncate mb-2" style={{ fontSize: 12, fontWeight: 600, color: "var(--pp-text-primary)" }}>{b.name}</div>
                  <div className="rounded-t-lg flex items-end justify-center pb-2" style={{ height: h, background: `linear-gradient(180deg, ${c}40, ${c}10)`, border: `1px solid ${c}66`, borderBottom: "none" }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: c }}>{b.total}</span>
                  </div>
                  <div style={{ fontSize: 10, color: "var(--pp-text-muted)", marginTop: 4 }}>{b.in} entrants · {b.out} sortants</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="pp-card p-5">
          <h3 className="mb-3" style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Appels par jour</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: "#4A7FA5" }} />
              <YAxis tick={{ fontSize: 11, fill: "#4A7FA5" }} />
              <Tooltip content={<TooltipDark />} cursor={{ fill: "rgba(46,155,220,0.08)" }} />
              <Bar dataKey="count" name="Appels" fill={ACCENT} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="pp-card p-5">
          <h3 className="mb-3" style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Répartition des appels</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byDirection} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} paddingAngle={4}>
                {byDirection.map((e, i) => <Cell key={i} fill={e.color} stroke="var(--pp-bg-surface)" strokeWidth={2} />)}
              </Pie>
              <Tooltip content={<TooltipDark />} />
              <Legend wrapperStyle={{ fontSize: 11, color: "#8FA8C0" }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Durée moyenne" value={avgDuration} />
        <Stat label="Heure de pointe" value={peakHour} />
        <Stat label="Taux de réponse" value={answerRate} />
      </div>

      <div className="pp-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Performance par courtier</h3>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
            style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
            <Download className="w-3.5 h-3.5" /> Exporter CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)", borderBottom: "1px solid var(--pp-bg-border-2)" }} className="text-left">
              <th className="py-2">Courtier</th><th>Appels</th><th>Entrants</th><th>Sortants</th><th>Manqués</th><th>Durée moy.</th>
            </tr>
          </thead>
          <tbody>
            {(byBroker as any[]).length === 0 ? (
              <tr><td colSpan={6} className="py-6 text-center" style={{ color: "var(--pp-text-faint)" }}>Aucune donnée</td></tr>
            ) : (byBroker as any[]).map((b: any) => (
              <tr key={b.name} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                <td className="py-2" style={{ color: "var(--pp-text-primary)" }}>{b.name}</td>
                <td style={{ color: "var(--pp-text-secondary)" }}>{b.total}</td>
                <td style={{ color: ACCENT }}>{b.in}</td>
                <td style={{ color: SUCCESS }}>{b.out}</td>
                <td style={{ color: DANGER }}>{b.missed}</td>
                <td style={{ color: "var(--pp-text-muted)" }}>{b.durCount ? `${Math.round(b.totalDur / b.durCount)}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="pp-card p-5">
      <p style={{ fontSize: 11, color: "var(--pp-text-muted)" }}>{label}</p>
      <p style={{ fontSize: 24, fontWeight: 700, marginTop: 4, color: "var(--pp-text-primary)" }}>{value}</p>
    </div>
  );
}

function StatTile({ icon, label, value, sub, color }: { icon: any; label: string; value: number | string; sub?: string; color: string }) {
  return (
    <div className="rounded-lg p-3 flex flex-col gap-1"
      style={{ background: "var(--pp-bg-deep)", border: "1px solid var(--pp-bg-border-2)" }}>
      <div className="flex items-center gap-1.5" style={{ color }}>
        {icon}
        <span style={{ fontSize: 10, color: "var(--pp-text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      </div>
      <div className="tabular-nums" style={{ fontSize: 22, fontWeight: 700, color: "var(--pp-text-primary)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--pp-text-faint)" }}>{sub}</div>}
    </div>
  );
}

