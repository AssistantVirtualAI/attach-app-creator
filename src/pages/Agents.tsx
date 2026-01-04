import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Plus, Search, ChevronDown, Settings, Sparkles, Bot, Zap, TrendingUp } from 'lucide-react';
import { AgentsTable } from '@/components/agents/AgentsTable';
import { AddAgentModal } from '@/components/agents/AddAgentModal';
import { EmptyState } from '@/components/agents/EmptyState';
import { useOrganization } from '@/context/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TableSkeleton } from '@/components/LoadingSkeleton';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { useTranslation } from '@/hooks/useTranslation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export default function Agents() {
  const { t } = useTranslation();
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
      
      // Fetch assigned clients from client_agent_assignments table
      const agentsWithClients = await Promise.all(
        (data || []).map(async (agent) => {
          // First check client_agent_assignments (many-to-many relationship)
          const { data: assignments } = await supabase
            .from('client_agent_assignments')
            .select('client:clients(id, name)')
            .eq('agent_id', agent.id)
            .limit(1);
          
          if (assignments && assignments.length > 0 && assignments[0].client) {
            return { ...agent, client: assignments[0].client };
          }
          
          // Fallback to direct client_id if exists
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
          <PortalPageHeader
            title={t('agents.title')}
            description={t('agents.description')}
            icon={Bot}
          />
          <TableSkeleton rows={5} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PortalPageHeader
            title={t('agents.title')}
            description={t('agents.description')}
            icon={Bot}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button className="bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 border-0 shadow-lg">
                <Plus className="mr-2 h-4 w-4" />
                {t('agents.newAgent')}
                <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="bg-popover border-border">
              <DropdownMenuItem onClick={() => setIsModalOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                {t('agents.viaIntegration')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate('/agent-builder')}>
                <Sparkles className="mr-2 h-4 w-4" />
                {t('agents.createWithBuilder')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: t('agents.stats.totalAgents'), value: agents?.length || 0, icon: Bot, gradient: 'from-primary to-secondary' },
            { label: t('agents.stats.elevenlabs'), value: agents?.filter(a => a.platform === 'elevenlabs').length || 0, icon: Zap, gradient: 'from-secondary to-accent' },
            { label: t('agents.stats.withClients'), value: agents?.filter(a => a.client).length || 0, icon: TrendingUp, gradient: 'from-success to-neon-green' },
            { label: t('agents.stats.thisMonth'), value: agents?.filter(a => new Date(a.created_at).getMonth() === new Date().getMonth()).length || 0, icon: Plus, gradient: 'from-warning to-sunset-orange' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden border border-border bg-card">
                <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-10`} />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                      <stat.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {agents && agents.length > 0 ? (
          <>
            {/* Search */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
            >
              <Card className="border border-border bg-card">
                <CardContent className="p-4">
                  <div className="relative max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder={t('agents.searchPlaceholder')}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 bg-muted/50 border-border focus:border-primary"
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Table */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <AgentsTable agents={filteredAgents} onRefetch={refetch} />
            </motion.div>
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