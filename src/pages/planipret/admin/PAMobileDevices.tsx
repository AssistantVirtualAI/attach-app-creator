import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, RefreshCw, PhoneCall, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

type Row = {
  broker_id: string;
  full_name: string | null;
  email: string | null;
  ns_extension: string;
  ns_domain: string;
  ns_mobile_device_id: string | null;
  ns_widget_device_id: string | null;
  target_mobile_id: string;
  ns_mobile_exists: boolean;
  ns_widget_exists: boolean;
  ns_reachable: boolean;
  ns_status: number;
  has_vault_secret: boolean;
  provisioned_at: string | null;
  last_error: { at: string; details: any } | null;
  state: "ok" | "missing" | "error" | "partial";
};

type Stats = { total: number; ok: number; missing: number; error: number; partial: number };

function StatePill({ state }: { state: Row["state"] }) {
  if (state === "ok")
    return <Badge className="bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />OK</Badge>;
  if (state === "missing")
    return <Badge variant="destructive"><XCircle className="mr-1 h-3 w-3" />Manquant</Badge>;
  if (state === "error")
    return <Badge variant="destructive"><AlertTriangle className="mr-1 h-3 w-3" />Erreur</Badge>;
  return <Badge variant="secondary"><AlertTriangle className="mr-1 h-3 w-3" />Partiel</Badge>;
}

export default function PAMobileDevices() {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, ok: 0, missing: 0, error: 0, partial: 0 });
  const [filter, setFilter] = useState("");
  const [testBroker, setTestBroker] = useState<Row | null>(null);
  const [fromNumber, setFromNumber] = useState("");
  const [testing, setTesting] = useState(false);
  const [testSessionId, setTestSessionId] = useState<string | null>(null);
  const [testState, setTestState] = useState<string | null>(null);
  const [answeredBy, setAnsweredBy] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("pp-mobile-device-status", { body: {} });
    setLoading(false);
    if (error) { toast.error("Échec du rapport", { description: error.message }); return; }
    if (!data?.ok) { toast.error("Rapport invalide", { description: data?.error }); return; }
    setRows(data.rows ?? []);
    setStats(data.stats ?? { total: 0, ok: 0, missing: 0, error: 0, partial: 0 });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const backfill = useCallback(async () => {
    setBackfilling(true);
    const { data, error } = await supabase.functions.invoke("pp-backfill-mobile-devices", { body: {} });
    setBackfilling(false);
    if (error) { toast.error("Backfill échoué", { description: error.message }); return; }
    toast.success("Backfill terminé", {
      description: `Créés: ${data?.created ?? 0} · Ignorés: ${data?.skipped ?? 0} · Erreurs: ${data?.errors ?? 0}`,
    });
    refresh();
  }, [refresh]);

  const provisionAppReview = useCallback(async () => {
    if (!confirm("Créer l'utilisateur App Review (demo@avastatistic.ca, ext 1999) ?")) return;
    const { data, error } = await supabase.functions.invoke("pp-appreview-provision", { body: {} });
    if (error) { toast.error("Provision AppReview échouée", { description: error.message }); return; }
    if (!data?.success) { toast.error("Provision AppReview échouée", { description: data?.error || data?.detail || JSON.stringify(data) }); return; }
    const login = data.login;
    toast.success("App Review prêt", {
      description: `${login?.email} / ${login?.password} · ext ${login?.extension}@${login?.domain}`,
      duration: 20000,
    });
    try { await navigator.clipboard.writeText(`${login?.email} / ${login?.password}`); } catch { /* noop */ }
  }, []);

  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const provisionOne = useCallback(async (broker: Row) => {
    setProvisioningId(broker.broker_id);
    const { data, error } = await supabase.functions.invoke("ns-provision-broker-devices", {
      body: { broker_id: broker.broker_id, bulk: false },
    });
    setProvisioningId(null);
    if (error || !data?.success) {
      const msg = data?.result?.error || data?.result?.db_error || data?.error || error?.message || "Erreur inconnue";
      toast.error(`❌ ${broker.full_name}: ${msg}`);
      return;
    }
    toast.success(`✅ ${broker.full_name}: appareils créés`);
    refresh();
  }, [refresh]);

  const [bulkProvisioning, setBulkProvisioning] = useState(false);
  const provisionAll = useCallback(async () => {
    const missing = rows.filter((r) => r.state === "missing" || r.state === "partial").length;
    if (!confirm(`Créer les appareils SIP pour ${missing || "tous les"} courtiers manquants ? Cela peut prendre plusieurs minutes.`)) return;
    setBulkProvisioning(true);
    const { data, error } = await supabase.functions.invoke("ns-provision-broker-devices", {
      body: { bulk: true, batch_size: 8 },
    });
    setBulkProvisioning(false);
    if (error || !data?.success) {
      toast.error("Provisionnement bulk échoué", { description: data?.error || error?.message });
      return;
    }
    toast.success(`Bulk terminé: ${data.succeeded}/${data.total} réussis · ${data.failed} échoués`);
    refresh();
  }, [rows, refresh]);

  const startTest = useCallback(async () => {
    if (!testBroker) return;
    setTesting(true);
    setTestState("Déclenchement…");
    setAnsweredBy(null);
    const { data, error } = await supabase.functions.invoke("pp-mobile-testcall", {
      body: { broker_id: testBroker.broker_id, from_number: fromNumber || undefined },
    });
    setTesting(false);
    if (error || !data?.ok) {
      toast.error("Appel test échoué", { description: error?.message || data?.error });
      setTestState(`Échec (${data?.ns_status ?? ""})`);
      return;
    }
    setTestSessionId(data.test_session_id);
    setTestState("Sonne sur les deux appareils…");
    toast.success("Appel test lancé", { description: data.tip });
  }, [testBroker, fromNumber]);

  // Realtime: watch the test session to prove parallel ring + collision handling.
  useEffect(() => {
    if (!testSessionId) return;
    const ch = supabase
      .channel(`test-call-${testSessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "planipret_call_sessions", filter: `call_id=eq.${testSessionId}` },
        (payload: any) => {
          const r = payload.new ?? payload.old ?? {};
          setAnsweredBy(r.answered_by ?? null);
          if (r.state === "active") setTestState(`Répondu par ${r.answered_by ?? "?"}`);
          else if (r.state === "ended") setTestState(`Terminé (${r.ended_reason ?? "ok"})`);
          else if (r.state === "ringing") setTestState("Sonne sur les deux appareils…");
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [testSessionId]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      [r.full_name, r.email, r.ns_extension, r.ns_mobile_device_id, r.ns_widget_device_id]
        .filter(Boolean).some((v) => String(v).toLowerCase().includes(q)),
    );
  }, [rows, filter]);

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Vérification devices mobiles</h1>
          <p className="text-sm text-muted-foreground">
            État du device <code>{"{ext}_mobile"}</code> côté NetSapiens pour chaque courtier, indépendant du widget Maestro.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Rafraîchir
          </Button>
          <Button size="sm" onClick={backfill} disabled={backfilling}>
            {backfilling ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Provisionner manquants
          </Button>
          <Button size="sm" onClick={provisionAll} disabled={bulkProvisioning} variant="default">
            {bulkProvisioning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            🔧 Provisionner tous
          </Button>
          <Button size="sm" variant="secondary" onClick={provisionAppReview}>
            🍎 App Review User
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { k: "total", label: "Total" },
          { k: "ok", label: "OK" },
          { k: "missing", label: "Manquants" },
          { k: "partial", label: "Partiels" },
          { k: "error", label: "Erreurs" },
        ].map((s) => (
          <Card key={s.k}>
            <CardHeader className="pb-2"><CardTitle className="text-xs text-muted-foreground">{s.label}</CardTitle></CardHeader>
            <CardContent><div className="text-2xl font-semibold">{(stats as any)[s.k] ?? 0}</div></CardContent>
          </Card>
        ))}
      </div>

      <Input
        placeholder="Filtrer (nom, courriel, extension, device id)…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="max-w-md"
      />

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Courtier</TableHead>
              <TableHead>Ext.</TableHead>
              <TableHead>Device mobile</TableHead>
              <TableHead>Widget</TableHead>
              <TableHead>État</TableHead>
              <TableHead>Provisionné</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((r) => (
              <TableRow key={r.broker_id}>
                <TableCell>
                  <div className="font-medium">{r.full_name ?? "—"}</div>
                  <div className="text-xs text-muted-foreground">{r.email}</div>
                </TableCell>
                <TableCell className="font-mono text-xs">{r.ns_extension}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.target_mobile_id}
                  <div className="text-[10px] text-muted-foreground">
                    NS: {r.ns_mobile_exists ? "présent" : "absent"} · Vault: {r.has_vault_secret ? "oui" : "non"}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {r.ns_widget_device_id ?? "—"}
                  <div className="text-[10px] text-muted-foreground">
                    {r.ns_widget_exists ? "présent" : (r.ns_widget_device_id ? "absent" : "non lié")}
                  </div>
                </TableCell>
                <TableCell><StatePill state={r.state} /></TableCell>
                <TableCell className="text-xs">
                  {r.provisioned_at ? new Date(r.provisioned_at).toLocaleString("fr-CA") : "—"}
                  {r.last_error && (
                    <div className="text-[10px] text-destructive">
                      Err: {new Date(r.last_error.at).toLocaleDateString("fr-CA")}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setTestBroker(r); setTestSessionId(null); setTestState(null); setAnsweredBy(null); }}
                    disabled={!r.ns_extension}
                  >
                    <PhoneCall className="mr-2 h-3 w-3" />
                    Appel test
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filtered.length === 0 && !loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Aucun courtier.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!testBroker} onOpenChange={(o) => { if (!o) setTestBroker(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appel test — {testBroker?.full_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              Un appel va être déclenché vers l'extension <code>{testBroker?.ns_extension}</code>. Le widget web et
              l'application mobile doivent sonner <strong>simultanément</strong>. Décrocher sur l'un doit
              couper l'autre.
            </p>
            <div>
              <label className="text-xs text-muted-foreground">Numéro appelant (caller ID)</label>
              <Input
                value={fromNumber}
                onChange={(e) => setFromNumber(e.target.value)}
                placeholder="ex. 5145550100"
              />
            </div>
            {testState && (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div><span className="font-medium">État :</span> {testState}</div>
                {answeredBy && <div className="text-xs text-muted-foreground">Répondu par : {answeredBy}</div>}
                {testSessionId && <div className="text-[10px] text-muted-foreground">session {testSessionId}</div>}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTestBroker(null)}>Fermer</Button>
            <Button onClick={startTest} disabled={testing}>
              {testing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PhoneCall className="mr-2 h-4 w-4" />}
              Lancer l'appel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
