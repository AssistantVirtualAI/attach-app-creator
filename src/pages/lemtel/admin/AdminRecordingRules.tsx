import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Disc, RefreshCw, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminRecordingRules() {
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pbx-call-recording-rules'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_call_recording_rules').select('*');
      if (error) throw error;
      return data || [];
    },
  });

  const val = (r: any, k: string) => edits[r.user_id]?.[k] ?? r[k];
  const setVal = (id: string, k: string, v: any) => setEdits(e => ({ ...e, [id]: { ...e[id], [k]: v } }));

  const save = async (r: any) => {
    setSavingId(r.user_id);
    try {
      const { error } = await supabase.from('pbx_call_recording_rules').update(edits[r.user_id]).eq('user_id', r.user_id);
      if (error) throw error;
      toast.success('Saved');
      setEdits(e => { const n = { ...e }; delete n[r.user_id]; return n; });
      refetch();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Disc className="w-7 h-7" /> Recording Rules</h1>
          <p className="text-muted-foreground text-sm">Per-user call recording policy and retention.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{rows.length} rule{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>User</TableHead><TableHead>All</TableHead><TableHead>Inbound</TableHead>
                <TableHead>Outbound</TableHead><TableHead>Announce</TableHead>
                <TableHead>Retention (days)</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No rules.</TableCell></TableRow> :
                  rows.map((r: any) => (
                    <TableRow key={r.user_id}>
                      <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                      <TableCell><Switch checked={!!val(r, 'record_all')} onCheckedChange={v => setVal(r.user_id, 'record_all', v)} /></TableCell>
                      <TableCell><Switch checked={!!val(r, 'record_inbound')} onCheckedChange={v => setVal(r.user_id, 'record_inbound', v)} /></TableCell>
                      <TableCell><Switch checked={!!val(r, 'record_outbound')} onCheckedChange={v => setVal(r.user_id, 'record_outbound', v)} /></TableCell>
                      <TableCell><Switch checked={!!val(r, 'announce')} onCheckedChange={v => setVal(r.user_id, 'announce', v)} /></TableCell>
                      <TableCell><Input type="number" className="w-24" value={val(r, 'retention_days') ?? ''} onChange={e => setVal(r.user_id, 'retention_days', e.target.value ? parseInt(e.target.value) : null)} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={!edits[r.user_id] || savingId === r.user_id} onClick={() => save(r)}>
                          {savingId === r.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        </Button>
                      </TableCell>
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
