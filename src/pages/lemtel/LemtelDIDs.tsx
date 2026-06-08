import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Phone, Plus, MessageSquare, Loader2, Pencil, Route, CheckCircle2 } from 'lucide-react';
import { LEMTEL_ORG, usePbxExtensions, usePbxIvrs, usePbxPhoneNumbers, usePbxPhoneNumberAssignments, usePbxClients, usePbxQueues, usePbxRingGroups } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { SyncEverythingButton } from '@/components/lemtel/SyncEverythingButton';
import { OrderDIDModal } from '@/components/lemtel/OrderDIDModal';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';

const label = {
  en: { title: 'Phone Numbers (DIDs)', subtitle: 'Provisioned numbers, inbound routing, SMS and destination sync.', order: 'Order DID', route: 'Edit routing', empty: 'No phone numbers yet — order or sync DIDs to start routing inbound calls.', number: 'Number', customer: 'Customer', provider: 'Provider', routing: 'Routing', sms: 'SMS', monthly: 'Monthly', status: 'Status', destinationType: 'Destination type', destination: 'Destination', save: 'Save routing', cancel: 'Cancel', synced: 'Routing synced', failed: 'Routing sync failed', notConfigured: 'Not routed' },
  fr: { title: 'Numéros de téléphone (DIDs)', subtitle: 'Numéros provisionnés, routage entrant, SMS et synchronisation des destinations.', order: 'Commander DID', route: 'Modifier routage', empty: 'Aucun numéro — commandez ou synchronisez des DIDs pour router les appels entrants.', number: 'Numéro', customer: 'Client', provider: 'Fournisseur', routing: 'Routage', sms: 'SMS', monthly: 'Mensuel', status: 'Statut', destinationType: 'Type de destination', destination: 'Destination', save: 'Enregistrer routage', cancel: 'Annuler', synced: 'Routage synchronisé', failed: 'Échec du routage', notConfigured: 'Non routé' },
};

export default function LemtelDIDs() {
  const [orderOpen, setOrderOpen] = useState(false);
  const { data: numbers = [], isLoading } = usePbxPhoneNumbers();
  const { data: assignments = [] } = usePbxPhoneNumberAssignments();
  const { data: clients = [] } = usePbxClients();
  const { data: extensions = [] } = usePbxExtensions();
  const { data: queues = [] } = usePbxQueues();
  const { data: ivrs = [] } = usePbxIvrs();
  const { data: ringGroups = [] } = usePbxRingGroups();
  const { language } = useLanguage();
  const txt = label[language];

  const assignByNumber = new Map((assignments as any[]).map(a => [a.phone_number_id, a]));
  const clientById = new Map((clients as any[]).map(c => [c.id, c]));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="w-7 h-7" /> {txt.title}</h1>
          <p className="text-muted-foreground">{txt.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <SyncEverythingButton />
          <Button onClick={() => setOrderOpen(true)}><Plus className="w-4 h-4 mr-2" /> {txt.order}</Button>
        </div>
      </div>
      <OrderDIDModal open={orderOpen} onOpenChange={setOrderOpen} />
      <Card>
        <CardHeader><CardTitle>{numbers.length} DIDs</CardTitle><CardDescription><CheckCircle2 className="inline w-3.5 h-3.5 mr-1 text-primary" />{txt.subtitle}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{txt.number}</TableHead>
                  <TableHead>{txt.customer}</TableHead>
                  <TableHead>{txt.provider}</TableHead>
                  <TableHead>{txt.routing}</TableHead>
                  <TableHead>{txt.sms}</TableHead>
                  <TableHead className="text-right">{txt.monthly}</TableHead>
                  <TableHead className="text-right">{txt.route}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {numbers.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{txt.empty}</TableCell></TableRow>
                ) : (numbers as any[]).map(n => {
                  const a = assignByNumber.get(n.id);
                  const client = a?.client_id ? clientById.get(a.client_id) : null;
                  return (
                    <TableRow key={n.id}>
                      <TableCell className="font-mono font-bold">{n.phone_number}</TableCell>
                      <TableCell className="text-sm">{client?.name || n.friendly_name || '—'}</TableCell>
                      <TableCell><Badge variant="outline">{n.provider || 'unknown'}</Badge></TableCell>
                      <TableCell className="text-sm text-muted-foreground">{a?.destination_type ? `${a.destination_type} → ${displayDestination(a, { extensions, queues, ivrs, ringGroups })}` : txt.notConfigured}</TableCell>
                      <TableCell>{a?.sms_enabled ? <Badge variant="secondary"><MessageSquare className="w-3 h-3 mr-1" />Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                      <TableCell className="text-right font-mono">{n.monthly_cost != null ? `$${Number(n.monthly_cost).toFixed(2)}` : '—'}</TableCell>
                      <TableCell className="text-right"><DidRoutingDialog number={n} assignment={a} clients={clients as any[]} extensions={extensions as any[]} queues={queues as any[]} ivrs={ivrs as any[]} ringGroups={ringGroups as any[]} txt={txt} trigger={<Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>} /></TableCell>
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
