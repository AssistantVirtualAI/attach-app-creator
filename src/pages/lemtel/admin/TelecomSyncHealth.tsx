import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Activity } from "lucide-react";
import { useOrganization } from "@/context/OrganizationContext";
import { toast } from "@/hooks/use-toast";

interface HealthRow {
  source: string;
  status: string;
  last_success_at: string | null;
  last_error_at: string | null;
  last_error: string | null;
  metadata: unknown;
}

interface JobRow {
  id: string;
  source: string;
  target: string;
  status: string;
  started_at: string;
  finished_at: string | null;
  rows_in: number | null;
  error: string | null;
}

const SYNC_FUNCTIONS = [
  { fn: "pbx-sync-extensions", label: "Extensions" },
  { fn: "pbx-sync-cdr", label: "Call records" },
  { fn: "pbx-sync-voicemail", label: "Voicemail" },
  { fn: "pbx-sync-recordings", label: "Recordings" },
  { fn: "pbx-reconcile", label: "Reconcile" },
];

export default function TelecomSyncHealth() {
  const { selectedOrgId } = useOrganization();
  const [health, setHealth] = useState<HealthRow[]>([]);
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    if (!selectedOrgId) return;
    const [h, j] = await Promise.all([
      supabase.from("telecom_sync_health").select("*").eq("organization_id", selectedOrgId),
      supabase.from("telecom_sync_jobs").select("*").eq("organization_id", selectedOrgId)
        .order("started_at", { ascending: false }).limit(20),
    ]);
    setHealth((h.data ?? []) as HealthRow[]);
    setJobs((j.data ?? []) as JobRow[]);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel("sync-health")
      .on("postgres_changes", { event: "*", schema: "public", table: "telecom_sync_jobs" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "telecom_sync_health" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId]);

  const runNow = async (fn: string) => {
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke(fn, {
        body: { organizationId: selectedOrgId },
      });
      if (error) throw error;
      toast({ title: `Triggered ${fn}` });
      await refresh();
    } catch (e) {
      toast({ title: "Sync failed", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const statusColor = (s: string) =>
    s === "healthy" ? "default" : s === "stale" ? "destructive" : "secondary";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Activity className="h-6 w-6" /> Telecom Sync Health
          </h1>
          <p className="text-sm text-muted-foreground">FusionPBX sync heartbeats and recent jobs.</p>
        </div>
        <Button onClick={refresh} variant="outline" size="sm">
          <RefreshCw className="h-4 w-4 mr-2" /> Refresh
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SYNC_FUNCTIONS.map((sf) => {
          const h = health.find((x) => x.source === sf.label.toLowerCase().split(" ")[0]);
          return (
            <Card key={sf.fn}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-base">{sf.label}</CardTitle>
                <Badge variant={statusColor(h?.status ?? "unknown")}>{h?.status ?? "unknown"}</Badge>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Last success: {h?.last_success_at ? new Date(h.last_success_at).toLocaleString() : "never"}
                </p>
                {h?.last_error && <p className="text-xs text-destructive truncate">{h.last_error}</p>}
                <Button size="sm" onClick={() => runNow(sf.fn)} disabled={loading} className="w-full">
                  Run now
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader><CardTitle>Recent sync jobs</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 text-sm">
            {jobs.length === 0 && <p className="text-muted-foreground">No sync jobs yet.</p>}
            {jobs.map((j) => (
              <div key={j.id} className="flex justify-between border-b py-2">
                <div>
                  <span className="font-mono text-xs">{j.target}</span>
                  <span className="text-muted-foreground ml-2">{new Date(j.started_at).toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center gap-2">
                  {j.rows_in != null && <span className="text-xs text-muted-foreground">{j.rows_in} rows</span>}
                  <Badge variant={j.status === "success" ? "default" : j.status === "error" ? "destructive" : "secondary"}>
                    {j.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
