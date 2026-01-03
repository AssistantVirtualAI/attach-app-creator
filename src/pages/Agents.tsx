import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Search, ChevronDown, Settings, Sparkles } from 'lucide-react';
import { AgentsTable } from '@/components/agents/AgentsTable';
import { AddAgentModal } from '@/components/agents/AddAgentModal';
import { EmptyState } from '@/components/agents/EmptyState';
import { useOrganization } from '@/context/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Agents() {
  const navigate = useNavigate();
  const { selectedOrgId } = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const { data: agents, isLoading, refetch } = useQuery({
    queryKey: ['agents', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Fetch client names separately due to multiple FK relationships
      const agentsWithClients = await Promise.all(
        (data || []).map(async (agent) => {
          if (agent.client_id) {
            const { data: clientData } = await supabase
              .from('clients')
              .select('id, name')
              .eq('id', agent.client_id)
              .maybeSingle();
            return { ...agent, client: clientData };
          }
          return { ...agent, client: null };
        })
      );
      
      return agentsWithClients;
    },
    enabled: !!selectedOrgId,
  });

  const filteredAgents = agents?.filter(agent => 
    agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    agent.platform.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h1 className="text-3xl font-bold">Agents IA</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos agents conversationnels
            </p>
          </div>
          <TableSkeleton rows={5} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Agents IA</h1>
            <p className="text-muted-foreground mt-1">
              Gérez vos agents conversationnels
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Nouvel agent
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setIsModalOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Via intégration
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/agent-builder')}>
                <Sparkles className="mr-2 h-4 w-4" />
                Créer avec Builder (No-Code)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {agents && agents.length > 0 ? (
          <>
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Rechercher par nom ou plateforme..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            <AgentsTable agents={filteredAgents} onRefetch={refetch} />
          </>
        ) : (
          <EmptyState 
            onCreateAgent={() => setIsModalOpen(true)} 
            onCreateWithBuilder={() => navigate('/agent-builder')}
          />
        )}

        <AddAgentModal
          open={isModalOpen}
          onOpenChange={setIsModalOpen}
          onSuccess={refetch}
        />
      </div>
    </AppLayout>
  );
}
