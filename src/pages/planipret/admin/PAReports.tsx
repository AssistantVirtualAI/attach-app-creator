import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { Download } from "lucide-react";

type Range = "week" | "month" | "quarter";

export default function PAReports() {
  const [range, setRange] = useState<Range>("week");
  const [calls, setCalls] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<Record<string, string>>({});

  useEffect(() => {
    const start = new Date();
    if (range === "week") start.setDate(start.getDate() - 7);
    else if (range === "month") start.setMonth(start.getMonth() - 1);
    else start.setMonth(start.getMonth() - 3);
    start.setHours(0, 0, 0, 0);
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        supabase.from("planipret_phone_calls").select("*").gte("started_at", start.toISOString()),
        supabase.from("planipret_profiles").select("user_id, full_name"),
      ]);
      setCalls(c ?? []);
      const map: Record<string, string> = {};
      (p ?? []).forEach((x: any) => map[x.user_id] = x.full_name);
      setBrokers(map);
    })();
  }, [range]);

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
      { name: "Entrant", value: m.inbound, color: "#27AE60" },
      { name: "Sortant", value: m.outbound, color: "#2E86C1" },
      { name: "Manqué", value: m.missed, color: "#E74C3C" },
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
    return top ? `Entre ${top[0]}h et ${+top[0] + 1}h` : "—";
  }, [calls]);

  const answerRate = useMemo(() => {
    if (!calls.length) return "—";
    const answered = calls.filter((c) => c.direction !== "missed").length;
    return Math.round((answered / calls.length) * 100) + "%";
  }, [calls]);

  const byBroker = useMemo(() => {
    const m: Record<string, any> = {};
    calls.forEach((c) => {
      const k = c.user_id;
      if (!m[k]) m[k] = { name: brokers[k] ?? "—", total: 0, in: 0, out: 0, missed: 0, totalDur: 0, durCount: 0 };
      m[k].total++;
      if (c.direction === "inbound") m[k].in++;
      else if (c.direction === "outbound") m[k].out++;
      else if (c.direction === "missed") m[k].missed++;
      if (c.duration_seconds) { m[k].totalDur += c.duration_seconds; m[k].durCount++; }
    });
    return Object.values(m).sort((a: any, b: any) => b.total - a.total);
  }, [calls, brokers]);

  const exportCsv = () => {
    const headers = ["Courtier", "Total", "Entrants", "Sortants", "Manqués", "Durée moy."];
    const lines = [headers.join(",")].concat((byBroker as any[]).map((b: any) =>
      [b.name, b.total, b.in, b.out, b.missed, b.durCount ? Math.round(b.totalDur / b.durCount) + "s" : "—"].map((v) => `"${v}"`).join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `rapport-${Date.now()}.csv`; a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(["week", "month", "quarter"] as Range[]).map((r) => (
          <button key={r} onClick={() => setRange(r)}
            className={`px-3 py-1.5 rounded-lg text-sm ${range === r ? "bg-blue-600 text-white" : "bg-white border border-slate-200 text-slate-600"}`}>
            {r === "week" ? "Cette semaine" : r === "month" ? "Ce mois" : "3 derniers mois"}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold mb-3">Appels par jour</h3>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDay}>
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2E86C1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-5">
          <h3 className="font-semibold mb-3">Répartition des appels</h3>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie data={byDirection} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label>
                {byDirection.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip /><Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Stat label="Durée moyenne" value={avgDuration} />
        <Stat label="Heure de pointe" value={peakHour} />
        <Stat label="Taux de réponse" value={answerRate} />
      </div>

      <div className="bg-white rounded-xl shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Performance par courtier</h3>
          <button onClick={exportCsv} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs">
            <Download className="w-3.5 h-3.5" /> Exporter CSV
          </button>
        </div>
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="py-2">Courtier</th><th>Appels</th><th>Entrants</th><th>Sortants</th><th>Manqués</th><th>Durée moy.</th></tr>
          </thead>
          <tbody>
            {(byBroker as any[]).map((b: any) => (
              <tr key={b.name} className="border-t border-slate-100">
                <td className="py-2">{b.name}</td>
                <td>{b.total}</td><td>{b.in}</td><td>{b.out}</td><td>{b.missed}</td>
                <td>{b.durCount ? `${Math.round(b.totalDur / b.durCount)}s` : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: any) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-5">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: "#0F1924" }}>{value}</p>
    </div>
  );
}
