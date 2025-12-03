import { Card, CardContent } from '@/components/ui/card';
import { MessageSquare, Clock, Star, Users, Bot, TrendingUp, TrendingDown } from 'lucide-react';
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
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
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
          {trendValue && (
            <div className={`flex items-center gap-1 text-xs ${
              trend === 'up' ? 'text-green-500' : 
              trend === 'down' ? 'text-red-500' : 'text-muted-foreground'
            }`}>
              {trend === 'up' && <TrendingUp className="h-3 w-3" />}
              {trend === 'down' && <TrendingDown className="h-3 w-3" />}
              <span>{trendValue}</span>
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="bg-card/50 animate-pulse">
            <CardContent className="p-6 h-32" />
          </Card>
        ))}
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard
        title="Conversations"
        value={metrics.totalConversations}
        subValue={`${metrics.conversationsToday} aujourd'hui`}
        icon={MessageSquare}
        trend="up"
        trendValue={`+${metrics.conversationsThisWeek} cette semaine`}
      />
      <MetricCard
        title="Durée moyenne"
        value={formatDuration(metrics.avgDuration)}
        icon={Clock}
      />
      <MetricCard
        title="Satisfaction"
        value={`${metrics.avgSatisfaction}/5`}
        icon={Star}
        trend={metrics.avgSatisfaction >= 4 ? 'up' : metrics.avgSatisfaction >= 3 ? 'neutral' : 'down'}
      />
      <MetricCard
        title="Clients actifs"
        value={metrics.activeClients}
        subValue={`${metrics.totalAgents} agents`}
        icon={Users}
      />
    </div>
  );
};
