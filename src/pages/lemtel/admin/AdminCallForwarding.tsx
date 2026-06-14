import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Router, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSkeletonRows, AdminEmptyState } from '@/components/admin/AdminSkeletonRows';
import { StatusBadge } from '@/components/admin/StatusBadge';

export default function AdminCallForwarding() {
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pbx-call-forwarding-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_call_forwarding').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const cell = (on: boolean, label?: string) =>
    on ? <StatusBadge tone="on">{label || 'on'}</StatusBadge> : <StatusBadge tone="off">off</StatusBadge>;

  return (
    <div className="space-y-4 w-full min-w-0">
      <AdminPageHeader
        icon={Router}
        title="Call Forwarding"
        subtitle="Per-user forwarding rules (always, busy, no-answer, offline, DND)."
        actions={<Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>}
      />

      <Card>
        <CardHeader><CardTitle>{rows.length} rule{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Always</TableHead><TableHead>Busy</TableHead>
              <TableHead>No answer</TableHead><TableHead>Offline</TableHead><TableHead>DND</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <AdminSkeletonRows rows={5} cols={6} /> :
                rows.length === 0 ? <TableRow><TableCell colSpan={6}><AdminEmptyState title="No forwarding rules" hint="Users haven't configured call forwarding yet." /></TableCell></TableRow> :
                rows.map((r: any) => (
                  <TableRow key={r.user_id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                    <TableCell>{cell(r.always_enabled, r.always_to)}</TableCell>
                    <TableCell>{cell(r.busy_enabled, r.busy_to)}</TableCell>
                    <TableCell>{cell(r.no_answer_enabled, r.no_answer_to ? `${r.no_answer_to} / ${r.no_answer_seconds}s` : undefined)}</TableCell>
                    <TableCell>{cell(r.offline_enabled, r.offline_to)}</TableCell>
                    <TableCell>{r.dnd_enabled ? <StatusBadge tone="err">DND</StatusBadge> : <StatusBadge tone="off">off</StatusBadge>}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
