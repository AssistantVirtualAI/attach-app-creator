import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { useClientElevenLabsAnalytics } from '@/hooks/useClientElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  BarChart3, 
  Clock, 
  MessageSquare, 
  Phone,
  ThumbsUp,
  TrendingUp,
  TrendingDown,
  Calendar
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';

type Timeframe = '24h' | '7d' | '30d' | '90d';

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  trendValue,
  isLoading 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  isLoading?: boolean;
}) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <>
              <p className="text-2xl font-bold">{value}</p>
              {trendValue && (
                <p className={`text-xs flex items-center gap-1 mt-1 ${
                  trend === 'up' ? 'text-green-600' : 
                  trend === 'down' ? 'text-red-600' : 'text-muted-foreground'
                }`}>
                  {trend === 'up' ? <TrendingUp className="h-3 w-3" /> : 
                   trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
                  {trendValue}
                </p>
              )}
            </>
          )}
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ClientAgentAnalytics = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName } = useClientAgentAccess(clientId, agentId);
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');

  const { data: analytics, isLoading } = useClientElevenLabsAnalytics({
    apiKey,
    agentId: elevenlabsAgentId,
  }, timeframe);

  const metrics = analytics?.metrics || {};
  const trends = analytics?.trends || {};
  const chartData = analytics?.charts?.conversations_over_time || [];

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: '24h', label: '24h' },
    { value: '7d', label: '7 jours' },
    { value: '30d', label: '30 jours' },
    { value: '90d', label: '90 jours' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Statistiques de performance de {agentName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {timeframeOptions.map(({ value, label }) => (
            <Button
              key={value}
              variant={timeframe === value ? 'default' : 'outline'}
              size="sm"
              onClick={() => setTimeframe(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Conversations"
          value={metrics.total_conversations || 0}
          icon={MessageSquare}
          trend={trends.conversations?.direction}
          trendValue={trends.conversations?.value}
          isLoading={isLoading}
        />
        <StatCard
          title="Durée Totale"
          value={metrics.total_duration ? `${Math.round(metrics.total_duration / 3600)}h` : '0h'}
          icon={Clock}
          isLoading={isLoading}
        />
        <StatCard
          title="Durée Moyenne"
          value={metrics.avg_duration ? `${Math.round(metrics.avg_duration / 60)}min` : '0min'}
          icon={Phone}
          trend={trends.duration?.direction}
          trendValue={trends.duration?.value}
          isLoading={isLoading}
        />
        <StatCard
          title="Satisfaction"
          value={metrics.avg_satisfaction ? `${Math.round(metrics.avg_satisfaction * 100)}%` : 'N/A'}
          icon={ThumbsUp}
          trend={trends.satisfaction?.direction}
          trendValue={trends.satisfaction?.value}
          isLoading={isLoading}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Conversations par jour
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Pas de données pour cette période
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Bar 
                    dataKey="count" 
                    fill="hsl(var(--primary))" 
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Durée moyenne par jour
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Pas de données pour cette période
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={256}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis 
                    className="text-xs"
                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avg_duration" 
                    stroke="hsl(var(--primary))" 
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClientAgentAnalytics;
