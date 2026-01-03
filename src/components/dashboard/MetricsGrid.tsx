import { Card, CardContent } from '@/components/ui/card';
import { 
  MessageSquare, Clock, Users, Bot, TrendingUp, TrendingDown, 
  UserCheck, Star, CheckCircle, Smile, Activity, Timer
} from 'lucide-react';
import { DashboardMetrics } from '@/hooks/useDashboardMetrics';
import { motion } from 'framer-motion';

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
  delay = 0,
}: {
  title: string;
  value: string | number;
  subValue?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  previousValue?: string;
  accentColor?: 'primary' | 'emerald' | 'amber' | 'purple' | 'cyan' | 'pink';
  delay?: number;
}) => {
  const colorClasses = {
    primary: 'bg-primary/10 text-primary',
    emerald: 'bg-emerald-500/10 text-emerald-500',
    amber: 'bg-amber-500/10 text-amber-500',
    purple: 'bg-purple-500/10 text-purple-500',
    cyan: 'bg-cyan-500/10 text-cyan-500',
    pink: 'bg-pink-500/10 text-pink-500',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card className="glass-card metric-card-hover">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium">{title}</p>
              <p className="text-2xl font-bold text-foreground tracking-tight">{value}</p>
              {subValue && (
                <p className="text-xs text-muted-foreground">{subValue}</p>
              )}
              {(trendValue || previousValue) && (
                <div className="flex items-center gap-2 pt-0.5">
                  {trendValue && (
                    <div className={`flex items-center gap-1 text-xs font-semibold ${
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
            <div className={`p-2.5 rounded-xl ${colorClasses[accentColor]} transition-transform duration-200 group-hover:scale-110`}>
              <Icon className="h-4 w-4" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
};

export const MetricsGrid = ({ metrics, isLoading }: MetricsGridProps) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="glass-card animate-pulse">
              <CardContent className="p-4 h-24" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const formatDuration = (seconds: number) => {
    if (!seconds) return '0m';
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    if (mins === 0) return `${secs}s`;
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

  // Calculate sentiment percentage for display
  const totalSentiment = metrics.sentimentBreakdown.positive + metrics.sentimentBreakdown.neutral + metrics.sentimentBreakdown.negative;
  const positivePercent = totalSentiment > 0 
    ? Math.round((metrics.sentimentBreakdown.positive / totalSentiment) * 100) 
    : 0;

  return (
    <div className="space-y-3">
      {/* Primary metrics - 3 columns */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <MetricCard
          title="Total Conversations"
          value={metrics.totalConversations.toLocaleString()}
          subValue={`${metrics.conversationsToday} aujourd'hui`}
          icon={MessageSquare}
          trend={getTrend(metrics.conversationsTrend)}
          trendValue={metrics.conversationsTrend !== 0 ? formatTrendValue(metrics.conversationsTrend) : undefined}
          accentColor="primary"
          delay={0}
        />
        <MetricCard
          title="Cette Semaine"
          value={metrics.conversationsThisWeek.toLocaleString()}
          subValue="7 derniers jours"
          icon={TrendingUp}
          accentColor="emerald"
          delay={0.05}
        />
        <MetricCard
          title="Satisfaction"
          value={metrics.avgSatisfaction > 0 ? `${metrics.avgSatisfaction.toFixed(1)}/5` : 'N/A'}
          subValue="score moyen"
          icon={Star}
          trend={metrics.avgSatisfaction >= 4 ? 'up' : metrics.avgSatisfaction >= 3 ? 'neutral' : 'down'}
          accentColor="amber"
          delay={0.1}
        />
        <MetricCard
          title="Taux Résolution"
          value={`${metrics.resolutionRate}%`}
          subValue={`${metrics.resolvedConversations} résolues`}
          icon={CheckCircle}
          trend={metrics.resolutionRate >= 80 ? 'up' : metrics.resolutionRate >= 60 ? 'neutral' : 'down'}
          accentColor="emerald"
          delay={0.15}
        />
        <MetricCard
          title="Sentiment Positif"
          value={`${positivePercent}%`}
          subValue={`${metrics.sentimentBreakdown.positive} positifs`}
          icon={Smile}
          trend={positivePercent >= 60 ? 'up' : positivePercent >= 40 ? 'neutral' : 'down'}
          accentColor="cyan"
          delay={0.2}
        />
        <MetricCard
          title="Durée Moyenne"
          value={formatDuration(metrics.avgDuration)}
          subValue="par conversation"
          icon={Clock}
          accentColor="purple"
          delay={0.25}
        />
      </div>

      {/* Secondary metrics - 4 columns on larger screens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          title="Clients Actifs"
          value={metrics.activeClients}
          subValue="comptes actifs"
          icon={Users}
          delay={0.3}
        />
        <MetricCard
          title="Agents IA"
          value={metrics.totalAgents}
          subValue="configurés"
          icon={Bot}
          accentColor="purple"
          delay={0.35}
        />
        <MetricCard
          title="Utilisateurs"
          value={metrics.uniqueUsers}
          subValue="cette semaine"
          icon={UserCheck}
          trend={getTrend(metrics.usersTrend)}
          trendValue={metrics.usersTrend !== 0 ? formatTrendValue(metrics.usersTrend) : undefined}
          accentColor="cyan"
          delay={0.4}
        />
        <MetricCard
          title="Score Qualité"
          value={metrics.qualityScore > 0 ? `${metrics.qualityScore}%` : 'N/A'}
          subValue="performance IA"
          icon={Activity}
          trend={metrics.qualityScore >= 80 ? 'up' : metrics.qualityScore >= 60 ? 'neutral' : 'down'}
          accentColor="pink"
          delay={0.45}
        />
      </div>
    </div>
  );
};
