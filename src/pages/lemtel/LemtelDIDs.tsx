import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Plus, MessageSquare } from 'lucide-react';
import { MOCK_DIDS } from '@/lib/lemtelMockData';

export default function LemtelDIDs() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="w-7 h-7" /> Phone Numbers (DIDs)</h1>
          <p className="text-muted-foreground">Telnyx-provisioned numbers and call routing</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Order DID</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{MOCK_DIDS.length} active numbers</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Number</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Routing</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead>SMS</TableHead>
                <TableHead className="text-right">Monthly</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {MOCK_DIDS.map(d => (
                <TableRow key={d.id}>
                  <TableCell className="font-mono font-bold">{d.number}</TableCell>
                  <TableCell className="text-sm">{d.customer_name}</TableCell>
                  <TableCell><Badge variant="outline">{d.routing.replace('_', ' ')}</Badge></TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d.destination}</TableCell>
                  <TableCell>{d.sms_enabled ? <Badge variant="secondary"><MessageSquare className="w-3 h-3 mr-1" />Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                  <TableCell className="text-right font-mono">${d.monthly_cost.toFixed(2)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
