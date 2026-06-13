import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Router, RefreshCw, Loader2 } from 'lucide-react';

export default function AdminCallForwarding() {
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pbx-call-forwarding-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_call_forwarding').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Router className="w-7 h-7" /> Call Forwarding</h1>
          <p className="text-muted-foreground text-sm">Per-user forwarding rules (always, busy, no-answer, offline, DND).</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{rows.length} rule{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Always</TableHead><TableHead>Busy</TableHead>
                <TableHead>No answer</TableHead><TableHead>Offline</TableHead><TableHead>DND</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No forwarding rules.</TableCell></TableRow> :
                  rows.map((r: any) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                      <TableCell>{r.always_enabled ? <Badge>{r.always_to || 'on'}</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                      <TableCell>{r.busy_enabled ? <Badge>{r.busy_to || 'on'}</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                      <TableCell>{r.no_answer_enabled ? <Badge>{r.no_answer_to || 'on'} / {r.no_answer_seconds}s</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                      <TableCell>{r.offline_enabled ? <Badge>{r.offline_to || 'on'}</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                      <TableCell>{r.dnd_enabled ? <Badge variant="destructive">DND</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
