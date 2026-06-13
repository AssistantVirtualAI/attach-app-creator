import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Hash, RefreshCw, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';

type FC = {
  id: string;
  feature: string;
  activate_code: string | null;
  deactivate_code: string | null;
  dial_code: string | null;
  enabled: boolean;
};

export default function AdminFeatureCodes() {
  const [edits, setEdits] = useState<Record<string, Partial<FC>>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['pbx-feature-codes'],
    queryFn: async () => {
      const { data, error } = await supabase.from('pbx_feature_codes').select('*').order('feature');
      if (error) throw error;
      return (data || []) as FC[];
    },
  });

  const val = (r: FC, k: keyof FC) => (edits[r.id]?.[k] ?? r[k]) as any;
  const setVal = (id: string, k: keyof FC, v: any) =>
    setEdits(e => ({ ...e, [id]: { ...e[id], [k]: v } }));

  const save = async (r: FC) => {
    const patch = edits[r.id];
    if (!patch) return;
    setSavingId(r.id);
    try {
      const { error } = await supabase.from('pbx_feature_codes').update(patch).eq('id', r.id);
      if (error) throw error;
      toast.success(`Saved ${r.feature}`);
      setEdits(e => { const n = { ...e }; delete n[r.id]; return n; });
      refetch();
    } catch (e: any) { toast.error(e?.message || 'Save failed'); }
    finally { setSavingId(null); }
  };

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Hash className="w-7 h-7" /> Feature Codes</h1>
          <p className="text-muted-foreground text-sm">Star codes like *97 voicemail or *72 forward.</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}><RefreshCw className="w-4 h-4 mr-2" /> Refresh</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>{rows.length} code{rows.length === 1 ? '' : 's'}</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Feature</TableHead><TableHead>Activate</TableHead><TableHead>Deactivate</TableHead>
                <TableHead>Dial</TableHead><TableHead>Enabled</TableHead><TableHead className="text-right">Action</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {rows.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No feature codes.</TableCell></TableRow> :
                  rows.map(r => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.feature}</TableCell>
                      <TableCell><Input className="w-24 font-mono" value={val(r, 'activate_code') || ''} onChange={e => setVal(r.id, 'activate_code', e.target.value)} /></TableCell>
                      <TableCell><Input className="w-24 font-mono" value={val(r, 'deactivate_code') || ''} onChange={e => setVal(r.id, 'deactivate_code', e.target.value)} /></TableCell>
                      <TableCell><Input className="w-24 font-mono" value={val(r, 'dial_code') || ''} onChange={e => setVal(r.id, 'dial_code', e.target.value)} /></TableCell>
                      <TableCell><Switch checked={!!val(r, 'enabled')} onCheckedChange={v => setVal(r.id, 'enabled', v)} /></TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={!edits[r.id] || savingId === r.id} onClick={() => save(r)}>
                          {savingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
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
