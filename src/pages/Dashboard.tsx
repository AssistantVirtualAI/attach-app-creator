import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { ConversationsChart } from '@/components/dashboard/ConversationsChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { DataSourceIndicator } from '@/components/dashboard/DataSourceIndicator';
import { AgentPerformanceCard } from '@/components/dashboard/AgentPerformanceCard';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Plus, Settings, Zap, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const Dashboard = () => {
  const { data: metrics, isLoading, refetch } = useDashboardMetrics();
  const [isSyncing, setIsSyncing] = useState(false);

  const defaultMetrics = {
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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de votre activité en temps réel
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
              Synchroniser
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Link to="/agents">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvel agent
              </Button>
            </Link>
          </div>
        </div>

        {/* Data Source Indicator */}
        <DataSourceIndicator 
          source={currentMetrics.dataSource}
          lastUpdated={currentMetrics.lastUpdated}
          isLoading={isLoading || isSyncing}
          onSync={handleSync}
        />

        {/* Metrics */}
        <MetricsGrid metrics={currentMetrics} isLoading={isLoading} />

        {/* Charts */}
        <ConversationsChart metrics={currentMetrics} />

        {/* Agent Performance & Recent Activity */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Performance */}
          <AgentPerformanceCard 
            agents={currentMetrics.agentPerformance} 
            isLoading={isLoading}
          />

          {/* Recent Activity */}
          <div className="lg:col-span-1">
            <RecentActivity metrics={currentMetrics} />
          </div>

          {/* Quick Actions */}
          <Card className="bg-card/50 backdrop-blur-sm border-border/50">
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
