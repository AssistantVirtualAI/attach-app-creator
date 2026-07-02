import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, Loader2, CheckCircle2, XCircle, AlertCircle, Activity } from "lucide-react";
import { toast } from "sonner";

/**
 * NsSyncBar — barre unifiée de connectivité et rechargement NS-API.
 *
 * Utilisée par PAOverview / PAReports / PACalls / PAMessages / PARecordings.
 * Elle affiche l'état des endpoints NS-API (CDR/SMS/enregistrements),
 * offre un bouton « Recharger maintenant » (invalidation + refetch local)
 * et un bouton « Synchroniser NS-API » (déclenche pp-admin-ns-sync).
 */

type FeatureKey = "cdrs" | "messages" | "recordings" | "voicemails";
type FeatureStatus = "ok" | "empty" | "unavailable" | "error" | "unknown";

interface Feature {
  feature: FeatureKey;
  status: FeatureStatus;
  detail?: string;
  sample_count?: number;
  last_probed_at?: string | null;
}

const LABELS: Record<FeatureKey, string> = {
  cdrs: "CDR",
  messages: "SMS",
  recordings: "Enregistrements",
  voicemails: "Boîtes vocales",
};

const NS_DOMAIN = "planipret.ca";

function statusColor(s: FeatureStatus) {
  if (s === "ok") return "#00D4AA";
  if (s === "empty") return "#F5A623";
  if (s === "error" || s === "unavailable") return "#E84C4C";
  return "#6B7280";
}

function statusIcon(s: FeatureStatus) {
  if (s === "ok") return <CheckCircle2 className="w-3 h-3" style={{ color: statusColor(s) }} />;
  if (s === "empty") return <AlertCircle className="w-3 h-3" style={{ color: statusColor(s) }} />;
  if (s === "error" || s === "unavailable") return <XCircle className="w-3 h-3" style={{ color: statusColor(s) }} />;
  return <Activity className="w-3 h-3" style={{ color: statusColor(s) }} />;
}

export interface NsSyncBarProps {
  /** Fonctionnalités à afficher (par défaut cdrs+messages+recordings). */
  features?: FeatureKey[];
  /** Callback local (refetch de la page). */
  onReload?: () => void | Promise<void>;
  /** Libellé du bouton recharger (par défaut « Recharger »). */
  reloadLabel?: string;
}

export default function NsSyncBar({ features = ["cdrs", "messages", "recordings"], onReload, reloadLabel = "Recharger maintenant" }: NsSyncBarProps) {
  const [rows, setRows] = useState<Feature[]>([]);
  const [probing, setProbing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const { data } = await supabase
      .from("planipret_ns_server_capabilities")
      .select("feature, status, detail, sample_count, last_probed_at")
      .eq("domain", NS_DOMAIN)
      .in("feature", features);
    const map = new Map<string, Feature>();
    (data ?? []).forEach((r: any) => map.set(r.feature, r as Feature));
    setRows(features.map((f) => map.get(f) ?? { feature: f, status: "unknown" as FeatureStatus }));

    const { data: run } = await supabase
      .from("planipret_edge_function_runs")
      .select("finished_at, started_at")
      .eq("function_name", "pp-admin-ns-sync")
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (run) setLastSync(run.finished_at ?? run.started_at ?? null);
  }, [features.join(",")]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const probe = async () => {
    setProbing(true);
    try {
      const { error } = await supabase.functions.invoke("ns-debug-audit", { body: { mode: "capabilities", domain: NS_DOMAIN } });
      if (error) throw error;
      toast.success("Sonde NS-API terminée");
      await loadStatus();
    } catch (e: any) {
      toast.error(`Sonde échouée: ${e?.message ?? e}`);
    } finally {
      setProbing(false);
    }
  };

  const syncNow = async () => {
    setSyncing(true);
    const id = toast.loading("Synchronisation NS-API…");
    try {
      const { data, error } = await supabase.functions.invoke("pp-admin-ns-sync", { body: {} });
      if (error) throw error;
      const d = data as any;
      toast.success(`Synchro lancée · ${d?.extensions ?? d?.users_total ?? 0} extensions`, { id });
      await Promise.all([loadStatus(), onReload?.()]);
    } catch (e: any) {
      toast.error(`Échec sync: ${e?.message ?? e}`, { id });
    } finally {
      setSyncing(false);
    }
  };

  const reloadNow = async () => {
    setReloading(true);
    try {
      await onReload?.();
      await loadStatus();
    } finally {
      setReloading(false);
    }
  };

  // Refetch on window focus + toutes les 60s.
  useEffect(() => {
    const onFocus = () => { onReload?.(); loadStatus(); };
    window.addEventListener("focus", onFocus);
    const t = window.setInterval(() => { onReload?.(); }, 60_000);
    return () => { window.removeEventListener("focus", onFocus); window.clearInterval(t); };
  }, [onReload, loadStatus]);

  return (
    <div
      className="pp-card p-3 flex flex-wrap items-center gap-3"
      style={{ background: "var(--pp-bg-elevated)", border: "1px solid var(--pp-bg-border-2)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--pp-text-muted)" }}>NS-API</span>
        <div className="flex items-center gap-2">
          {rows.map((r) => (
            <span
              key={r.feature}
              title={`${r.detail ?? r.status}${r.sample_count ? ` · ${r.sample_count} échantillons` : ""}${r.last_probed_at ? ` · ${new Date(r.last_probed_at).toLocaleString("fr-CA")}` : ""}`}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px]"
              style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}
            >
              {statusIcon(r.status)}
              {LABELS[r.feature]}
            </span>
          ))}
        </div>
      </div>

      {lastSync && (
        <span className="text-[10px]" style={{ color: "var(--pp-text-faint)" }}>
          Dernière sync : {new Date(lastSync).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
        </span>
      )}

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={probe}
          disabled={probing}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
          style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-secondary)" }}
        >
          {probing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />} Tester connectivité
        </button>
        <button
          onClick={reloadNow}
          disabled={reloading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs disabled:opacity-50"
          style={{ background: "var(--pp-bg-surface)", border: "1px solid var(--pp-bg-border-2)", color: "var(--pp-text-primary)" }}
        >
          {reloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} {reloadLabel}
        </button>
        <button
          onClick={syncNow}
          disabled={syncing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ background: "#2E9BDC" }}
        >
          {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />} Synchroniser NS-API
        </button>
      </div>
    </div>
  );
}
