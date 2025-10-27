import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search, Key, Trash2 } from 'lucide-react';
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
import { PlatformBadge } from '@/components/agents/PlatformBadge';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

export default function Clients() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [newClient, setNewClient] = useState({
    name: '',
    email: '',
    username: '',
    password: '',
    assignedAgentId: '',
  });

  const { data: clients, isLoading, refetch } = useQuery({
    queryKey: ['clients', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select(`
          *,
          assigned_agent:agents(id, name, platform)
        `)
        .eq('organization_id', selectedOrgId)
        .order('created_at', { ascending: false });

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

  const handleCreate = async () => {
    const { name, email, username, password, assignedAgentId } = newClient;

    if (!name || !email || !username || !password || !assignedAgentId) {
      toast({
        title: 'Erreur',
        description: 'Tous les champs sont requis',
        variant: 'destructive',
      });
      return;
    }

    if (password.length < 8) {
      toast({
        title: 'Erreur',
        description: 'Le mot de passe doit contenir au moins 8 caractères',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Utilisateur non authentifié');

      // 1. Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          full_name: name,
          username: username,
          client_type: 'agent',
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('Utilisateur non créé');

      // 2. Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email,
          full_name: name,
        });

      if (profileError) throw profileError;

      // 3. Create client entry
      const { error: clientError } = await supabase
        .from('clients')
        .insert({
          organization_id: selectedOrgId,
          name,
          email,
          username,
          user_id: authData.user.id,
          assigned_agent_id: assignedAgentId,
          status: 'active',
          created_by: user.id,
        });

      if (clientError) throw clientError;

      // 4. Add as organization member
      const { error: memberError } = await supabase
        .from('organization_members')
        .insert({
          user_id: authData.user.id,
          organization_id: selectedOrgId,
          accepted_at: new Date().toISOString(),
        });

      if (memberError) throw memberError;

      // 5. Assign agent role
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: authData.user.id,
          organization_id: selectedOrgId,
          role: 'agent',
        });

      if (roleError) throw roleError;

      toast({
        title: 'Succès',
        description: `Client créé ! Identifiants envoyés à ${email}`,
      });

      setOpen(false);
      setNewClient({ name: '', email: '', username: '', password: '', assignedAgentId: '' });
      refetch();
    } catch (error: any) {
      console.error('Erreur création client:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la création du client',
        variant: 'destructive',
      });
    }
  };

  const filteredClients = clients?.filter((client) =>
    client.name.toLowerCase().includes(search.toLowerCase())
  ) || [];

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

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
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

        <div className="glass-card p-6">
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher un client..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nom</TableHead>
                <TableHead>Username</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Agent assigné</TableHead>
                <TableHead>Statut</TableHead>
                <TableHead>Date de création</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : filteredClients.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    Aucun client trouvé
                  </TableCell>
                </TableRow>
              ) : (
                filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">{client.name}</TableCell>
                    <TableCell>
                      {client.username && (
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {client.username}
                        </code>
                      )}
                    </TableCell>
                    <TableCell>{client.email}</TableCell>
                    <TableCell>
                      {client.assigned_agent && (
                        <div className="flex items-center gap-2">
                          <PlatformBadge platform={client.assigned_agent.platform} />
                          <span className="text-sm">{client.assigned_agent.name}</span>
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          client.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {client.status}
                      </span>
                    </TableCell>
                    <TableCell>
                      {new Date(client.created_at).toLocaleDateString('fr-FR')}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" title="Réinitialiser mot de passe">
                        <Key className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Supprimer">
                        <Trash2 className="h-4 w-4 text-destructive" />
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
