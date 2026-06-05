import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Smartphone, Plus, Circle, Loader2 } from 'lucide-react';
import { usePbxExtensions } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';

export default function LemtelExtensions() {
  const [search, setSearch] = useState('');
  const { data: extensions = [], isLoading } = usePbxExtensions();
  const exts = (extensions as any[]).filter(e =>
    !search || e.extension?.includes(search) ||
    e.effective_cid_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Smartphone className="w-7 h-7" /> Extensions</h1>
          <p className="text-muted-foreground">FusionPBX SIP extensions</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <Button><Plus className="w-4 h-4 mr-2" /> Provision Extension</Button>
        </div>
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
                <TableHead>Display Name</TableHead>
                <TableHead>Caller ID</TableHead>
                <TableHead>Voicemail</TableHead>
                <TableHead>Recording</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exts.map((e: any) => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono font-bold">{e.extension}</TableCell>
                  <TableCell>{e.effective_cid_name || '-'}</TableCell>
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
              ))}
            </TableBody>
          </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
