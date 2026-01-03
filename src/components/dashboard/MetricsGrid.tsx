import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Clock, Users, Bot, TrendingUp, TrendingDown, Mail, UserCheck, Star } from 'lucide-react';
import { DashboardMetrics } from '@/hooks/useDashboardMetrics';

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
  accentColor = 'primary',
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  previousValue?: string;
  accentColor?: 'primary' | 'emerald' | 'amber' | 'purple';
}) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    purple: 'bg-purple-500/10 text-purple-500',
  };

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 group">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="space-y-1.5">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold text-foreground tracking-tight">{value}</p>
            {subValue && (
              <p className="text-xs text-muted-foreground">{subValue}</p>
            )}
            {(trendValue || previousValue) && (
              <div className="flex items-center gap-2 pt-1">
                {trendValue && (
                  <div className={`flex items-center gap-1 text-xs font-semibold ${
                    trend === 'up' ? 'text-emerald-500' : 
                    trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
                  }`}>
                    {trend === 'up' && <TrendingUp className="h-3.5 w-3.5" />}
                    {trend === 'down' && <TrendingDown className="h-3.5 w-3.5" />}
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
          <div className={`p-3 rounded-xl ${colorClasses[accentColor]} group-hover:scale-110 transition-transform duration-300`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export const MetricsGrid = ({ metrics, isLoading }: MetricsGridProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-card/50 animate-pulse">
              <CardContent className="p-5 h-32" />
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-card/50 animate-pulse">
              <CardContent className="p-5 h-28" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m 0s';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
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

  return (
    <div className="space-y-4">
      {/* Primary metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Conversations"
          value={metrics.totalConversations.toLocaleString()}
          subValue={`${metrics.conversationsToday} aujourd'hui`}
          icon={MessageSquare}
          trend={getTrend(metrics.conversationsTrend)}
          trendValue={metrics.conversationsTrend !== 0 ? formatTrendValue(metrics.conversationsTrend) : undefined}
          previousValue={metrics.previousPeriodConversations > 0 ? `${metrics.previousPeriodConversations} sem. préc.` : undefined}
          accentColor="primary"
        />
        <MetricCard
          title="Cette Semaine"
          value={metrics.conversationsThisWeek.toLocaleString()}
          subValue="7 derniers jours"
          icon={TrendingUp}
          accentColor="emerald"
        />
        <MetricCard
          title="Satisfaction Moyenne"
          value={metrics.avgSatisfaction > 0 ? `${metrics.avgSatisfaction.toFixed(1)}/5` : 'N/A'}
          subValue="score moyen"
          icon={Star}
          trend={metrics.avgSatisfaction >= 4 ? 'up' : metrics.avgSatisfaction >= 3 ? 'neutral' : 'down'}
          accentColor="amber"
        />
        <MetricCard
          title="Durée Moyenne"
          value={formatDuration(metrics.avgDuration)}
          subValue="par conversation"
          icon={Clock}
          accentColor="purple"
        />
      </div>

      {/* Secondary metrics row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <MetricCard
          title="Clients Actifs"
          value={metrics.activeClients}
          subValue="comptes actifs"
          icon={Users}
        />
        <MetricCard
          title="Agents Configurés"
          value={metrics.totalAgents}
          subValue="agents IA"
          icon={Bot}
          accentColor="purple"
        />
        <MetricCard
          title="Utilisateurs Uniques"
          value={metrics.uniqueUsers}
          subValue="cette semaine"
          icon={UserCheck}
          trend={getTrend(metrics.usersTrend)}
          trendValue={metrics.usersTrend !== 0 ? formatTrendValue(metrics.usersTrend) : undefined}
          accentColor="emerald"
        />
      </div>
    </div>
  );
};
