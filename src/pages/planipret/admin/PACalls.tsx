import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ArrowDownLeft, ArrowUpRight, X, Mic, Sparkles, Download, Eye } from "lucide-react";

const PAGE = 50;
const ACCENT = "#2E9BDC";
const SUCCESS = "#00D4AA";
const DANGER = "#E84C4C";
const AGENT = "#9B7FE8";

export default function PACalls() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ broker: "", from: "", to: "", direction: "", status: "", search: "" });
  const [detail, setDetail] = useState<any | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("planipret_profiles").select("user_id, full_name").order("full_name");
      setBrokers(data ?? []);
    })();
  }, []);

  const load = async (p = page) => {
    setLoading(true);
    const fromIdx = (p - 1) * PAGE;
    const toIdx = fromIdx + PAGE - 1;
    let q = supabase.from("planipret_phone_calls")
      .select("*, planipret_profiles!inner(full_name)", { count: "exact" })
      .order("started_at", { ascending: false })
      .range(fromIdx, toIdx);
    if (filters.broker) q = q.eq("user_id", filters.broker);
    if (filters.from) q = q.gte("started_at", filters.from);
    if (filters.to) q = q.lte("started_at", filters.to);
    if (filters.direction) q = q.eq("direction", filters.direction);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.search) q = q.or(`from_number.ilike.%${filters.search}%,to_number.ilike.%${filters.search}%`);
    const { data, count } = await q;
    setRows(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => {
    setPage(1);
    load(1);
    const ch = supabase.channel("admin-calls")
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_phone_calls" }, () => load(1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.broker, filters.from, filters.to, filters.direction, filters.status, filters.search]);

  useEffect(() => { load(page); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const paged = rows;
  const totalPages = Math.max(1, Math.ceil(total / PAGE));


  const exportCsv = async () => {
    let q = supabase.from("planipret_phone_calls").select("*, planipret_profiles!inner(full_name)").order("started_at", { ascending: false }).limit(5000);
    if (filters.broker) q = q.eq("user_id", filters.broker);
    if (filters.from) q = q.gte("started_at", filters.from);
    if (filters.to) q = q.lte("started_at", filters.to);
    if (filters.direction) q = q.eq("direction", filters.direction);
    if (filters.status) q = q.eq("status", filters.status);
    if (filters.search) q = q.or(`from_number.ilike.%${filters.search}%,to_number.ilike.%${filters.search}%`);
    const { data: all } = await q;
    const headers = ["Courtier", "Direction", "De", "Vers", "Durée", "Date"];
    const lines = [headers.join(",")].concat((all ?? []).map((r: any) =>
      [r.planipret_profiles?.full_name, r.direction, r.from_number, r.to_number, r.duration_seconds, r.started_at].map((v) => `"${v ?? ""}"`).join(",")
    ));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `appels-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="space-y-4">
      <div className="pp-card p-4 flex flex-wrap items-end gap-2">
        <Select label="Courtier" value={filters.broker} onChange={(v) => setFilters({ ...filters, broker: v })}
          options={[{ v: "", l: "Tous" }, ...brokers.map((b) => ({ v: b.user_id, l: b.full_name }))]} />
        <Input label="Date début" type="date" value={filters.from} onChange={(v) => setFilters({ ...filters, from: v })} />
        <Input label="Date fin" type="date" value={filters.to} onChange={(v) => setFilters({ ...filters, to: v })} />
        <Select label="Direction" value={filters.direction} onChange={(v) => setFilters({ ...filters, direction: v })}
          options={[{ v: "", l: "Toutes" }, { v: "inbound", l: "Entrant" }, { v: "outbound", l: "Sortant" }, { v: "missed", l: "Manqué" }]} />
        <Select label="Statut" value={filters.status} onChange={(v) => setFilters({ ...filters, status: v })}
          options={[{ v: "", l: "Tous" }, { v: "completed", l: "Complété" }, { v: "active", l: "Actif" }, { v: "missed", l: "Manqué" }]} />
        <Input label="Recherche" placeholder="Numéro..." value={filters.search} onChange={(v) => setFilters({ ...filters, search: v })} />
        <button onClick={exportCsv} className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm"
          style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
          <Download className="w-4 h-4" /> Exporter CSV
        </button>
      </div>

      <div className="pp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--pp-bg-elevated)" }}>
            <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)" }} className="text-left">
              <th className="p-3">Courtier</th><th>Dir.</th><th>De</th><th>Vers</th><th>Durée</th><th>Date</th><th>Enreg.</th><th>IA</th><th></th>
            </tr>
          </thead>
          <tbody>
            {paged.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center" style={{ color: "var(--pp-text-faint)" }}>Aucun appel</td></tr>
            ) : paged.map((c) => {
              const inb = c.direction === "inbound", missed = c.direction === "missed";
              const Icon = missed ? X : inb ? ArrowDownLeft : ArrowUpRight;
              const col = missed ? DANGER : inb ? ACCENT : SUCCESS;
              return (
                <tr key={c.id} className="cursor-pointer hover:bg-white/[0.02]"
                  style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                  onClick={() => setDetail(c)}>
                  <td className="p-3" style={{ color: "var(--pp-text-primary)" }}>{c.planipret_profiles?.full_name ?? "—"}</td>
                  <td><Icon className="w-4 h-4" style={{ color: col }} /></td>
                  <td style={{ color: "var(--pp-text-secondary)" }}>{c.from_number ?? "—"}</td>
                  <td style={{ color: "var(--pp-text-secondary)" }}>{c.to_number ?? "—"}</td>
                  <td style={{ color: "var(--pp-text-muted)" }}>{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--pp-text-faint)" }}>{c.started_at ? new Date(c.started_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) : ""}</td>
                  <td>{c.recording_url && <Mic className="w-3.5 h-3.5" style={{ color: "var(--pp-text-muted)" }} />}</td>
                  <td>{c.ai_summary && <Sparkles className="w-3.5 h-3.5" style={{ color: AGENT }} />}</td>
                  <td><button className="p-1.5 rounded hover:bg-white/[0.05]"><Eye className="w-3.5 h-3.5" style={{ color: "var(--pp-text-muted)" }} /></button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--pp-bg-border-2)", fontSize: 11, color: "var(--pp-text-muted)" }}>
          <span>Affichage {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, rows.length)} sur {rows.length} appels</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>←</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>→</button>
          </div>
        </div>
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--pp-bg-surface)", borderLeft: "1px solid var(--pp-bg-border-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Détails de l'appel</h3>
              <button onClick={() => setDetail(null)}><X className="w-4 h-4" style={{ color: "var(--pp-text-muted)" }} /></button>
            </div>
            <div className="space-y-3 text-sm">
              <Row k="Courtier" v={detail.planipret_profiles?.full_name} />
              <Row k="Direction" v={detail.direction} />
              <Row k="De" v={detail.from_number} />
              <Row k="Vers" v={detail.to_number} />
              <Row k="Durée" v={detail.duration_seconds ? `${detail.duration_seconds}s` : "—"} />
              <Row k="Date" v={detail.started_at ? new Date(detail.started_at).toLocaleString("fr-CA") : ""} />
              {detail.recording_url && (
                <div><p style={{ fontSize: 11, color: "var(--pp-text-muted)", marginBottom: 4 }}>Enregistrement</p><audio src={detail.recording_url} controls className="w-full" /></div>
              )}
              {detail.transcript && (
                <div><p style={{ fontSize: 11, color: "var(--pp-text-muted)", marginBottom: 4 }}>Transcription</p><div className="p-3 rounded whitespace-pre-wrap" style={{ fontSize: 11, background: "var(--pp-bg-elevated)", color: "var(--pp-text-secondary)" }}>{detail.transcript}</div></div>
              )}
              {detail.ai_summary && (
                <div><p style={{ fontSize: 11, color: "var(--pp-text-muted)", marginBottom: 4 }}>Résumé IA</p><div className="p-3 rounded" style={{ fontSize: 11, background: "rgba(155,127,232,0.08)", border: `1px solid ${AGENT}33`, color: "var(--pp-text-primary)" }}>{detail.ai_summary}</div></div>
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
      <label style={{ fontSize: 10, color: "var(--pp-text-muted)", marginBottom: 4 }}>{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
        className="px-3 py-1.5 rounded-lg text-sm"
        style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-primary)" }} />
    </div>
  );
}
function Select({ label, value, onChange, options }: any) {
  return (
    <div className="flex flex-col">
      <label style={{ fontSize: 10, color: "var(--pp-text-muted)", marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg text-sm"
        style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-primary)" }}>
        {options.map((o: any) => <option key={o.v} value={o.v} style={{ background: "var(--pp-bg-deep)" }}>{o.l}</option>)}
      </select>
    </div>
  );
}
function Row({ k, v }: any) {
  return (
    <div className="flex justify-between pb-1" style={{ borderBottom: "1px solid var(--pp-bg-border-2)" }}>
      <span style={{ color: "var(--pp-text-muted)" }}>{k}</span>
      <span style={{ color: "var(--pp-text-primary)" }}>{v ?? "—"}</span>
    </div>
  );
}
