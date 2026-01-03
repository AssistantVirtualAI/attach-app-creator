import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { ConversationsChart } from '@/components/dashboard/ConversationsChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DataSourceIndicator } from '@/components/dashboard/DataSourceIndicator';
import { AgentPerformanceCard } from '@/components/dashboard/AgentPerformanceCard';
import { AIInsightsWidget } from '@/components/dashboard/AIInsightsWidget';
import { QuickStatsBanner } from '@/components/dashboard/QuickStatsBanner';
import { AIPriorityActions } from '@/components/dashboard/AIPriorityActions';
import { AlertsSection } from '@/components/dashboard/AlertsSection';
import { AgentSelector } from '@/components/dashboard/AgentSelector';
import { useDashboardMetrics, DashboardMetrics } from '@/hooks/useDashboardMetrics';
import { useDashboardAgents, useAgentDashboardMetrics } from '@/hooks/useDashboardAgentMetrics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, Plus, Settings, Zap, ArrowRight, Sparkles, Brain, Bot } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const Dashboard = () => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Fetch all agents for the selector
  const { data: agents = [], isLoading: isLoadingAgents } = useDashboardAgents();
  
  // Fetch global metrics (all agents)
  const { data: globalMetrics, isLoading: isLoadingGlobal, refetch: refetchGlobal } = useDashboardMetrics();
  
  // Fetch agent-specific metrics when an agent is selected
  const { data: agentMetrics, isLoading: isLoadingAgent, refetch: refetchAgent } = useAgentDashboardMetrics(selectedAgentId);

  // Use agent-specific metrics if an agent is selected, otherwise use global
  const isLoading = selectedAgentId ? isLoadingAgent : isLoadingGlobal;
  const metrics = selectedAgentId ? agentMetrics : globalMetrics;
  const refetch = selectedAgentId ? refetchAgent : refetchGlobal;

  const defaultMetrics: DashboardMetrics = {
    totalConversations: 0,
    conversationsToday: 0,
    conversationsThisWeek: 0,
    conversationsThisMonth: 0,
    previousPeriodConversations: 0,
    conversationsTrend: 0,
    incomingMessages: 0,
    previousPeriodMessages: 0,
    messagesTrend: 0,
    uniqueUsers: 0,
    previousPeriodUsers: 0,
    usersTrend: 0,
    avgInteractions: 0,
    avgSatisfaction: 0,
    avgDuration: 0,
    activeClients: 0,
    totalAgents: 0,
    platformDistribution: [],
    recentActivity: [],
    lastUpdated: new Date().toISOString(),
    dataSource: 'local' as const,
    weeklyData: [],
    agentPerformance: [],
    resolutionRate: 0,
    resolvedConversations: 0,
    sentimentBreakdown: { positive: 0, neutral: 0, negative: 0 },
    peakHours: [],
    qualityScore: 0,
    weeklyGrowth: 0,
    totalDurationMinutes: 0,
    aiInsightsAvailable: false,
    analysisCoverageRate: 0,
    topSmartTags: [],
    topImprovements: [],
  };

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('sync-elevenlabs-conversations', {
        body: { action: 'sync' }
      });
      
      if (error) throw error;
      
      toast.success(`Synchronisation réussie: ${data.synced} conversations`, {
        description: `${data.created} créées, ${data.updated} mises à jour`
      });
      
      refetch();
    } catch (error) {
      console.error('Sync error:', error);
      toast.error('Erreur de synchronisation', {
        description: 'Vérifiez la configuration de vos agents ElevenLabs'
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const currentMetrics = metrics || defaultMetrics;
  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bonjour';
    if (hour < 18) return 'Bon après-midi';
    return 'Bonsoir';
  };

  // Get health status text
  const getHealthStatus = () => {
    if (currentMetrics.avgSatisfaction >= 4) return { text: 'Vos agents performent excellemment', color: 'text-emerald-500' };
    if (currentMetrics.avgSatisfaction >= 3) return { text: 'Performance stable, quelques optimisations possibles', color: 'text-amber-500' };
    if (currentMetrics.totalConversations === 0) return { text: 'En attente de données...', color: 'text-muted-foreground' };
    return { text: 'Attention requise sur certains agents', color: 'text-red-500' };
  };

  const healthStatus = getHealthStatus();

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Hero Header */}
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/5 via-secondary/5 to-background p-6 border border-border/50"
        >
          <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-primary/10 to-transparent rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          
          <div className="relative flex flex-col gap-4">
            {/* Top row: greeting + actions */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                <motion.div 
                  className="p-3 rounded-xl bg-gradient-to-br from-primary to-secondary shadow-lg"
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity }}
                >
                  <Brain className="h-6 w-6 text-white" />
                </motion.div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
                    {getGreeting()} 👋
                  </h1>
                  <p className={`mt-1 flex items-center gap-2 ${healthStatus.color}`}>
                    <Sparkles className="h-4 w-4" />
                    {selectedAgent 
                      ? `Statistiques de ${selectedAgent.name}` 
                      : healthStatus.text}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSync}
                  disabled={isSyncing}
                  className="gap-2 bg-background/50 backdrop-blur-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
                  Synchroniser
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isLoading}
                  className="bg-background/50 backdrop-blur-sm"
                >
                  <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
                <Link to="/agents">
                  <Button size="sm" className="gap-2 shadow-lg shadow-primary/20">
                    <Plus className="h-4 w-4" />
                    Nouvel agent
                  </Button>
                </Link>
              </div>
            </div>

            {/* Agent Selector Row */}
            <div className="flex items-center justify-between border-t border-border/50 pt-4">
              <AgentSelector
                agents={agents}
                selectedAgentId={selectedAgentId}
                onAgentChange={setSelectedAgentId}
                isLoading={isLoadingAgents}
              />
              
              {selectedAgentId && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2"
                >
                  <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                    <Bot className="h-3 w-3 mr-1" />
                    Vue agent unique
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedAgentId(null)}
                    className="text-xs"
                  >
                    Voir tous
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Quick Stats Banner - Real-time */}
        <QuickStatsBanner metrics={currentMetrics} isLoading={isLoading} />

        {/* Data Source Indicator */}
        <DataSourceIndicator 
          source={currentMetrics.dataSource}
          lastUpdated={currentMetrics.lastUpdated}
          isLoading={isLoading || isSyncing}
          onSync={handleSync}
        />

        {/* AI Insights + Primary Metrics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <AIInsightsWidget />
          </div>
          <div className="lg:col-span-2">
            <MetricsGrid metrics={currentMetrics} isLoading={isLoading} />
          </div>
        </div>

        {/* Charts */}
        <ConversationsChart metrics={currentMetrics} />

        {/* Priority Actions + Alerts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AIPriorityActions />
          <AlertsSection />
        </div>

        {/* Agent Performance & Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Performance - hide if single agent selected */}
          {!selectedAgentId ? (
            <AgentPerformanceCard 
              agents={currentMetrics.agentPerformance} 
              isLoading={isLoading}
            />
          ) : (
            <Card className="glass-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  Détails Agent
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center text-white font-bold text-lg">
                    {selectedAgent?.name?.charAt(0) || 'A'}
                  </div>
                  <div>
                    <p className="font-semibold">{selectedAgent?.name}</p>
                    <p className="text-sm text-muted-foreground">ElevenLabs</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Conversations</p>
                    <p className="text-xl font-bold">{currentMetrics.totalConversations}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Satisfaction</p>
                    <p className="text-xl font-bold">{currentMetrics.avgSatisfaction.toFixed(1)}/10</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Durée moy.</p>
                    <p className="text-xl font-bold">{Math.round(currentMetrics.avgDuration)}s</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50">
                    <p className="text-xs text-muted-foreground">Résolution</p>
                    <p className="text-xl font-bold">{currentMetrics.resolutionRate}%</p>
                  </div>
                </div>

                {/* Top Tags for this agent */}
                {currentMetrics.topSmartTags.length > 0 && (
                  <div>
                    <p className="text-sm font-medium mb-2">Tags fréquents</p>
                    <div className="flex flex-wrap gap-1">
                      {currentMetrics.topSmartTags.slice(0, 4).map((t, i) => (
                        <Badge key={i} variant="secondary" className="text-xs">
                          {t.tag} ({t.count})
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Link to={`/agents/${selectedAgentId}`}>
                  <Button variant="outline" className="w-full gap-2 mt-2">
                    Voir les détails complets
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <RecentActivity metrics={currentMetrics} />
          </div>

          {/* Quick Actions */}
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Actions rapides
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link to="/conversations" className="block">
                <Button variant="ghost" className="w-full justify-between group hover:bg-primary/10">
                  <span>Voir les conversations</span>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
              <Link to="/clients" className="block">
                <Button variant="ghost" className="w-full justify-between group hover:bg-primary/10">
                  <span>Gérer les clients</span>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
              <Link to="/agent-reports" className="block">
                <Button variant="ghost" className="w-full justify-between group hover:bg-primary/10">
                  <span className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Rapports IA
                  </span>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
              <Link to="/integrations" className="block">
                <Button variant="ghost" className="w-full justify-between group hover:bg-primary/10">
                  <span>Configurer les intégrations</span>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
              <Link to="/settings" className="block">
                <Button variant="ghost" className="w-full justify-between group hover:bg-primary/10">
                  <Settings className="h-4 w-4 mr-2" />
                  <span className="flex-1 text-left">Paramètres</span>
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
