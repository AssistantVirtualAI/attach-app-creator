import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Voicemail, RefreshCw, Loader2 } from 'lucide-react';

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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Voicemail className="w-7 h-7" /> Voicemail Settings</h1>
          <p className="text-muted-foreground text-sm">Per-user voicemail PIN, email-to-vm, transcription, retention.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{rows.length} configuration{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>Email to VM</TableHead>
                <TableHead>Transcription</TableHead><TableHead>Retention</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No voicemail settings.</TableCell></TableRow> :
                  rows.map((r: any) => (
                    <TableRow key={r.user_id || r.id}>
                      <TableCell className="font-mono text-xs">{(r.user_id || r.id || '').slice(0, 8)}…</TableCell>
                      <TableCell>{r.email_enabled || r.email_to_voicemail ? <Badge>on</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                      <TableCell>{r.transcription_enabled ? <Badge>on</Badge> : <Badge variant="secondary">off</Badge>}</TableCell>
                      <TableCell className="text-xs">{r.retention_days ? `${r.retention_days}d` : '—'}</TableCell>
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
