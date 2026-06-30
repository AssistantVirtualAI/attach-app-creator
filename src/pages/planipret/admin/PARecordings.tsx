import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Sparkles, RefreshCw, X, Download, Play } from "lucide-react";
import Pagination from "@/components/planipret/admin/Pagination";
import DebugPanel, { type DebugEntry } from "@/components/planipret/admin/DebugPanel";
import { TableErrorState, TableEmptyState } from "@/components/planipret/admin/TableStates";
import { getPlanipretBrokerDirectory } from "@/lib/planipret/adminDirectory";

const ACCENT = "#2E9BDC";
const AGENT = "#9B7FE8";

export default function PARecordings() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const pageSizeRaw = parseInt(params.get("pageSize") ?? params.get("ps") ?? "25", 10);
  const pageSize = [25, 50, 100].includes(pageSizeRaw) ? pageSizeRaw : 25;
  const search = params.get("search") ?? "";
  const broker = params.get("broker") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const withTranscript = (params.get("transcript") ?? "") as "" | "yes" | "no";
  const updateParams = (patch: Record<string, string | null>, resetPage = false) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v == null || v === "") next.delete(k); else next.set(k, v); });
    if (resetPage) next.set("page", "1");
    setParams(next, { replace: true });
  };
  const setPage = (p: number) => updateParams({ page: String(p) });
  const setPageSize = (s: number) => updateParams({ pageSize: String(s), ps: null }, true);
  const setFilterValue = (key: "search" | "broker" | "from" | "to" | "transcript", value: string) => updateParams({ [key]: value }, true);
  const resetFilters = () => updateParams({ search: null, broker: null, from: null, to: null, transcript: null }, true);
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [brokers, setBrokers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [debug, setDebug] = useState<DebugEntry[]>([]);
  const [detail, setDetail] = useState<any | null>(null);
  const [transcribing, setTranscribing] = useState<string | null>(null);

  const hasFilters = !!(search || broker || from || to || withTranscript);
  const activeFilterCount = [search, broker, from, to, withTranscript].filter(Boolean).length;

  useEffect(() => {
    (async () => {
      const directory = await getPlanipretBrokerDirectory();
      setBrokers(directory.brokers);
    })();
  }, []);

  const brokerName = (r: any) => r.planipret_profiles?.full_name ?? r.metadata?.ns_user?.name ?? r.metadata?.user_name ?? r.metadata?.extension_name ?? (r.extension ? `Ext. ${r.extension}` : "—");

  const load = async (p = page, ps = pageSize) => {
    setLoading(true);
    setLoadError(null);
    const dbg: DebugEntry[] = [];
    const t0 = performance.now();
    const fromIdx = (p - 1) * ps;
    let q: any = supabase
      .from("planipret_phone_calls")
      .select("*, planipret_profiles(full_name, extension)", { count: "exact" })
      .not("recording_url", "is", null)
      .order("started_at", { ascending: false })
      .range(fromIdx, fromIdx + ps - 1);
    if (search) q = q.or(`from_number.ilike.%${search}%,to_number.ilike.%${search}%,extension.ilike.%${search}%`);
    if (broker?.startsWith("ext:")) q = q.eq("extension", broker.slice(4));
    else if (broker?.startsWith("user:")) q = q.eq("user_id", broker.slice(5));
    if (from) q = q.gte("started_at", from);
    if (to) q = q.lte("started_at", to);
    if (withTranscript === "yes") q = q.not("transcript", "is", null);
    if (withTranscript === "no") q = q.is("transcript", null);
    const { data, count, error } = await q;
    dbg.push({
      label: "planipret_phone_calls WHERE recording_url IS NOT NULL",
      query: `SELECT * FROM planipret_phone_calls WHERE recording_url IS NOT NULL ORDER BY started_at DESC LIMIT ${ps} OFFSET ${fromIdx}`,
      count,
      ms: Math.round(performance.now() - t0),
      error: error?.message ?? null,
      meta: { search, broker, from, to, withTranscript },
      sample: (data ?? []).slice(0, 3),
    });
    if (error) {
      setLoadError(error.message);
      setRows([]); setTotal(0);
    } else {
      setRows(data ?? []);
      setTotal(count ?? 0);
    }
    setDebug(dbg);
    setLoading(false);
  };

  useEffect(() => { load(page, pageSize); /* eslint-disable-next-line */ }, [page, pageSize, search, broker, from, to, withTranscript]);

  useEffect(() => {
    const ch = supabase.channel("admin-recordings")
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_phone_calls" }, () => load(page, pageSize))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  const syncAll = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pp-admin-ns-sync", { body: {} });
      if (error) throw error;
      const d = data as any;
      toast.success(`Synchro lancée: ${d.extensions ?? d.users_total ?? 0} ext · appels/enregistrements en arrière-plan`);
      await load(1, pageSize);
    } catch (e: any) {
      toast.error(`Synchro échouée: ${e.message ?? e}`);
    } finally {
      setSyncing(false);
    }
  };

  const transcribe = async (callId: string) => {
    setTranscribing(callId);
    try {
      const { error } = await supabase.functions.invoke("ai-transcribe-call", { body: { call_id: callId } });
      if (error) throw error;
      toast.success("Transcription lancée");
      await load(page, pageSize);
    } catch (e: any) {
      toast.error(`Transcription échouée: ${e.message ?? e}`);
    } finally {
      setTranscribing(null);
    }
  };

  const inputStyle = { background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-primary)" };

  return (
    <div className="space-y-4">
      <DebugPanel entries={debug} />

      <div className="pp-card p-4 flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={(e) => setFilterValue("search", e.target.value)}
          placeholder="Rechercher numéro ou extension…"
          className="px-3 py-2 rounded-lg text-sm w-64"
          style={inputStyle as any}
        />
        <select value={broker} onChange={(e) => setFilterValue("broker", e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle as any}>
          <option value="">Tous courtiers</option>
          {brokers.map((b: any) => (
            <option key={b.user_id} value={b.ns_only ? `ext:${b.extension}` : `user:${b.user_id}`}>
              {b.full_name}{b.extension ? ` · ${b.extension}` : ""}
            </option>
          ))}
        </select>
        <input type="date" value={from} onChange={(e) => setFilterValue("from", e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle as any} />
        <input type="date" value={to} onChange={(e) => setFilterValue("to", e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle as any} />
        <select value={withTranscript} onChange={(e) => setFilterValue("transcript", e.target.value)} className="px-3 py-2 rounded-lg text-sm" style={inputStyle as any}>
          <option value="">Transcription : tous</option>
          <option value="yes">Avec transcription</option>
          <option value="no">Sans transcription</option>
        </select>
        {hasFilters && (
          <button onClick={resetFilters} className="px-2 py-1.5 text-xs underline" style={{ color: "var(--pp-text-muted)" }}>
            ✕ Réinitialiser ({activeFilterCount})
          </button>
        )}
        <button
          onClick={syncAll}
          disabled={syncing}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation…" : "Synchroniser NS-API"}
        </button>
      </div>

      <div className="pp-card overflow-hidden">
        {loadError && <TableErrorState message={loadError} onRetry={() => load(page, pageSize)} />}
        <table className="w-full text-sm">
          <thead style={{ background: "var(--pp-bg-elevated)" }}>
            <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)" }} className="text-left">
              <th className="p-3">Courtier</th><th>Ext.</th><th>De</th><th>Vers</th><th>Durée</th><th>Date</th><th>Transcription</th><th>IA</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i} style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  {Array.from({ length: 9 }).map((_, j) => (
                    <td key={j} className="p-3"><div className="h-3 w-3/4 animate-pulse rounded" style={{ background: "var(--pp-bg-elevated)" }} /></td>
                  ))}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr><td colSpan={9}>
                <TableEmptyState
                  icon="📬"
                  title="Aucun enregistrement trouvé"
                  hint={hasFilters
                    ? "Essayez d'élargir vos critères de recherche."
                    : "Aucun enregistrement n'est encore synchronisé. Lancez « Synchroniser NS-API » ou vérifiez que les enregistrements sont activés dans la config NetSapiens."}
                  action={hasFilters ? (
                    <button onClick={resetFilters} className="px-3 py-1.5 rounded-lg text-xs font-medium text-white" style={{ background: ACCENT }}>Réinitialiser les filtres</button>
                  ) : (
                    <Link to="/planipret/admin/integrations" className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>
                      Aller aux intégrations →
                    </Link>
                  )}
                />
              </td></tr>
            ) : rows.map((c) => (
              <tr key={c.id} className="cursor-pointer hover:bg-white/[0.02]"
                style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}
                onClick={() => setDetail(c)}>
                <td className="p-3" style={{ color: "var(--pp-text-primary)" }}>{brokerName(c)}</td>
                <td style={{ color: "var(--pp-text-secondary)" }}>{c.extension ?? c.planipret_profiles?.extension ?? "—"}</td>
                <td style={{ color: "var(--pp-text-secondary)" }}>{c.from_number ?? "—"}</td>
                <td style={{ color: "var(--pp-text-secondary)" }}>{c.to_number ?? "—"}</td>
                <td style={{ color: "var(--pp-text-muted)" }}>{c.duration_seconds ? `${Math.floor(c.duration_seconds / 60)}m${c.duration_seconds % 60}s` : "—"}</td>
                <td style={{ fontSize: 11, color: "var(--pp-text-faint)" }}>{c.started_at ? new Date(c.started_at).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" }) : ""}</td>
                <td>
                  {c.transcript ? (
                    <span style={{ fontSize: 10, color: "var(--pp-success)" }}>● Disponible</span>
                  ) : (
                    <button
                      disabled={transcribing === c.id}
                      onClick={(e) => { e.stopPropagation(); transcribe(c.id); }}
                      className="px-2 py-1 rounded text-[10px]"
                      style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}
                    >
                      {transcribing === c.id ? "…" : "Transcrire"}
                    </button>
                  )}
                </td>
                <td>{c.ai_summary && <Sparkles className="w-3.5 h-3.5" style={{ color: AGENT }} />}</td>
                <td><Mic className="w-3.5 h-3.5" style={{ color: "var(--pp-text-muted)" }} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <Pagination
          page={page}
          pageSize={pageSize}
          total={total}
          loading={loading}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          unit="enregistrements"
        />
      </div>

      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto p-5"
            style={{ background: "var(--pp-bg-surface)", borderLeft: "1px solid var(--pp-bg-border-2)" }}
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Enregistrement</h3>
              <button onClick={() => setDetail(null)}><X className="w-4 h-4" style={{ color: "var(--pp-text-muted)" }} /></button>
            </div>
            <div className="space-y-3 text-sm" style={{ color: "var(--pp-text-secondary)" }}>
              <div>Courtier: <span style={{ color: "var(--pp-text-primary)" }}>{brokerName(detail)}</span></div>
              <div>Ext: {detail.extension ?? "—"}</div>
              <div>De: {detail.from_number ?? "—"} → Vers: {detail.to_number ?? "—"}</div>
              <div>Date: {detail.started_at ? new Date(detail.started_at).toLocaleString("fr-CA") : "—"}</div>
              {detail.recording_url ? (
                <div>
                  <p style={{ fontSize: 11, color: "var(--pp-text-muted)", marginBottom: 4 }}>Audio</p>
                  <audio src={detail.recording_url} controls className="w-full" />
                  <a href={detail.recording_url} download className="inline-flex items-center gap-1 mt-2 text-xs" style={{ color: ACCENT }}>
                    <Download className="w-3 h-3" /> Télécharger
                  </a>
                </div>
              ) : (
                <div style={{ color: "var(--pp-text-faint)" }}>Audio indisponible</div>
              )}
              {detail.transcript ? (
                <div>
                  <p style={{ fontSize: 11, color: "var(--pp-text-muted)", marginBottom: 4 }}>Transcription</p>
                  <div className="p-3 rounded-lg whitespace-pre-wrap" style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", fontSize: 12 }}>
                    {detail.transcript}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => transcribe(detail.id)}
                  disabled={transcribing === detail.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm"
                  style={{ background: ACCENT }}
                >
                  <Play className="w-3.5 h-3.5" />
                  {transcribing === detail.id ? "Transcription en cours…" : "Lancer la transcription IA"}
                </button>
              )}
              {detail.ai_summary && (
                <div>
                  <p style={{ fontSize: 11, color: "var(--pp-text-muted)", marginBottom: 4 }}>Résumé IA</p>
                  <div className="p-3 rounded-lg" style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", fontSize: 12 }}>
                    {detail.ai_summary}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
