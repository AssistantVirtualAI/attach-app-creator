import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

export default function MasterAuditLogs() {
  const { data: logs = [] } = useQuery({
    queryKey: ["audit-logs-all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []) as any[];
    },
  });
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">Audit logs</h1>
      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead className="border-b">
              <tr className="text-left">
                <th className="p-2">When</th>
                <th className="p-2">Org</th>
                <th className="p-2">User</th>
                <th className="p-2">Impersonator</th>
                <th className="p-2">Action</th>
                <th className="p-2">Resource</th>
                <th className="p-2">IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l: any) => (
                <tr key={l.id} className="border-b text-xs">
                  <td className="p-2">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="p-2 font-mono">{l.organization_id?.slice(0, 8)}</td>
                  <td className="p-2 font-mono">{l.user_id?.slice(0, 8)}</td>
                  <td className="p-2 font-mono">{l.impersonator_id?.slice(0, 8) || "-"}</td>
                  <td className="p-2">{l.action}</td>
                  <td className="p-2">{l.resource_type}</td>
                  <td className="p-2">{l.ip_address || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
