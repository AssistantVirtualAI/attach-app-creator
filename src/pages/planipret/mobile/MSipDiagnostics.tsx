import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Copy, Trash2, RefreshCw, CheckCircle2, AlertTriangle, XCircle, Clock } from "lucide-react";
import { sipDiagnostics, type SipTrace } from "@/lib/planipret/sipDiagnostics";

const fmtDur = (ms: number) => ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`;

export default function MSipDiagnostics() {
  const navigate = useNavigate();
  const [traces, setTraces] = useState<SipTrace[]>(sipDiagnostics.list());
  const [openId, setOpenId] = useState<string | null>(traces[0]?.traceId ?? null);

  useEffect(() => {
    const unsub = sipDiagnostics.subscribe(() => setTraces([...sipDiagnostics.list()]));
    return unsub;
  }, []);

  const copy = async (traceId: string) => {
    const txt = sipDiagnostics.formatTrace(traceId);
    try {
      await navigator.clipboard.writeText(txt);
      toast.success("Trace copiée dans le presse-papier");
    } catch {
      toast.error("Copie impossible");
    }
  };

  const copyAll = async () => {
    const txt = traces.map((t) => sipDiagnostics.formatTrace(t.traceId)).join("\n\n=====\n\n");
    try { await navigator.clipboard.writeText(txt); toast.success(`${traces.length} traces copiées`); }
    catch { toast.error("Copie impossible"); }
  };

  const clear = () => {
    if (!confirm("Effacer tous les diagnostics ?")) return;
    sipDiagnostics.clear();
    setOpenId(null);
  };

  return (
    <div className="h-full flex flex-col" style={{ background: "var(--pp-bg-base)" }}>
      <header className="px-4 pt-5 pb-3 flex items-center gap-3" style={{ background: "var(--pp-bg-deep)", borderBottom: "1px solid var(--pp-bg-border)" }}>
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full" style={{ color: "var(--pp-text-secondary)" }} aria-label="Retour">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-bold flex-1" style={{ color: "var(--pp-text-primary)" }}>Diagnostics SIP</h1>
        <button onClick={copyAll} disabled={!traces.length} className="p-2 rounded-full disabled:opacity-40" style={{ color: "var(--pp-text-secondary)" }} aria-label="Copier tout">
          <Copy className="w-4 h-4" />
        </button>
        <button onClick={clear} disabled={!traces.length} className="p-2 rounded-full disabled:opacity-40" style={{ color: "var(--pp-danger)" }} aria-label="Effacer">
          <Trash2 className="w-4 h-4" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {traces.length === 0 ? (
          <div className="rounded-2xl p-6 text-center" style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}>
            <RefreshCw className="w-8 h-8 mx-auto mb-2" style={{ color: "var(--pp-text-muted)" }} />
            <p className="text-sm" style={{ color: "var(--pp-text-secondary)" }}>
              Aucune trace pour l'instant. Appuie sur le badge « en ligne / hors ligne » de l'accueil pour lancer une reconnexion et une trace apparaîtra ici.
            </p>
          </div>
        ) : (
          traces.map((tr) => {
            const open = openId === tr.traceId;
            const Icon = tr.outcome === "success" ? CheckCircle2 : tr.outcome === "failed" ? XCircle : tr.outcome === "aborted" ? AlertTriangle : Clock;
            const iconColor = tr.outcome === "success" ? "var(--pp-success)" : tr.outcome === "failed" ? "var(--pp-danger)" : tr.outcome === "aborted" ? "var(--pp-warning, #d1a13d)" : "var(--pp-brand-accent)";
            const duration = tr.finishedAt ? tr.finishedAt - tr.startedAt : Date.now() - tr.startedAt;
            return (
              <div key={tr.traceId} className="rounded-2xl overflow-hidden" style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)" }}>
                <button
                  onClick={() => setOpenId(open ? null : tr.traceId)}
                  className="w-full px-3 py-3 flex items-center gap-3 text-left"
                >
                  <Icon className="w-5 h-5 shrink-0" style={{ color: iconColor }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate" style={{ color: "var(--pp-text-primary)" }}>
                      {tr.traceId}
                      <span className="ml-2 text-[11px] font-normal" style={{ color: "var(--pp-text-muted)" }}>
                        {tr.outcome ?? "en cours"} · {fmtDur(duration)}
                      </span>
                    </div>
                    <div className="text-[11px]" style={{ color: "var(--pp-text-muted)" }}>
                      {new Date(tr.startedAt).toLocaleString()} · {tr.entries.length} entrées
                    </div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); copy(tr.traceId); }} className="p-1.5 rounded-full" style={{ color: "var(--pp-text-muted)" }} aria-label="Copier">
                    <Copy className="w-4 h-4" />
                  </button>
                </button>
                {open && (
                  <div className="px-3 pb-3">
                    <pre className="text-[11px] font-mono whitespace-pre-wrap break-words p-3 rounded-lg overflow-x-auto" style={{ background: "var(--pp-bg-elevated)", color: "var(--pp-text-primary)", border: "1px solid var(--pp-bg-border-2)", maxHeight: 400 }}>
{sipDiagnostics.formatTrace(tr.traceId)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
