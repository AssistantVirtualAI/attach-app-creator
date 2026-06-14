import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Router, RefreshCw, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { AdminPageHeader } from '@/components/admin/AdminPageHeader';
import { AdminSkeletonRows, AdminEmptyState } from '@/components/admin/AdminSkeletonRows';

export default function AdminCallForwarding() {
  const [edits, setEdits] = useState<Record<string, any>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pbx-call-forwarding-admin'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_call_forwarding').select('*').order('updated_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const val = (r: any, k: string) => edits[r.user_id]?.[k] ?? r[k];
  const setVal = (id: string, k: string, v: any) => setEdits(e => ({ ...e, [id]: { ...e[id], [k]: v } }));

  const save = async (r: any) => {
    setSavingId(r.user_id);
    try {
      const { error } = await supabase.from('pbx_call_forwarding').update(edits[r.user_id]).eq('user_id', r.user_id);
      if (error) throw error;
      toast.success('Saved');
      setEdits(e => { const n = { ...e }; delete n[r.user_id]; return n; });
      refetch();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    finally { setSavingId(null); }
  };

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
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader><TableRow>
              <TableHead>User</TableHead>
              <TableHead>Always</TableHead><TableHead>To</TableHead>
              <TableHead>Busy</TableHead><TableHead>To</TableHead>
              <TableHead>No-ans</TableHead><TableHead>To / sec</TableHead>
              <TableHead>Offline</TableHead><TableHead>To</TableHead>
              <TableHead>DND</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {isLoading ? <AdminSkeletonRows rows={5} cols={11} /> :
                rows.length === 0 ? <TableRow><TableCell colSpan={11}><AdminEmptyState title="No forwarding rules" hint="Users haven't configured call forwarding yet." /></TableCell></TableRow> :
                rows.map((r: any) => (
                  <TableRow key={r.user_id} className="hover:bg-muted/40">
                    <TableCell className="font-mono text-xs">{r.user_id.slice(0, 8)}…</TableCell>
                    <TableCell><Switch checked={!!val(r, 'always_enabled')} onCheckedChange={v => setVal(r.user_id, 'always_enabled', v)} /></TableCell>
                    <TableCell><Input className="w-28 font-mono" value={val(r, 'always_to') || ''} onChange={e => setVal(r.user_id, 'always_to', e.target.value)} /></TableCell>
                    <TableCell><Switch checked={!!val(r, 'busy_enabled')} onCheckedChange={v => setVal(r.user_id, 'busy_enabled', v)} /></TableCell>
                    <TableCell><Input className="w-28 font-mono" value={val(r, 'busy_to') || ''} onChange={e => setVal(r.user_id, 'busy_to', e.target.value)} /></TableCell>
                    <TableCell><Switch checked={!!val(r, 'no_answer_enabled')} onCheckedChange={v => setVal(r.user_id, 'no_answer_enabled', v)} /></TableCell>
                    <TableCell className="flex gap-1 items-center">
                      <Input className="w-24 font-mono" value={val(r, 'no_answer_to') || ''} onChange={e => setVal(r.user_id, 'no_answer_to', e.target.value)} />
                      <Input type="number" className="w-16" value={val(r, 'no_answer_seconds') ?? ''} onChange={e => setVal(r.user_id, 'no_answer_seconds', e.target.value ? parseInt(e.target.value) : null)} />
                    </TableCell>
                    <TableCell><Switch checked={!!val(r, 'offline_enabled')} onCheckedChange={v => setVal(r.user_id, 'offline_enabled', v)} /></TableCell>
                    <TableCell><Input className="w-28 font-mono" value={val(r, 'offline_to') || ''} onChange={e => setVal(r.user_id, 'offline_to', e.target.value)} /></TableCell>
                    <TableCell><Switch checked={!!val(r, 'dnd_enabled')} onCheckedChange={v => setVal(r.user_id, 'dnd_enabled', v)} /></TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" disabled={!edits[r.user_id] || savingId === r.user_id} onClick={() => save(r)}>
                        {savingId === r.user_id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
