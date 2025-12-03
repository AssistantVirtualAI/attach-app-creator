import { AppLayout } from '@/components/layout/AppLayout';
import { MetricsGrid } from '@/components/dashboard/MetricsGrid';
import { ConversationsChart } from '@/components/dashboard/ConversationsChart';
import { RecentActivity } from '@/components/dashboard/RecentActivity';
import { useDashboardMetrics } from '@/hooks/useDashboardMetrics';
import { Button } from '@/components/ui/button';
import { RefreshCw, Plus, Settings } from 'lucide-react';
import { Link } from 'react-router-dom';

const Dashboard = () => {
  const { data: metrics, isLoading, refetch } = useDashboardMetrics();

  const defaultMetrics = {
    totalConversations: 0,
    conversationsToday: 0,
    conversationsThisWeek: 0,
    conversationsThisMonth: 0,
    avgSatisfaction: 0,
    avgDuration: 0,
    activeClients: 0,
    totalAgents: 0,
    platformDistribution: [],
    recentActivity: [],
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground mt-1">
              Vue d'ensemble de votre activité
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Actualiser
            </Button>
            <Link to="/agents">
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Nouvel agent
              </Button>
            </Link>
          </div>
        </div>

        {/* Metrics */}
        <MetricsGrid metrics={metrics || defaultMetrics} isLoading={isLoading} />

        {/* Charts */}
        <ConversationsChart metrics={metrics || defaultMetrics} />

        {/* Recent Activity & Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <RecentActivity metrics={metrics || defaultMetrics} />
          </div>
          <div className="space-y-4">
            <h3 className="font-semibold text-foreground">Actions rapides</h3>
            <div className="space-y-2">
              <Link to="/conversations" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Voir toutes les conversations
                </Button>
              </Link>
              <Link to="/clients" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Gérer les clients
                </Button>
              </Link>
              <Link to="/integrations" className="block">
                <Button variant="outline" className="w-full justify-start">
                  Configurer les intégrations
                </Button>
              </Link>
              <Link to="/settings" className="block">
                <Button variant="outline" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" />
                  Paramètres
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default Dashboard;
