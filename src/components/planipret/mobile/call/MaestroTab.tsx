import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Building2, CheckCircle2, Clock, ExternalLink, Loader2, Send, User } from "lucide-react";
import { Link } from "react-router-dom";

type NextAction = { title?: string; description?: string; due?: string; type?: string } | string;

type MaestroCall = {
  id: string;
  maestro_synced?: boolean | null;
  maestro_client_id?: string | null;
  ai_summary?: string | null;
  ai_summary_short?: string | null;
  ai_analysis_json?: any;
  next_actions?: any;
  metadata?: any;
};

function extractNextActions(call: MaestroCall): NextAction[] {
  const na = call.next_actions;
  if (Array.isArray(na)) return na;
  const aij = call.ai_analysis_json ?? {};
  const ns = aij?.summary?.next_steps ?? aij?.next_actions ?? aij?.next_steps;
  if (Array.isArray(ns)) return ns;
  const meta = call.metadata ?? {};
  if (Array.isArray(meta.ai_tasks)) return meta.ai_tasks;
  return [];
}

export default function MaestroTab({ call, onUpdated }: { call: MaestroCall; onUpdated: () => void }) {
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [pushing, setPushing] = useState(false);
  const [syncLog, setSyncLog] = useState<any[]>([]);
  const [maestroClient, setMaestroClient] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("planipret_integration_config")
        .select("provider,is_active")
        .eq("provider", "maestro")
        .maybeSingle();
      setConfigured(!!(data as any)?.is_active);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("planipret_maestro_sync_log")
        .select("*")
        .eq("call_id", call.id)
        .order("created_at", { ascending: false })
        .limit(10);
      setSyncLog((data as any[]) ?? []);
    })();
  }, [call.id]);

  useEffect(() => {
    if (!call.maestro_client_id) { setMaestroClient(null); return; }
    (async () => {
      const { data } = await supabase
        .from("planipret_maestro_clients")
        .select("*")
        .eq("maestro_client_id", call.maestro_client_id!)
        .maybeSingle();
      setMaestroClient(data);
    })();
  }, [call.maestro_client_id]);

  const nextActions = extractNextActions(call);

  const pushToMaestro = async () => {
    setPushing(true);
    const { data, error } = await supabase.functions.invoke("maestro-pipeline-orchestrator", {
      body: { call_id: call.id, actions: nextActions },
    });
    setPushing(false);
    if (error || (data as any)?.success === false) {
      toast.error((data as any)?.error ?? error?.message ?? "Échec sync Maestro");
      return;
    }
    toast.success("Poussé vers Maestro ✅");
    onUpdated();
  };

  // Not configured
  if (configured === false) {
    return (
      <div className="pp-card p-4 flex flex-col items-center text-center">
        <Building2 className="w-8 h-8 mb-2" style={{ color: "var(--pp-text-muted)" }} />
        <div className="text-sm font-semibold mb-1" style={{ color: "var(--pp-text-primary)" }}>Maestro non configuré</div>
        <div className="text-xs mb-3" style={{ color: "var(--pp-text-secondary)" }}>
          Connectez Maestro pour synchroniser automatiquement clients, tâches et calendrier.
        </div>
        <Link
          to="/planipret/integrations"
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{ background: "var(--pp-brand-accent-2)", color: "white" }}
        >
          <ExternalLink className="w-3.5 h-3.5" /> Configurer
        </Link>
      </div>
    );
  }

  return (
    <>
      {/* Status */}
      <div className="pp-card p-4">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider" style={{ color: "var(--pp-text-secondary)" }}>Statut sync</div>
          <span className="text-[11px] px-2 py-0.5 rounded-full font-semibold inline-flex items-center gap-1" style={{
            background: call.maestro_synced ? "rgba(0,212,170,0.15)" : "rgba(245,166,35,0.15)",
            color: call.maestro_synced ? "var(--pp-success)" : "var(--pp-warning)",
          }}>
            {call.maestro_synced ? <><CheckCircle2 className="w-3 h-3" /> Synchronisé</> : <><Clock className="w-3 h-3" /> En attente</>}
          </span>
        </div>

        {/* Linked client */}
        {maestroClient ? (
          <div className="mt-3 rounded-lg p-2.5 flex items-start gap-2" style={{ background: "var(--pp-bg-elevated)" }}>
            <User className="w-4 h-4 mt-0.5" style={{ color: "var(--pp-brand-accent-2)" }} />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate" style={{ color: "var(--pp-text-primary)" }}>
                {maestroClient.first_name} {maestroClient.last_name}
              </div>
              <div className="text-[11px] truncate" style={{ color: "var(--pp-text-muted)" }}>
                {maestroClient.email ?? maestroClient.phone ?? maestroClient.maestro_client_id}
              </div>
            </div>
          </div>
        ) : call.maestro_client_id ? (
          <div className="text-xs mt-2" style={{ color: "var(--pp-text-secondary)" }}>
            Client : <span style={{ color: "var(--pp-text-primary)", fontFamily: "monospace" }}>{String(call.maestro_client_id).slice(0, 12)}</span>
          </div>
        ) : (
          <div className="text-xs mt-2" style={{ color: "var(--pp-text-muted)" }}>Aucun client Maestro lié</div>
        )}

        {/* Push CTA */}
        {!call.maestro_synced && (call.ai_summary || call.ai_summary_short) && (
          <button
            onClick={pushToMaestro}
            disabled={pushing}
            className="mt-3 w-full py-2.5 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, var(--pp-brand-accent-2), var(--pp-brand-accent))" }}
          >
            {pushing ? <><Loader2 className="w-4 h-4 animate-spin" /> Envoi…</> : <><Send className="w-4 h-4" /> Pousser vers Maestro</>}
          </button>
        )}
      </div>

      {/* Next actions */}
      {nextActions.length > 0 && (
        <div className="pp-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--pp-text-secondary)" }}>Actions à créer</div>
          <ul className="space-y-2">
            {nextActions.map((a, i) => {
              const title = typeof a === "string" ? a : (a.title ?? a.description ?? "Action");
              const due = typeof a === "object" ? a.due : undefined;
              const type = typeof a === "object" ? a.type : undefined;
              return (
                <li key={i} className="rounded-lg p-2.5 flex items-start gap-2" style={{ background: "var(--pp-bg-elevated)" }}>
                  <div className="mt-0.5 w-1.5 h-1.5 rounded-full" style={{ background: "var(--pp-brand-accent-2)" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm" style={{ color: "var(--pp-text-primary)" }}>{title}</div>
                    <div className="text-[11px] mt-0.5" style={{ color: "var(--pp-text-muted)" }}>
                      {type && <span className="mr-2">#{type}</span>}
                      {due && <span>📅 {due}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Sync log */}
      {syncLog.length > 0 && (
        <div className="pp-card p-4">
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: "var(--pp-text-secondary)" }}>Journal de synchronisation</div>
          <ul className="space-y-1.5">
            {syncLog.map((l) => (
              <li key={l.id} className="text-[11px] flex items-center gap-2">
                <span
                  className="w-1.5 h-1.5 rounded-full shrink-0"
                  style={{ background: l.status === "success" || l.success ? "var(--pp-success)" : l.status === "error" ? "var(--pp-danger)" : "var(--pp-warning)" }}
                />
                <span style={{ color: "var(--pp-text-secondary)" }}>{l.action ?? l.operation ?? l.event_type}</span>
                <span className="ml-auto" style={{ color: "var(--pp-text-muted)" }}>
                  {new Date(l.created_at).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {configured === null && (
        <div className="text-xs text-center py-2" style={{ color: "var(--pp-text-muted)" }}>Vérification config…</div>
      )}
    </>
  );
}
