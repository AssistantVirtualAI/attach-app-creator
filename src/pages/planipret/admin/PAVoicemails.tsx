import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Play, X, Check } from "lucide-react";
import { toast } from "sonner";

const ACCENT = "#2E9BDC";

const PAGE = 50;

export default function PAVoicemails() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<any | null>(null);

  const load = async (p = page) => {
    const fromIdx = (p - 1) * PAGE;
    const { data, count } = await supabase.from("planipret_voicemails")
      .select("*, planipret_profiles!inner(full_name)", { count: "exact" })
      .order("created_at", { ascending: false })
      .range(fromIdx, fromIdx + PAGE - 1);
    setRows(data ?? []);
    setTotal(count ?? 0);
  };

  useEffect(() => { load(page); /* eslint-disable-next-line */ }, [page]);

  useEffect(() => {
    const ch = supabase.channel("admin-voicemails")
      .on("postgres_changes", { event: "*", schema: "public", table: "planipret_voicemails" }, () => load(1))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);


  const markRead = async (v: any) => {
    const next = !v.is_read;
    setRows((p) => p.map((r) => r.id === v.id ? { ...r, is_read: next } : r));
    const { error } = await supabase.from("planipret_voicemails").update({ is_read: next }).eq("id", v.id);
    if (error) { toast.error("Erreur"); load(); } else { toast.success(next ? "Marqué lu" : "Marqué non lu"); }
  };

  return (
    <div className="space-y-4">
      <div className="pp-card overflow-hidden">
        <table className="w-full text-sm">
          <thead style={{ background: "var(--pp-bg-elevated)" }}>
            <tr style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em", color: "var(--pp-text-faint)" }} className="text-left">
              <th className="p-3">Courtier</th><th>De</th><th>Durée</th><th>Date</th><th>Statut</th><th>Transcription</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? <tr><td colSpan={7} className="p-8 text-center" style={{ color: "var(--pp-text-faint)" }}>Aucun voicemail</td></tr> :
              rows.map((v) => (
                <tr key={v.id} className="hover:bg-white/[0.02]" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
                  <td className="p-3" style={{ color: "var(--pp-text-primary)" }}>{v.planipret_profiles?.full_name ?? "—"}</td>
                  <td style={{ color: "var(--pp-text-secondary)" }}>{v.from_number ?? "—"}</td>
                  <td style={{ color: "var(--pp-text-muted)" }}>{v.duration_seconds ? `${v.duration_seconds}s` : "—"}</td>
                  <td style={{ fontSize: 11, color: "var(--pp-text-faint)" }}>{new Date(v.created_at).toLocaleString("fr-CA")}</td>
                  <td>
                    {v.is_read ? (
                      <span className="pp-pill-success" style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99 }}>Lu</span>
                    ) : (
                      <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 99, background: `${ACCENT}20`, color: ACCENT, border: `1px solid ${ACCENT}40` }}>● Nouveau</span>
                    )}
                  </td>
                  <td className="truncate max-w-[220px]" style={{ color: "var(--pp-text-muted)", fontSize: 12 }}>{v.transcript ? v.transcript.slice(0, 50) + "…" : "—"}</td>
                  <td className="flex items-center gap-1 p-3">
                    <button onClick={() => setDetail(v)} className="p-1.5 rounded hover:bg-white/[0.05]" title="Écouter">
                      <Play className="w-3.5 h-3.5" style={{ color: ACCENT }} />
                    </button>
                    <button onClick={() => markRead(v)} className="p-1.5 rounded hover:bg-white/[0.05]" title={v.is_read ? "Marquer non lu" : "Marquer lu"}>
                      <Check className="w-3.5 h-3.5" style={{ color: v.is_read ? "var(--pp-text-faint)" : "var(--pp-success)" }} />
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-4 py-3" style={{ borderTop: "1px solid var(--pp-bg-border-2)", fontSize: 11, color: "var(--pp-text-muted)" }}>
          <span>{total === 0 ? 0 : (page - 1) * PAGE + 1}–{Math.min(page * PAGE, total)} sur {total}</span>
          <div className="flex gap-1">
            <button disabled={page === 1} onClick={() => setPage(page - 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>←</button>
            <span className="px-3 py-1">{page} / {Math.max(1, Math.ceil(total / PAGE))}</span>
            <button disabled={page >= Math.ceil(total / PAGE)} onClick={() => setPage(page + 1)} className="px-2 py-1 rounded disabled:opacity-40" style={{ border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}>→</button>
          </div>
        </div>

      </div>
      {detail && (
        <div className="fixed inset-0 z-50 bg-black/60 flex justify-end" onClick={() => setDetail(null)}>
          <div className="h-full w-full max-w-md overflow-y-auto p-5" style={{ background: "var(--pp-bg-surface)", borderLeft: "1px solid var(--pp-bg-border-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 style={{ fontWeight: 600, color: "var(--pp-text-primary)" }}>Voicemail · {detail.from_number}</h3>
              <button onClick={() => setDetail(null)}><X className="w-4 h-4" style={{ color: "var(--pp-text-muted)" }} /></button>
            </div>
            {detail.audio_url ? <audio src={detail.audio_url} controls className="w-full mb-4" /> : <p style={{ fontSize: 11, color: "var(--pp-text-faint)", marginBottom: 16 }}>Audio non disponible</p>}
            {detail.transcript && <div className="p-3 rounded text-sm whitespace-pre-wrap" style={{ background: "var(--pp-bg-elevated)", color: "var(--pp-text-secondary)" }}>{detail.transcript}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
