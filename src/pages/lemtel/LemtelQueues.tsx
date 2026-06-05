import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Headphones, Plus, Users, Clock } from 'lucide-react';
import { MOCK_QUEUES } from '@/lib/lemtelMockData';

export default function LemtelQueues() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Headphones className="w-7 h-7" /> Call Queues</h1>
          <p className="text-muted-foreground">ACD queues and ring strategies</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New Queue</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Queues</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{MOCK_QUEUES.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Callers Waiting</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{MOCK_QUEUES.reduce((s, q) => s + q.waiting, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Abandoned Today</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{MOCK_QUEUES.reduce((s, q) => s + q.abandoned_today, 0)}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Queues</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Name</TableHead><TableHead>Customer</TableHead><TableHead>Strategy</TableHead>
              <TableHead>Agents</TableHead><TableHead>Waiting</TableHead><TableHead>Abandoned</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {MOCK_QUEUES.map(q => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">{q.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.customer_name}</TableCell>
                  <TableCell><Badge variant="outline">{q.strategy}</Badge></TableCell>
                  <TableCell className="inline-flex items-center gap-1"><Users className="w-3 h-3" /> {q.members}</TableCell>
                  <TableCell className="inline-flex items-center gap-1"><Clock className="w-3 h-3" /> {q.waiting}</TableCell>
                  <TableCell>{q.abandoned_today}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
