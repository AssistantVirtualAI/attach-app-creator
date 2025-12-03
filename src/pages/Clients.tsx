import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Key, Trash2, Users, Edit, MoreHorizontal } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { PlatformBadge } from '@/components/agents/PlatformBadge';
import { ClientAvatar } from '@/components/clients/ClientAvatar';
import { ClientFilters, StatusFilter, SortField, SortOrder } from '@/components/clients/ClientFilters';
import { ClientMembersModal } from '@/components/clients/ClientMembersModal';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { toast } from 'sonner';

export default function Clients() {
  const { selectedOrgId } = useOrganization();
  const { toast: toastHook } = useToast();
  const queryClient = useQueryClient();
  
  // Filters state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  
  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [membersModalOpen, setMembersModalOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{ id: string; name: string } | null>(null);
  
  // New client form
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    assignedAgentId: '',
  });

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          assigned_agent:agents(id, name, platform)
        `)
        .eq('organization_id', selectedOrgId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  const { data: agents } = useQuery({
    queryKey: ['agents', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  // Filter and sort clients
  const filteredClients = useMemo(() => {
    if (!clients) return [];

    let result = [...clients];

    // Apply search filter
    if (search) {
      const searchLower = search.toLowerCase();
      result = result.filter(
        (client) =>
          client.name.toLowerCase().includes(searchLower) ||
          client.email?.toLowerCase().includes(searchLower) ||
          client.username?.toLowerCase().includes(searchLower)
      );
    }

    // Apply status filter
    if (statusFilter !== 'all') {
      result = result.filter((client) => client.status === statusFilter);
    }

    // Apply sorting
    result.sort((a, b) => {
      let comparison = 0;
      
      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          comparison = (a.status || '').localeCompare(b.status || '');
          break;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [clients, search, statusFilter, sortField, sortOrder]);

  const deleteClientMutation = useMutation({
    mutationFn: async (clientId: string) => {
      const { error } = await supabase
        .from('clients')
        .delete()
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client supprimé');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la suppression');
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async ({ clientId, newStatus }: { clientId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('clients')
        .update({ status: newStatus })
        .eq('id', clientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Statut mis à jour');
    },
  });

  const handleCreate = async () => {
    const { name, email, username, password, assignedAgentId } = newClient;

    if (!name || !email || !username || !password || !assignedAgentId) {
      toastHook({
        title: 'Erreur',
        description: 'Tous les champs sont requis',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toastHook({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      // Create client entry (simplified - without auth.admin which requires service role)
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          organization_id: selectedOrgId,
          name,
          email,
          username,
          login_id: username,
          assigned_agent_id: assignedAgentId,
          status: 'active',
          created_by: user.id,
        });

      if (clientError) throw clientError;

      toastHook({
        title: 'Succès',
        description: `Client ${name} créé avec succès`,
      });

      setCreateOpen(false);
      setNewClient({ name: '', email: '', username: '', password: '', assignedAgentId: '' });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    } catch (error: any) {
      console.error('Erreur création client:', error);
      toastHook({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la création du client',
        variant: 'destructive',
      });
    }
  };

  const handleOpenMembers = (client: { id: string; name: string }) => {
    setSelectedClient(client);
    setMembersModalOpen(true);
  };

  const handleSortChange = (field: SortField, order: SortOrder) => {
    setSortField(field);
    setSortOrder(order);
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold gradient-text mb-2">Clientèle</h1>
            <p className="text-muted-foreground">
              Gérez vos clients et leurs agents assignés
            </p>
          </div>

          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvelle clientèle
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Créer un nouveau client</DialogTitle>
                <DialogDescription>
                  Le client recevra un accès limité au dashboard de l'organisation
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <Label htmlFor="name">Nom du client *</Label>
                  <Input
                    id="name"
                    value={newClient.name}
                    onChange={(e) =>
                      setNewClient({
                        ...newClient,
                        name: e.target.value,
                        username: e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9]/g, ''),
                      })
                    }
                    placeholder="Ex: Jean Dupont"
                  />
                </div>
                <div>
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newClient.email}
                    onChange={(e) =>
                      setNewClient({ ...newClient, email: e.target.value })
                    }
                    placeholder="jean.dupont@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="username">Nom d'utilisateur *</Label>
                  <Input
                    id="username"
                    value={newClient.username}
                    onChange={(e) =>
                      setNewClient({ ...newClient, username: e.target.value })
                    }
                    placeholder="jeandupont"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Utilisé pour se connecter au dashboard
                  </p>
                </div>
                <div>
                  <Label htmlFor="password">Mot de passe *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newClient.password}
                    onChange={(e) =>
                      setNewClient({ ...newClient, password: e.target.value })
                    }
                    placeholder="Minimum 8 caractères"
                  />
                </div>
                <div>
                  <Label htmlFor="agent">Assigner à un agent *</Label>
                  <Select
                    value={newClient.assignedAgentId}
                    onValueChange={(value) =>
                      setNewClient({ ...newClient, assignedAgentId: value })
                    }
                  >
                    <SelectTrigger id="agent">
                      <SelectValue placeholder="Choisir un agent..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents?.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          {agent.platform.toUpperCase()} - {agent.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleCreate} className="w-full">
                  Créer le client
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="glass-card p-6 space-y-6">
          {/* Filters */}
          <ClientFilters
            search={search}
            onSearchChange={setSearch}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            totalCount={clients?.length || 0}
            filteredCount={filteredClients.length}
          />

          {/* Table */}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Login ID</TableHead>
                  <TableHead>Agent assigné</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Date de création</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="flex items-center justify-center gap-2 text-muted-foreground">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                        Chargement...
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredClients.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12">
                      <div className="text-muted-foreground">
                        {clients?.length === 0
                          ? 'Aucun client. Créez votre premier client !'
                          : 'Aucun client ne correspond à vos critères'}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClients.map((client) => (
                    <TableRow key={client.id} className="group">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <ClientAvatar name={client.name} />
                          <div>
                            <div className="font-medium">{client.name}</div>
                            <div className="text-sm text-muted-foreground">{client.email}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.login_id || client.username ? (
                          <code className="text-xs bg-muted px-2 py-1 rounded font-mono">
                            {client.login_id || client.username}
                          </code>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {client.assigned_agent ? (
                          <div className="flex items-center gap-2">
                            <PlatformBadge platform={client.assigned_agent.platform} />
                            <span className="text-sm">{client.assigned_agent.name}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">Non assigné</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={client.status === 'active' ? 'default' : 'secondary'}
                          className={
                            client.status === 'active'
                              ? 'bg-green-500/10 text-green-600 hover:bg-green-500/20 border-green-500/30'
                              : 'bg-gray-500/10 text-gray-600 hover:bg-gray-500/20'
                          }
                        >
                          {client.status === 'active' ? 'Actif' : 'Inactif'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(client.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenMembers(client)}>
                              <Users className="mr-2 h-4 w-4" />
                              Gérer les membres
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Edit className="mr-2 h-4 w-4" />
                              Modifier
                            </DropdownMenuItem>
                            <DropdownMenuItem>
                              <Key className="mr-2 h-4 w-4" />
                              Réinitialiser mot de passe
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                toggleStatusMutation.mutate({
                                  clientId: client.id,
                                  newStatus: client.status === 'active' ? 'inactive' : 'active',
                                })
                              }
                            >
                              {client.status === 'active' ? 'Désactiver' : 'Activer'}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => deleteClientMutation.mutate(client.id)}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Supprimer
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Client Members Modal */}
      {selectedClient && (
        <ClientMembersModal
          open={membersModalOpen}
          onOpenChange={setMembersModalOpen}
          clientId={selectedClient.id}
          clientName={selectedClient.name}
        />
      )}
    </AppLayout>
  );
}
