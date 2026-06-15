import { useEffect, useState } from "react";
import { ConsolePageHeader } from "@/components/console/ConsolePageHeader";
import { supabase } from "@/integrations/supabase/client";
import { InventoryTable } from "@/components/console/InventoryTable";
import { Badge } from "@/components/ui/badge";

interface Row {
  id: string; action: string; entity_type: string; entity_id: string | null;
  actor_email: string | null; source: string | null; result: string | null;
  confirmed_at: string | null; created_at: string;
}

export default function ConsoleAudit() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase.from("pbx_admin_actions") as any)
        .select("id, action, entity_type, entity_id, actor_email, source, result, confirmed_at, created_at")
        .order("created_at", { ascending: false }).limit(200);
      setRows((data ?? []) as Row[]);
      setLoading(false);
    })();
  }, []);
  return (
    <div>
      <ConsolePageHeader title="Audit Log" description="Every PBX admin action with rollback metadata." sourceId="extensions" hasData={rows.length > 0} />
      <InventoryTable
        loading={loading} rows={rows} getRowKey={r => r.id}
        searchAccessor={r => `${r.action} ${r.entity_type} ${r.actor_email ?? ""}`}
        searchPlaceholder="Search action / entity / actor…"
        emptyTitle="No admin actions recorded yet"
        columns={[
          { key: "when",   header: "When",   render: r => <span className="text-xs">{new Date(r.created_at).toLocaleString()}</span> },
          { key: "actor",  header: "Actor",  render: r => <span className="text-xs">{r.actor_email ?? "system"}</span> },
          { key: "act",    header: "Action", render: r => <code className="text-xs">{r.action}</code> },
          { key: "ent",    header: "Entity", render: r => <span className="text-xs">{r.entity_type}{r.entity_id ? ` · ${r.entity_id.slice(0,8)}` : ""}</span> },
          { key: "src",    header: "Source", render: r => <Badge variant="outline" className="text-[10px]">{r.source ?? "ava"}</Badge> },
          { key: "res",    header: "Result", render: r => <Badge variant={r.result === "ok" ? "secondary" : "destructive"} className="text-[10px]">{r.result ?? "?"}</Badge> },
        ]}
      />
    </div>
  );
}
