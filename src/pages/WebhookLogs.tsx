import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, RefreshCw } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';

export default function WebhookLogs() {
  const { selectedOrgId } = useOrganization();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: logs = [], isLoading, refetch } = useQuery({
    queryKey: ['webhook-logs', selectedOrgId, statusFilter],
    queryFn: async () => {
      if (!selectedOrgId) return [];

      let query = supabase
        .from('webhook_events')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('created_at', { ascending: false })
        .limit(100);

      if (statusFilter !== 'all') {
        query = query.eq('processed', statusFilter === 'processed');
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  const filteredLogs = logs.filter((log) =>
    log.event_type.toLowerCase().includes(search.toLowerCase()) ||
    log.connector.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">Journaux Webhook</h1>
            <p className="text-muted-foreground">
              Historique des webhooks reçus de vos intégrations
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Actualiser
          </Button>
        </div>

        <div className="glass-card p-6">
          <div className="flex gap-4 mb-6">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher par événement ou plateforme..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les statuts</SelectItem>
                <SelectItem value="processed">Traités</SelectItem>
                <SelectItem value="pending">En attente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Plateforme</TableHead>
                <TableHead>Type d'événement</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8">
                    Aucun webhook trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      {new Date(log.created_at).toLocaleString('fr-FR')}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{log.connector}</Badge>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {log.event_type}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={log.processed ? 'default' : 'secondary'}
                        className={log.processed ? 'bg-green-500' : ''}
                      >
                        {log.processed ? 'Traité' : 'En attente'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm">
                        Détails
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
