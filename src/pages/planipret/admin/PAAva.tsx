import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Sparkles } from "lucide-react";


type Row = {
  user_id: string;
  analyses_30d: number;
  urgent_30d: number;
  leads_30d: number;
  actions_ok_30d: number;
  actions_err_30d: number;
  actions_modified_30d: number;
};
type Profile = { user_id: string; full_name: string | null };

export default function PAAva() {
  const [rows, setRows] = useState<Row[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [fbStats, setFbStats] = useState({ up: 0, down: 0, modified: 0, skipped: 0 });
  const [tuning, setTuning] = useState(false);

  const load = async () => {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const [statsRes, fbRes] = await Promise.all([
      supabase.from("planipret_ava_stats").select("*"),
      supabase.from("planipret_ava_feedback").select("rating").gte("created_at", since),
    ]);
    const list = (statsRes.data ?? []) as Row[];
    setRows(list);
    const counts = { up: 0, down: 0, modified: 0, skipped: 0 } as any;
    (fbRes.data ?? []).forEach((r: any) => { counts[r.rating] = (counts[r.rating] ?? 0) + 1; });
    setFbStats(counts);
    if (list.length) {
      const { data: p } = await supabase
        .from("planipret_profiles")
        .select("user_id, full_name")
        .in("user_id", list.map((r) => r.user_id));
      const m: Record<string, string> = {};
      (p as Profile[] | null)?.forEach((x) => { if (x.user_id) m[x.user_id] = x.full_name ?? ""; });
      setProfiles(m);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const retune = async () => {
    setTuning(true);
    const { data, error } = await supabase.functions.invoke("ava-prompt-tuner", { body: {} });
    setTuning(false);
    if (error || !(data as any)?.success) { toast.error("Échec du réentraînement"); return; }
    toast.success(`AVA réentraînée sur ${(data as any).count} courtier(s)`);
    load();
  };

  const totals = rows.reduce((acc, r) => ({
    analyses: acc.analyses + (r.analyses_30d ?? 0),
    urgent: acc.urgent + (r.urgent_30d ?? 0),
    leads: acc.leads + (r.leads_30d ?? 0),
    ok: acc.ok + (r.actions_ok_30d ?? 0),
    err: acc.err + (r.actions_err_30d ?? 0),
    modified: acc.modified + (r.actions_modified_30d ?? 0),
  }), { analyses: 0, urgent: 0, leads: 0, ok: 0, err: 0, modified: 0 });


  const approvalRate = totals.ok + totals.err > 0 ? Math.round((totals.ok / (totals.ok + totals.err)) * 100) : 0;
  const modificationRate = totals.ok + totals.err > 0 ? Math.round((totals.modified / (totals.ok + totals.err)) * 100) : 0;

  const fbTotal = fbStats.up + fbStats.down + fbStats.modified + fbStats.skipped;
  const satisfaction = fbTotal > 0 ? Math.round(((fbStats.up) / fbTotal) * 100) : 0;

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">AVA — Analytics (30 j)</h1>
          <p className="text-sm text-muted-foreground">Analyses d'emails, actions proposées et exécutées, feedback et apprentissage.</p>
        </div>
        <Button onClick={retune} disabled={tuning} variant="outline" size="sm">
          {tuning ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
          Réentraîner AVA
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Analyses" value={totals.analyses} />
        <Kpi label="Leads détectés" value={totals.leads} />
        <Kpi label="Urgent" value={totals.urgent} />
        <Kpi label="Actions exécutées" value={totals.ok} />
        <Kpi label="Taux de succès" value={`${approvalRate}%`} />
        <Kpi label="Modifiées par courtier" value={`${modificationRate}%`} />
        <Kpi label="👍 Feedback positif" value={fbStats.up} />
        <Kpi label="👎 Feedback négatif" value={fbStats.down} />
        <Kpi label="Satisfaction AVA" value={`${satisfaction}%`} />
        <Kpi label="Erreurs" value={totals.err} />
        <Kpi label="Courtiers actifs" value={rows.length} />
      </div>


      <Card>
        <CardHeader><CardTitle>Par courtier</CardTitle></CardHeader>
        <CardContent>
          {loading ? <Skeleton className="h-32 w-full" /> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Courtier</TableHead>
                  <TableHead className="text-right">Analyses</TableHead>
                  <TableHead className="text-right">Leads</TableHead>
                  <TableHead className="text-right">Urgent</TableHead>
                  <TableHead className="text-right">Actions ✓</TableHead>
                  <TableHead className="text-right">Actions ✕</TableHead>
                  <TableHead className="text-right">Modifiées</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{profiles[r.user_id] || r.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-right">{r.analyses_30d}</TableCell>
                    <TableCell className="text-right">{r.leads_30d}</TableCell>
                    <TableCell className="text-right">{r.urgent_30d}</TableCell>
                    <TableCell className="text-right">{r.actions_ok_30d}</TableCell>
                    <TableCell className="text-right">{r.actions_err_30d}</TableCell>
                    <TableCell className="text-right">{r.actions_modified_30d}</TableCell>
                  </TableRow>
                ))}
                {rows.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Aucune donnée AVA pour le moment.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-2xl font-semibold mt-1">{value}</div>
      </CardContent>
    </Card>
  );
}
