import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { Users, Clock, Star, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useElevenLabsAnalytics } from '@/hooks/useElevenLabsAnalytics';
import { SetupIntegrationCard } from '@/components/SetupIntegrationCard';
import { StatCardSkeleton, ChartCardSkeleton } from '@/components/LoadingSkeleton';

const VoiceAnalytics = () => {
  const [timeframe, setTimeframe] = useState('7days');
  const { data: analytics, isLoading, error } = useElevenLabsAnalytics(timeframe);

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  const stats = analytics ? [
    {
      title: 'Total Conversations',
      value: analytics.metrics.total_conversations.toString(),
      change: `${analytics.trends.conversations_change > 0 ? '+' : ''}${analytics.trends.conversations_change.toFixed(1)}%`,
      changeType: analytics.trends.conversations_change >= 0 ? 'positive' as const : 'negative' as const,
      icon: Phone,
      trend: [45, 52, 48, 65, 58, 72, 68],
    },
    {
      title: 'Durée Moyenne',
      value: formatDuration(Math.floor(analytics.metrics.avg_conversation_duration)),
      change: `${analytics.trends.duration_change > 0 ? '+' : ''}${analytics.trends.duration_change.toFixed(1)}%`,
      changeType: analytics.trends.duration_change >= 0 ? 'positive' as const : 'negative' as const,
      icon: Clock,
      trend: [30, 42, 38, 55, 48, 62, 58],
    },
    {
      title: 'Satisfaction',
      value: `${analytics.metrics.satisfaction_score.toFixed(1)}/5`,
      change: `${analytics.trends.satisfaction_change > 0 ? '+' : ''}${analytics.trends.satisfaction_change.toFixed(1)}`,
      changeType: analytics.trends.satisfaction_change >= 0 ? 'positive' as const : 'negative' as const,
      icon: Star,
      trend: [75, 78, 80, 82, 81, 85, 87],
    },
    {
      title: 'Taux de Succès',
      value: `${analytics.metrics.success_rate.toFixed(1)}%`,
      change: `${analytics.trends.success_rate_change > 0 ? '+' : ''}${analytics.trends.success_rate_change.toFixed(1)}%`,
      changeType: analytics.trends.success_rate_change >= 0 ? 'positive' as const : 'negative' as const,
      icon: Users,
      trend: [40, 48, 45, 58, 52, 65, 70],
    },
  ] : [];

  const platformData = [
    { platform: 'ElevenLabs', value: analytics?.metrics.total_conversations || 0 },
  ];

  const sentimentData = analytics?.charts?.satisfaction_trend || [];

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Voice Analytics</h1>
            <p className="text-muted-foreground text-lg">
              Analyse détaillée des performances vocales IA
            </p>
          </div>
          <Select value={timeframe} onValueChange={setTimeframe}>
            <SelectTrigger className="w-[180px] glass-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Dernières 24h</SelectItem>
              <SelectItem value="7days">7 derniers jours</SelectItem>
              <SelectItem value="30days">30 derniers jours</SelectItem>
              <SelectItem value="90days">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Grid */}
        {analytics?.requiresSetup ? (
          <SetupIntegrationCard 
            title="Configuration Requise" 
            message={analytics.message} 
          />
        ) : isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <StatCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <Card className="glass-card border-destructive/50">
            <CardContent className="pt-6">
              <p className="text-destructive">Erreur lors du chargement des analytics</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <StatCard key={index} {...stat} />
            ))}
          </div>
        )}

        {/* Charts Grid */}
        {!analytics?.requiresSetup && (
          isLoading ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ChartCardSkeleton />
              <ChartCardSkeleton />
            </div>
          ) : !error && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
              <ChartCard
                title="Conversations par Plateforme"
                data={platformData}
                type="bar"
                dataKey="value"
                xAxisKey="platform"
              />
              {sentimentData.length > 0 && (
                <ChartCard
                  title="Tendance de Satisfaction"
                  data={sentimentData}
                  type="area"
                  dataKey="positive"
                  xAxisKey="day"
                />
              )}
            </div>
          )
        )}

        {/* Top Keywords */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Mots-clés Populaires</CardTitle>
            <CardDescription>Les sujets les plus discutés cette semaine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {['Support Client', 'Facturation', 'Produit', 'Installation', 'Livraison', 'Retour', 'Garantie', 'Paiement'].map((keyword) => (
                <div
                  key={keyword}
                  className="px-4 py-2 rounded-full bg-primary/20 text-primary border border-primary/30 text-sm font-medium"
                >
                  {keyword}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default VoiceAnalytics;