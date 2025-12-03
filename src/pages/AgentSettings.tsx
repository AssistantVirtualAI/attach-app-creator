import { useParams, useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Bot, Key, Palette, BarChart3, Play, Code } from 'lucide-react';
import { useAgentSettings } from '@/hooks/useAgentSettings';
import { AgentOverviewTab } from '@/components/agents/AgentOverviewTab';
import { AgentCredentialsTab } from '@/components/agents/AgentCredentialsTab';
import { AgentWidgetTab } from '@/components/agents/AgentWidgetTab';
import { AgentAnalyticsTab } from '@/components/agents/AgentAnalyticsTab';
import { AgentPrototypeTab } from '@/components/agents/AgentPrototypeTab';
import { AgentEmbedTab } from '@/components/agents/AgentEmbedTab';

const AgentSettingsPage = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const navigate = useNavigate();
  
  const {
    agent,
    client,
    conversations,
    analytics,
    isLoading,
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{agent.name}</h1>
            <p className="text-muted-foreground">{agent.platform} • {agent.platform_agent_id || 'Non configuré'}</p>
          </div>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              <span className="hidden sm:inline">Aperçu</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="widget" className="flex items-center gap-2">
              <Palette className="h-4 w-4" />
              <span className="hidden sm:inline">Widget</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Analytics</span>
            </TabsTrigger>
            <TabsTrigger value="prototype" className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              <span className="hidden sm:inline">Prototype</span>
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
            />
          </TabsContent>

          <TabsContent value="config">
            <AgentCredentialsTab
              agent={agent}
              onUpdate={updateAgent}
              onTestConnection={testConnection}
              isUpdating={isUpdating}
              isTesting={isTesting}
            />
          </TabsContent>

          <TabsContent value="widget">
            <AgentWidgetTab
              agent={agent}
              onUpdate={updateAgent}
              isUpdating={isUpdating}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <AgentAnalyticsTab
              conversations={conversations || []}
              analytics={analytics}
            />
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
