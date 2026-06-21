import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownLeft, ArrowUpRight, X, Mic, Sparkles, Download, Eye } from "lucide-react";

const PAGE = 50;

export default function PACalls() {
  const [rows, setRows] = useState<any[]>([]);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState({ broker: "", from: "", to: "", direction: "", status: "", search: "" });
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("planipret_profiles").select("user_id, full_name").order("full_name");
      setBrokers(data ?? []);
    })();
  }, []);

  const load = async () => {
    let q = supabase.from("planipret_phone_calls")
      .select("*, planipret_profiles!inner(full_name)")
      .order("started_at", { ascending: false }).limit(500);
    if (filters.broker) q = q.eq("user_id", filters.broker);
    if (filters.from) q = q.gte("started_at", filters.from);
    if (filters.to) q = q.lte("started_at", filters.to);
    if (filters.direction) q = q.eq("direction", filters.direction);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.search) q = q.or(`from_number.ilike.%${filters.search}%,to_number.ilike.%${filters.search}%`);
    const { data } = await q;
    setRows(data ?? []);
    setPage(1);
  };

  useEffect(() => { load(); }, [filters.broker, filters.from, filters.to, filters.direction, filters.status, filters.search]);

  const paged = useMemo(() => rows.slice((page - 1) * PAGE, page * PAGE), [rows, page]);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE));

  const exportCsv = () => {
    const headers = ["Courtier", "Direction", "De", "Vers", "Durée", "Date"];
    const lines = [headers.join(",")].concat(rows.map((r) =>
      [r.planipret_profiles?.full_name, r.direction, r.from_number, r.to_number, r.duration_seconds, r.started_at].map((v) => `"${v ?? ""}"`).join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `appels-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow-sm p-4 flex flex-wrap items-end gap-2">
        <Select label="Courtier" value={filters.broker} onChange={(v) => setFilters({ ...filters, broker: v })}
          options={[{ v: "", l: "Tous" }, ...brokers.map((b) => ({ v: b.user_id, l: b.full_name }))]} />
        <Input label="Date début" type="date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
        <Input label="Date fin" type="date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
        <Select label="Direction" value={filters.direction} onChange={(v) => setFilters({ ...filters, direction: v })}
          options={[{ v: "", l: "Toutes" }, { v: "inbound", l: "Entrant" }, { v: "outbound", l: "Sortant" }, { v: "missed", l: "Manqué" }]} />
        <Select label="Statut" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
          options={[{ v: "", l: "Tous" }, { v: "completed", l: "Complété" }, { v: "active", l: "Actif" }, { v: "missed", l: "Manqué" }]} />
        <Input label="Recherche" placeholder="Numéro..." value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} />
        <button onClick={exportCsv} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-sm">
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 text-left">
            <tr><th className="p-3">Courtier</th><th>Dir.</th><th>De</th><th>Vers</th><th>Durée</th><th>Date</th><th>Enreg.</th><th>IA</th><th></th></tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center text-slate-400">Aucun appel</td></tr>
            ) : paged.map((c) => {
              const inb = c.direction === "inbound", missed = c.direction === "missed";
              const Icon = missed ? X : inb ? ArrowDownLeft : ArrowUpRight;
              const col = missed ? "#E74C3C" : inb ? "#2E86C1" : "#27AE60";
              return (
                <tr key={c.id} className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer" onClick={() => setDetail(c)}>
                  <td className="p-3">{c.planipret_profiles?.full_name ?? "—"}</td>
                  <td><Icon className="w-4 h-4" style={{ color: col }} /></td>
                  <td className="text-slate-600">{c.from_number ?? "—"}</td>
                  <td className="text-slate-600">{c.to_number ?? "—"}</td>
                  <td className="text-slate-500">{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : "—"}</td>
                  <td className="text-slate-400 text-xs">{c.started_at ? new Date(c.started_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) : ""}</td>
                  <td>{c.recording_url && <Mic className="w-3.5 h-3.5 text-slate-500" />}</td>
                  <td>{c.ai_summary && <Sparkles className="w-3.5 h-3.5" style={{ color: "#8B5CF6" }} />}</td>
                  <td><button className="p-1.5 rounded hover:bg-slate-100"><Eye className="w-3.5 h-3.5" /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
          <span>Affichage {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} sur {rows.length} appels</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 border rounded disabled:opacity-40">←</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 border rounded disabled:opacity-40">→</button>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onClick={() => setDetail(null)}>
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Détails de l'appel</h3>
              <button onClick={() => setDetail(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <Row k="Courtier" v={detail.planipret_profiles?.full_name} />
              <Row k="Direction" v={detail.direction} />
              <Row k="De" v={detail.from_number} />
              <Row k="Vers" v={detail.to_number} />
              <Row k="Durée" v={detail.duration_seconds ? `${detail.duration_seconds}s` : "—"} />
              <Row k="Date" v={detail.started_at ? new Date(detail.started_at).toLocaleString("fr-CA") : ""} />
              {detail.recording_url && (
                <div><p className="text-xs text-slate-500 mb-1">Enregistrement</p><audio src={detail.recording_url} controls className="w-full" /></div>
              )}
              {detail.transcript && (
                <div><p className="text-xs text-slate-500 mb-1">Transcription</p><div className="text-xs bg-slate-50 p-3 rounded whitespace-pre-wrap">{detail.transcript}</div></div>
              )}
              {detail.ai_summary && (
                <div><p className="text-xs text-slate-500 mb-1">Résumé IA</p><div className="text-xs bg-purple-50 p-3 rounded">{detail.ai_summary}</div></div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Input({ label, type = "text", value, onChange, placeholder }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] text-slate-500 mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm" />
    </div>
  );
}
function Select({ label, value, onChange, options }: any) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] text-slate-500 mb-1">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm bg-white">
        {options.map((o: any) => <option key={o.v} value={o.v}>{o.l}</option>)}
      </select>
    </div>
  );
}
function Row({ k, v }: any) { return <div className="flex justify-between border-b border-slate-100 pb-1"><span className="text-slate-500">{k}</span><span className="text-slate-800">{v ?? "—"}</span></div>; }
