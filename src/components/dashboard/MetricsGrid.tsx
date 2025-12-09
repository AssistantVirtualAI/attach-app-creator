import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Clock, Users, Bot, TrendingUp, TrendingDown, Mail, UserCheck } from 'lucide-react';
import { DashboardMetrics } from '@/hooks/useDashboardMetrics';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface MetricsGridProps {
  metrics: DashboardMetrics;
  isLoading: boolean;
}

const MetricCard = ({
  title,
  value,
  subValue,
  icon: Icon,
  trend,
  trendValue,
  previousValue,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  previousValue?: string;
}) => (
  <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 transition-all">
    <CardContent className="p-6">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="text-3xl font-bold text-foreground">{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          )}
          {(trendValue || previousValue) && (
            <div className="flex items-center gap-2">
              {trendValue && (
                <div className={`flex items-center gap-1 text-xs font-medium ${
                  trend === 'up' ? 'text-emerald-500' : 
                  trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                }`}>
                  {trend === 'up' && <TrendingUp className="h-3 w-3" />}
                  {trend === 'down' && <TrendingDown className="h-3 w-3" />}
                  <span>{trendValue}</span>
                </div>
              )}
              {previousValue && (
                <span className="text-xs text-muted-foreground">
                  vs {previousValue}
                </span>
              )}
            </div>
          )}
        </div>
        <div className="p-3 rounded-lg bg-primary/10">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

export const MetricsGrid = ({ metrics, isLoading }: MetricsGridProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card/50 animate-pulse">
              <CardContent className="p-6 h-32" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const getTrend = (value: number): 'up' | 'down' | 'neutral' => {
    if (value > 0) return 'up';
    if (value < 0) return 'down';
    return 'neutral';
  };

  const formatTrendValue = (value: number): string => {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value}%`;
  };

  const lastUpdated = metrics.lastUpdated 
    ? format(new Date(metrics.lastUpdated), "d MMM 'à' HH:mm", { locale: fr })
    : '';

  return (
    <div className="space-y-4">
      {/* Last updated indicator */}
      <div className="flex justify-end">
        <span className="text-xs text-muted-foreground">
          Mis à jour le {lastUpdated}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Conversations"
          value={metrics.totalConversations}
          subValue={`${metrics.conversationsToday} aujourd'hui`}
          icon={MessageSquare}
          trend={getTrend(metrics.conversationsTrend)}
          trendValue={formatTrendValue(metrics.conversationsTrend)}
          previousValue={`${metrics.previousPeriodConversations} sem. préc.`}
        />
        <MetricCard
          title="Messages Entrants"
          value={metrics.incomingMessages}
          subValue="cette semaine"
          icon={Mail}
          trend={getTrend(metrics.messagesTrend)}
          trendValue={formatTrendValue(metrics.messagesTrend)}
          previousValue={`${metrics.previousPeriodMessages} sem. préc.`}
        />
        <MetricCard
          title="Interactions Moy."
          value={metrics.avgInteractions}
          subValue="par conversation"
          icon={TrendingUp}
        />
        <MetricCard
          title="Utilisateurs Uniques"
          value={metrics.uniqueUsers}
          subValue="cette semaine"
          icon={UserCheck}
          trend={getTrend(metrics.usersTrend)}
          trendValue={formatTrendValue(metrics.usersTrend)}
          previousValue={`${metrics.previousPeriodUsers} sem. préc.`}
        />
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Durée Moyenne"
          value={formatDuration(metrics.avgDuration)}
          icon={Clock}
        />
        <MetricCard
          title="Clients Actifs"
          value={metrics.activeClients}
          subValue={`${metrics.totalAgents} agents`}
          icon={Users}
        />
        <MetricCard
          title="Satisfaction"
          value={`${metrics.avgSatisfaction}/5`}
          icon={Bot}
          trend={metrics.avgSatisfaction >= 4 ? 'up' : metrics.avgSatisfaction >= 3 ? 'neutral' : 'down'}
        />
      </div>
    </div>
  );
};
