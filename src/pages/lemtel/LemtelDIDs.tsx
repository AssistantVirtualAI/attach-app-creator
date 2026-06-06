import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Phone, Plus, MessageSquare, Loader2 } from 'lucide-react';
import { usePbxPhoneNumbers, usePbxPhoneNumberAssignments, usePbxClients } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { SyncEverythingButton } from '@/components/lemtel/SyncEverythingButton';
import { OrderDIDModal } from '@/components/lemtel/OrderDIDModal';

export default function LemtelDIDs() {
  const [orderOpen, setOrderOpen] = useState(false);
  const { data: numbers = [], isLoading } = usePbxPhoneNumbers();
  const { data: assignments = [] } = usePbxPhoneNumberAssignments();
  const { data: clients = [] } = usePbxClients();

  const assignByNumber = new Map((assignments as any[]).map(a => [a.phone_number_id, a]));
  const clientById = new Map((clients as any[]).map(c => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="w-7 h-7" /> Phone Numbers (DIDs)</h1>
          <p className="text-muted-foreground">Provisioned numbers and call routing</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <SyncEverythingButton />
          <Button onClick={() => setOrderOpen(true)}><Plus className="w-4 h-4 mr-2" /> Order DID</Button>
        </div>
      </div>
      <OrderDIDModal open={orderOpen} onOpenChange={setOrderOpen} />
      <Card>
        <CardHeader><CardTitle>{numbers.length} numbers</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Number</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Routing</TableHead>
                  <TableHead>SMS</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No phone numbers yet.</TableCell></TableRow>
                ) : (numbers as any[]).map(n => {
                  const a = assignByNumber.get(n.id);
                  const client = a?.client_id ? clientById.get(a.client_id) : null;
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono font-bold">{n.phone_number}</TableCell>
                      <TableCell className="text-sm">{client?.name || n.friendly_name || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{n.provider || 'unknown'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a?.destination_type ? `${a.destination_type} → ${a.destination_id ?? ''}` : '—'}</TableCell>
                      <TableCell>{a?.sms_enabled ? <Badge variant="secondary"><MessageSquare className="w-3 h-3 mr-1" />Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                      <TableCell className="text-right font-mono">{n.monthly_cost != null ? `$${Number(n.monthly_cost).toFixed(2)}` : '—'}</TableCell>
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
