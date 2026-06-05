import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Smartphone, Plus, Circle, Loader2 } from 'lucide-react';
import { usePbxExtensions } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { formatDistanceToNow } from 'date-fns';

type ExtType = { label: string; cls: string };
function getExtensionType(e: any): ExtType {
  const num = String(e.extension ?? '');
  const desc = String(e.description ?? '').toLowerCase();
  const cid = String(e.effective_cid_name ?? '').toLowerCase();
  if (cid === 'ai' || desc.includes('ai')) return { label: '🤖 AI Agent', cls: 'bg-orange-500/15 text-orange-600 border-orange-500/30' };
  if (num.length === 10) return { label: '📱 Mobile DID', cls: 'bg-blue-500/15 text-blue-600 border-blue-500/30' };
  if (['door','kitchen','bedroom','basement','garage','cordless'].some(w => desc.includes(w)))
    return { label: '🏠 Residential', cls: 'bg-purple-500/15 text-purple-600 border-purple-500/30' };
  const n = parseInt(num);
  if ((n >= 200 && n <= 299) || n >= 1000)
    return { label: '💼 Business', cls: 'bg-green-500/15 text-green-600 border-green-500/30' };
  return { label: '🔌 Extension', cls: 'bg-muted text-muted-foreground' };
}

export default function LemtelExtensions() {
  const [search, setSearch] = useState('');
  const { data: extensions = [], isLoading } = usePbxExtensions();
  const all = extensions as any[];
  const exts = all.filter(e =>
    !search || e.extension?.includes(search) ||
    e.effective_cid_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    all.forEach(e => { const t = getExtensionType(e).label; s[t] = (s[t] ?? 0) + 1; });
    return s;
  }, [all]);

  const lastSync = useMemo(() => {
    const dates = all.map(e => e.synced_at).filter(Boolean).sort().reverse();
    return dates[0] ? formatDistanceToNow(new Date(dates[0]), { addSuffix: true }) : 'never';
  }, [all]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Smartphone className="w-7 h-7" /> Extensions</h1>
          <p className="text-muted-foreground">FusionPBX SIP extensions — last synced {lastSync}</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <Button><Plus className="w-4 h-4 mr-2" /> Provision Extension</Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {Object.entries(stats).map(([k, v]) => (
          <Badge key={k} variant="outline" className="text-sm py-1 px-3">{k}: {v}</Badge>
        ))}
        <Badge variant="default" className="text-sm py-1 px-3">Total: {all.length}</Badge>
      </div>

      <Card>
        <CardHeader><CardTitle>{exts.length} extensions</CardTitle></CardHeader>
        <CardContent>
          <Input className="mb-4 max-w-sm" placeholder="Search extension, name..." value={search} onChange={e => setSearch(e.target.value)} />
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ext</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Caller ID</TableHead>
                <TableHead>Voicemail</TableHead>
                <TableHead>Recording</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exts.map((e: any) => {
                const t = getExtensionType(e);
                return (
                  <TableRow key={e.id}>
                    <TableCell className="font-mono font-bold">{e.extension}</TableCell>
                    <TableCell><Badge variant="outline" className={t.cls}>{t.label}</Badge></TableCell>
                    <TableCell>{e.effective_cid_name || e.description || '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{e.effective_cid_number || '-'}</TableCell>
                    <TableCell>{e.voicemail_enabled ? <Badge variant="secondary">On</Badge> : <Badge variant="outline">Off</Badge>}</TableCell>
                    <TableCell><Badge variant="outline">{e.call_recording || 'none'}</Badge></TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Circle className={`w-2.5 h-2.5 ${e.enabled ? 'fill-green-500 text-green-500' : 'fill-muted text-muted'}`} />
                        {e.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
