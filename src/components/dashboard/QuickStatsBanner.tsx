import { Card } from '@/components/ui/card';
import { 
  Phone, 
  MessageSquare, 
  Star, 
  TrendingUp, 
  TrendingDown,
  Activity
} from 'lucide-react';
import { DashboardMetrics } from '@/hooks/useDashboardMetrics';
import { motion } from 'framer-motion';

interface QuickStatsBannerProps {
  metrics: DashboardMetrics;
  isLoading?: boolean;
}

export const QuickStatsBanner = ({ metrics, isLoading }: QuickStatsBannerProps) => {
  if (isLoading) {
    return (
      <Card className="bg-gradient-to-r from-primary/5 via-secondary/5 to-primary/5 border-border/50">
        <div className="flex items-center justify-between px-6 py-3 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-muted" />
              <div className="space-y-1">
                <div className="h-3 w-16 bg-muted rounded" />
                <div className="h-4 w-10 bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  const stats = [
    {
      icon: Activity,
      label: 'En temps réel',
      value: metrics.conversationsToday > 0 ? 'Actif' : 'Calme',
      isLive: metrics.conversationsToday > 0,
      color: metrics.conversationsToday > 0 ? 'text-emerald-500' : 'text-muted-foreground',
    },
    {
      icon: MessageSquare,
      label: "Aujourd'hui",
      value: metrics.conversationsToday.toString(),
      color: 'text-primary',
    },
    {
      icon: Star,
      label: 'Satisfaction',
      value: metrics.avgSatisfaction > 0 ? `${metrics.avgSatisfaction.toFixed(1)}/5` : 'N/A',
      color: metrics.avgSatisfaction >= 4 ? 'text-emerald-500' : 
             metrics.avgSatisfaction >= 3 ? 'text-amber-500' : 'text-red-500',
    },
    {
      icon: metrics.conversationsTrend >= 0 ? TrendingUp : TrendingDown,
      label: 'Tendance',
      value: metrics.conversationsTrend !== 0 
        ? `${metrics.conversationsTrend > 0 ? '+' : ''}${metrics.conversationsTrend}%` 
        : '—',
      color: metrics.conversationsTrend > 0 ? 'text-emerald-500' : 
             metrics.conversationsTrend < 0 ? 'text-red-500' : 'text-muted-foreground',
    },
  ];

  return (
    <Card className="bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 border-border/50 overflow-hidden">
      <div className="flex items-center justify-between px-4 md:px-6 py-3 flex-wrap gap-4">
        {stats.map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            className="flex items-center gap-3"
          >
            <div className={`p-2 rounded-full bg-card/80 ${stat.color}`}>
              {stat.isLive ? (
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <stat.icon className="h-4 w-4" />
                </motion.div>
              ) : (
                <stat.icon className="h-4 w-4" />
              )}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-sm font-semibold ${stat.color}`}>{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </Card>
  );
};
