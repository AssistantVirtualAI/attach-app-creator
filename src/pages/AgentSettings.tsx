import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Bot, Key, Palette, BarChart3, Play, Code, Brain, Activity, Users, Settings2 } from 'lucide-react';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { AgentOverviewTab } from '@/components/agents/AgentOverviewTab';
import { AgentCredentialsTab } from '@/components/agents/AgentCredentialsTab';
import { AgentWidgetTab } from '@/components/agents/AgentWidgetTab';
import { AgentAnalyticsTab } from '@/components/agents/AgentAnalyticsTab';
import { AgentPrototypeTab } from '@/components/agents/AgentPrototypeTab';
import { AgentEmbedTab } from '@/components/agents/AgentEmbedTab';
import { AgentAnalyticsWidget } from '@/components/agents/AgentAnalyticsWidget';
import { AgentKnowledgePromptTab } from '@/components/agents/AgentKnowledgePromptTab';
import { AgentClientsTab } from '@/components/agents/AgentClientsTab';
import { AgentRealtimeAnalytics } from '@/components/agents/AgentRealtimeAnalytics';
import { AgentFullConfigTab } from '@/components/agents/AgentFullConfigTab';

const AgentSettingsPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  
  const {
    agent,
    client,
    conversations,
    analytics,
    integration,
    isLoading,
    isLoadingAnalytics,
    updateAgent,
    testConnection,
    isUpdating,
    isTesting,
  } = useAgentSettings(agentId);

  if (isLoading) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-[600px] w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!agent) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p className="text-muted-foreground mb-4">Agent non trouvé</p>
          <Button onClick={() => navigate('/agents')}>
            Retour aux agents
          </Button>
        </div>
      </AppLayout>
    );
  }

  const platformAgentId = (agent.config as Record<string, any>)?.agent_id || agent.platform_agent_id;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-muted-foreground">
              {agent.platform} • {platformAgentId || 'Non configuré'}
            </p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Aperçu</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Settings2 className="h-4 w-4" />
              <span className="hidden sm:inline">Avancé</span>
            </TabsTrigger>
            <TabsTrigger value="knowledge" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">KB</span>
            </TabsTrigger>
            <TabsTrigger value="widget" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Widget</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="clients" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Clients</span>
            </TabsTrigger>
            <TabsTrigger value="health" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              <span className="hidden sm:inline">Health</span>
            </TabsTrigger>
            <TabsTrigger value="prototype" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Test</span>
            </TabsTrigger>
            <TabsTrigger value="embed" className="flex items-center gap-2">
              <Code className="h-4 w-4" />
              <span className="hidden sm:inline">Embed</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <AgentOverviewTab
              agent={agent}
              client={client}
              analytics={analytics}
              isLoadingAnalytics={isLoadingAnalytics}
            />
          </TabsContent>

          <TabsContent value="config">
            <AgentCredentialsTab
              agent={agent}
              integration={integration}
              onUpdate={updateAgent}
              onTestConnection={testConnection}
              isUpdating={isUpdating}
              isTesting={isTesting}
            />
          </TabsContent>

          <TabsContent value="advanced">
            <AgentFullConfigTab
              agentId={agentId!}
              platformAgentId={platformAgentId}
              platform={agent.platform}
              organizationId={agent.organization_id}
            />
          </TabsContent>

          <TabsContent value="knowledge">
            <AgentKnowledgePromptTab agent={agent} />
          </TabsContent>

          <TabsContent value="widget">
            <AgentWidgetTab
              agent={agent}
              onUpdate={updateAgent}
              isUpdating={isUpdating}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <div className="space-y-6">
              <AgentRealtimeAnalytics 
                agentId={agentId!}
                platformAgentId={platformAgentId}
              />
              <AgentAnalyticsTab
                conversations={conversations || []}
                analytics={analytics}
                isLoadingAnalytics={isLoadingAnalytics}
              />
            </div>
          </TabsContent>

          <TabsContent value="clients">
            <AgentClientsTab 
              agentId={agentId!} 
              organizationId={agent.organization_id}
            />
          </TabsContent>

          <TabsContent value="health">
            <AgentAnalyticsWidget agentId={agentId!} agentName={agent.name} />
          </TabsContent>

          <TabsContent value="prototype">
            <AgentPrototypeTab agent={agent} />
          </TabsContent>

          <TabsContent value="embed">
            <AgentEmbedTab agent={agent} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AgentSettingsPage;
