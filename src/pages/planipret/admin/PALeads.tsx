import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Download } from "lucide-react";
import { TEMP_COLORS, TEMP_EMOJI, TEMP_LABEL, type LeadTemp } from "@/components/planipret/leadHelpers";

const PRIMARY = "#1F4E79";

type Row = {
  id: string;
  user_id: string;
  direction: string;
  from_number: string | null;
  from_name: string | null;
  to_number: string | null;
  to_name: string | null;
  started_at: string;
  lead_score: number | null;
  lead_temperature: LeadTemp;
  lead_score_reason: string | null;
  planipret_profiles?: { full_name: string };
};

export default function PALeads() {
  const [rows, setRows] = useState<Row[]>([]);
  const [filter, setFilter] = useState<"all" | "hot" | "warm" | "cold">("all");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("planipret_phone_calls")
      .select("id, user_id, direction, from_number, from_name, to_number, to_name, started_at, lead_score, lead_temperature, lead_score_reason, planipret_profiles!inner(full_name)")
      .not("lead_score", "is", null)
      .order("lead_score", { ascending: false })
      .order("started_at", { ascending: false })
      .limit(500);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() =>
    filter === "all" ? rows : rows.filter((r) => r.lead_temperature === filter),
  [rows, filter]);

  const exportCsv = () => {
    const header = ["Date", "Courtier", "Contact", "Numéro", "Direction", "Score", "Température", "Raison"];
    const lines = [header.join(",")];
    filtered.forEach((r) => {
      const contact = r.from_name ?? r.to_name ?? "";
      const num = r.from_number ?? r.to_number ?? "";
      lines.push([
        new Date(r.started_at).toISOString(),
        `"${(r.planipret_profiles?.full_name ?? "").replace(/"/g, '""')}"`,
        `"${contact.replace(/"/g, '""')}"`,
        num,
        r.direction,
        r.lead_score ?? "",
        r.lead_temperature ?? "",
        `"${(r.lead_score_reason ?? "").replace(/"/g, '""')}"`,
      ].join(","));
    });
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ color: "#0F1924" }}>Leads & Pipeline</h2>
        <button onClick={exportCsv} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-white" style={{ background: PRIMARY }}>
          <Download className="w-4 h-4" /> Export CSV
        </button>
      </div>

      <div className="flex gap-2">
        {([["all","Tous"],["hot","🔥 Chauds"],["warm","🌡️ Tièdes"],["cold","❄️ Froids"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setFilter(k as any)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${filter === k ? "text-white" : "bg-white border border-slate-200 text-slate-600"}`}
            style={filter === k ? { background: PRIMARY } : undefined}>
            {l}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500">
            <tr className="text-left">
              <th className="p-3">Date</th>
              <th className="p-3">Courtier</th>
              <th className="p-3">Contact</th>
              <th className="p-3">Score</th>
              <th className="p-3">Température</th>
              <th className="p-3">Raison</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Chargement…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} className="p-8 text-center text-slate-400">Aucun lead noté</td></tr>
            ) : filtered.map((r) => {
              const contact = r.from_name ?? r.to_name ?? r.from_number ?? r.to_number ?? "—";
              const temp = r.lead_temperature ?? "cold";
              return (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50"
                  style={{ borderLeft: `3px solid ${TEMP_COLORS[temp as keyof typeof TEMP_COLORS]}` }}>
                  <td className="p-3 text-slate-500 text-xs">{new Date(r.started_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="p-3 text-slate-700">{r.planipret_profiles?.full_name ?? "—"}</td>
                  <td className="p-3 font-medium" style={{ color: "#0F1924" }}>{contact}</td>
                  <td className="p-3 tabular-nums font-bold" style={{ color: TEMP_COLORS[temp as keyof typeof TEMP_COLORS] }}>{r.lead_score}/10</td>
                  <td className="p-3">
                    <span className="text-[11px] px-2 py-1 rounded-full font-semibold"
                      style={{ background: `${TEMP_COLORS[temp as keyof typeof TEMP_COLORS]}15`, color: TEMP_COLORS[temp as keyof typeof TEMP_COLORS] }}>
                      {TEMP_EMOJI[temp as keyof typeof TEMP_EMOJI]} {TEMP_LABEL[temp as keyof typeof TEMP_LABEL]}
                    </span>
                  </td>
                  <td className="p-3 text-slate-500 text-xs max-w-md truncate">{r.lead_score_reason ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
