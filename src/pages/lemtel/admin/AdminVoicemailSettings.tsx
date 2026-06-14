import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Voicemail, RefreshCw } from 'lucide-react';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSkeletonRows, AdminEmptyState } from '@/components/admin/AdminSkeletonRows';
import { StatusBadge } from '@/components/admin/StatusBadge';

export default function AdminVoicemailSettings() {
  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pbx-voicemail-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_voicemail_settings').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <div className="space-y-4 w-full min-w-0">
      <AdminPageHeader
        icon={Voicemail}
        title="Voicemail Settings"
        subtitle="Per-user voicemail PIN, email-to-vm, transcription, retention."
        actions={<Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>}
      />

      <Card>
        <CardHeader><CardTitle>{rows.length} configuration{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead><TableHead>Email to VM</TableHead>
              <TableHead>Transcription</TableHead><TableHead>Retention</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <AdminSkeletonRows rows={5} cols={4} /> :
                rows.length === 0 ? <TableRow><TableCell colSpan={4}><AdminEmptyState title="No voicemail settings" hint="No per-user voicemail policies set." /></TableCell></TableRow> :
                rows.map((r: any) => (
                  <TableRow key={r.user_id || r.id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{(r.user_id || r.id || '').slice(0, 8)}…</TableCell>
                    <TableCell>{(r.email_enabled || r.email_to_voicemail) ? <StatusBadge tone="on">on</StatusBadge> : <StatusBadge tone="off">off</StatusBadge>}</TableCell>
                    <TableCell>{r.transcription_enabled ? <StatusBadge tone="on">on</StatusBadge> : <StatusBadge tone="off">off</StatusBadge>}</TableCell>
                    <TableCell className="text-xs">{r.retention_days ? `${r.retention_days}d` : '—'}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
