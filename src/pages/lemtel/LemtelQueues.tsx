import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Headphones, Plus, Loader2 } from 'lucide-react';
import { usePbxQueues } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';

export default function LemtelQueues() {
  const { data: queues = [], isLoading } = usePbxQueues();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Headphones className="w-7 h-7" /> Call Queues</h1>
          <p className="text-muted-foreground">ACD queues and ring strategies</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="ivr-queues" />
          <Button><Plus className="w-4 h-4 mr-2" /> New Queue</Button>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>{queues.length} queues</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Extension</TableHead><TableHead>Strategy</TableHead>
              <TableHead>Max Wait</TableHead><TableHead>Recording</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {(queues as any[]).map((q: any) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.name}</TableCell>
                  <TableCell className="font-mono">{q.extension || '-'}</TableCell>
                  <TableCell><Badge variant="outline">{q.strategy}</Badge></TableCell>
                  <TableCell>{q.max_wait_time}s</TableCell>
                  <TableCell>{q.record_enabled ? <Badge>On</Badge> : <Badge variant="outline">Off</Badge>}</TableCell>
                  <TableCell>{q.enabled ? <Badge variant="default">Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}</TableCell>
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
