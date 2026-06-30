import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Sparkles, RefreshCw, X, Download, Play } from "lucide-react";

const ACCENT = "#2E9BDC";
const AGENT = "#9B7FE8";
const PAGE = 50;

export default function PARecordings() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<any | null>(null);
  const [transcribing, setTranscribing] = useState<string | null>(null);

  const brokerName = (r: any) => r.planipret_profiles?.full_name ?? r.metadata?.ns_user?.name ?? r.metadata?.user_name ?? r.metadata?.extension_name ?? (r.extension ? `Ext. ${r.extension}` : "—");

  const load = async (p = page) => {
    setLoading(true);
    const fromIdx = (p - 1) * PAGE;
    let q = supabase
      .from("planipret_phone_calls")
      .select("*, planipret_profiles(full_name, extension)", { count: "exact" })
      .not("recording_url", "is", null)
      .order("started_at", { ascending: false })
      .range(fromIdx, fromIdx + PAGE - 1);
    if (search) q = q.or(`from_number.ilike.%${search}%,to_number.ilike.%${search}%,extension.ilike.%${search}%`);
    const { data, count } = await q;
    setRows(data ?? []);
    setTotal(count ?? 0);
    setLoading(false);
  };

  useEffect(() => { setPage(1); load(1); /* eslint-disable-next-line */ }, [search]);
  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  useEffect(() => {
    const ch = supabase.channel("admin-recordings")
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_phone_calls" }, () => load(page))
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
      await load(1);
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
      await load(page);
    } catch (e: any) {
      toast.error(`Transcription échouée: ${e.message ?? e}`);
    } finally {
      setTranscribing(null);
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / PAGE));
  const inputStyle = { background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-primary)" };

  return (
    <div className="space-y-4">
      <div className="pp-card p-4 flex items-center gap-3 flex-wrap">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Rechercher numéro ou extension…"
          className="px-3 py-2 rounded-lg text-sm w-72"
          style={inputStyle as any}
        />
        <button
          onClick={syncAll}
          disabled={syncing}
          className="ml-auto flex items-center gap-1.5 px-3 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
          style={{ background: ACCENT }}
        >
          <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Synchronisation…" : "Synchroniser NS-API (tous courtiers)"}
        </button>
      </div>

      <div className="pp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--pp-bg-elevated)" }}>
            <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)" }} className="text-left">
              <th className="p-3">Courtier</th><th>Ext.</th><th>De</th><th>Vers</th><th>Durée</th><th>Date</th><th>Transcription</th><th>IA</th><th></th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={9} className="p-8 text-center" style={{ color: "var(--pp-text-faint)" }}>Chargement…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={9} className="p-8 text-center" style={{ color: "var(--pp-text-faint)" }}>
                Aucun enregistrement. Cliquez sur « Synchroniser NS-API » pour récupérer les enregistrements de tous les courtiers.
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
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--pp-bg-border-2)", fontSize: 11, color: "var(--pp-text-muted)" }}>
          <span>{total === 0 ? 0 : (page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} sur {total} enregistrement(s)</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>←</button>
            <span className="px-3 py-1">{page} / {totalPages}</span>
            <button disabled={page === totalPages} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>→</button>
          </div>
        </div>
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
