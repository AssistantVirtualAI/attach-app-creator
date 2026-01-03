import { Users, Bot, MessageSquare, TrendingUp } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useClientsMetrics } from '@/hooks/useClientsMetrics';

export function ClientsDashboard() {
  const { data: metrics, isLoading } = useClientsMetrics();

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="glass-card">
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-6 w-12" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const stats = [
    {
      title: 'Total Clients',
      value: metrics?.totalClients || 0,
      subtitle: `${metrics?.activeClients || 0} actifs, ${metrics?.inactiveClients || 0} inactifs`,
      icon: Users,
      gradient: 'from-blue-500 to-cyan-500',
    },
    {
      title: 'Agents Assignés',
      value: metrics?.assignedAgents || 0,
      subtitle: metrics?.totalClients 
        ? `${Math.round(((metrics.totalClients - (metrics?.clientsWithoutAgent || 0)) / metrics.totalClients) * 100)}% de couverture`
        : '0% de couverture',
      icon: Bot,
      gradient: 'from-purple-500 to-pink-500',
    },
    {
      title: 'Conversations',
      value: metrics?.totalConversations || 0,
      subtitle: `${metrics?.resolvedConversations || 0} résolues`,
      icon: MessageSquare,
      gradient: 'from-green-500 to-emerald-500',
    },
    {
      title: 'Performance',
      value: metrics?.totalConversations 
        ? `${Math.round((metrics?.resolvedConversations || 0) / metrics.totalConversations * 100)}%`
        : '0%',
      subtitle: `${(metrics?.avgDuration || 0).toFixed(1)} min en moyenne`,
      icon: TrendingUp,
      gradient: 'from-orange-500 to-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      {stats.map((stat, index) => (
        <Card key={index} className="glass-card hover:shadow-lg transition-shadow">
          <CardContent className="p-4">
            <div className="flex items-start gap-4">
              <div className={`p-2.5 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-muted-foreground">{stat.title}</p>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground truncate">{stat.subtitle}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
