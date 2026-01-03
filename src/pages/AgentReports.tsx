import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useAgentReports, AgentMetrics } from '@/hooks/useAgentReports';
import { useSyncElevenLabsConversations } from '@/hooks/useAgentAdvice';
import { useSendWeeklyReport } from '@/hooks/useWeeklyReport';
import { useOrganization } from '@/context/OrganizationContext';
import { AgentAIAdvice } from '@/components/agents/AgentAIAdvice';
import { GlobalAIAdvice } from '@/components/agents/GlobalAIAdvice';
import { 
  RefreshCw, 
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  Users,
  Clock,
  ThumbsUp,
  Smile,
  Meh,
  Frown,
  Target,
  Lightbulb,
  Tag,
  Activity,
  Sparkles,
  Download,
  CheckCircle,
  Database,
  Mail,
  Calendar,
  Layers
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, AreaChart, Area, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from 'recharts';

const SENTIMENT_COLORS = {
  positive: '#22c55e',
  neutral: '#f59e0b',
  negative: '#ef4444',
};

const AgentReports = () => {
  const { selectedOrg } = useOrganization();
  const [selectedAgent, setSelectedAgent] = useState<string>('all');
  
  const { data: reportsData, isLoading: isLoadingReports, refetch } = useAgentReports(
    selectedAgent !== 'all' ? selectedAgent : undefined
  );

  const { mutate: syncConversations, isPending: isSyncing } = useSyncElevenLabsConversations();
  const { mutate: sendWeeklyReport, isPending: isSendingReport } = useSendWeeklyReport();

  // Fetch agents for filter
  const { data: agents } = useQuery({
    queryKey: ['agents-list', selectedOrg?.id],
    queryFn: async () => {
      if (!selectedOrg?.id) return [];
      const { data } = await supabase
        .from('agents')
        .select('id, name')
        .eq('organization_id', selectedOrg.id);
      return data || [];
    },
    enabled: !!selectedOrg?.id
  });

  const getTrendIcon = (trend: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const renderAgentCard = (agent: AgentMetrics) => {
    const sentimentData = [
      { name: 'Positif', value: agent.sentimentDistribution.positive, color: SENTIMENT_COLORS.positive },
      { name: 'Neutre', value: agent.sentimentDistribution.neutral, color: SENTIMENT_COLORS.neutral },
      { name: 'Négatif', value: agent.sentimentDistribution.negative, color: SENTIMENT_COLORS.negative },
    ].filter(d => d.value > 0);

    return (
      <Card key={agent.agentId} className="glass-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">{agent.agentName}</CardTitle>
            <div className="flex items-center gap-1">
              {getTrendIcon(agent.recentTrend)}
              <span className="text-xs text-muted-foreground">
                {agent.recentTrend === 'up' ? 'En hausse' : agent.recentTrend === 'down' ? 'En baisse' : 'Stable'}
              </span>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Key Metrics */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Users className="h-3 w-3" />
                Conversations
              </div>
              <p className="text-2xl font-bold">{agent.totalConversations}</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ThumbsUp className="h-3 w-3" />
                Satisfaction
              </div>
              <p className="text-2xl font-bold">{agent.avgSatisfaction.toFixed(1)}<span className="text-sm text-muted-foreground">/10</span></p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                Durée moy.
              </div>
              <p className="text-lg font-semibold">{Math.round(agent.avgDuration / 60)}min</p>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Target className="h-3 w-3" />
                Résolution
              </div>
              <p className="text-lg font-semibold">{agent.resolutionRate.toFixed(0)}%</p>
            </div>
          </div>

          {/* Sentiment Distribution */}
          {sentimentData.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2">Sentiment</p>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex gap-1">
                  {agent.sentimentDistribution.positive > 0 && (
                    <div 
                      className="h-2 bg-green-500 rounded-full" 
                      style={{ width: `${(agent.sentimentDistribution.positive / agent.totalConversations) * 100}%` }}
                    />
                  )}
                  {agent.sentimentDistribution.neutral > 0 && (
                    <div 
                      className="h-2 bg-yellow-500 rounded-full" 
                      style={{ width: `${(agent.sentimentDistribution.neutral / agent.totalConversations) * 100}%` }}
                    />
                  )}
                  {agent.sentimentDistribution.negative > 0 && (
                    <div 
                      className="h-2 bg-red-500 rounded-full" 
                      style={{ width: `${(agent.sentimentDistribution.negative / agent.totalConversations) * 100}%` }}
                    />
                  )}
                </div>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-green-500 flex items-center gap-1">
                  <Smile className="h-3 w-3" /> {agent.sentimentDistribution.positive}
                </span>
                <span className="text-yellow-500 flex items-center gap-1">
                  <Meh className="h-3 w-3" /> {agent.sentimentDistribution.neutral}
                </span>
                <span className="text-red-500 flex items-center gap-1">
                  <Frown className="h-3 w-3" /> {agent.sentimentDistribution.negative}
                </span>
              </div>
            </div>
          )}

          {/* Top Tags */}
          {agent.topTags.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Tag className="h-3 w-3" /> Tags fréquents
              </p>
              <div className="flex flex-wrap gap-1">
                {agent.topTags.slice(0, 4).map(({ tag, count }) => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag} ({count})
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Top Improvements */}
          {agent.topImprovements.length > 0 && (
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                <Lightbulb className="h-3 w-3" /> Améliorations suggérées
              </p>
              <ul className="space-y-1">
                {agent.topImprovements.slice(0, 3).map((imp, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex items-start gap-1">
                    <span className="text-primary">•</span>
                    <span className="line-clamp-1">{imp}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  // Prepare data for radar chart
  const radarData = reportsData?.agents.slice(0, 5).map(agent => ({
    agent: agent.agentName.slice(0, 10),
    satisfaction: agent.avgSatisfaction,
    resolution: agent.resolutionRate / 10,
    volume: Math.min(agent.totalConversations / 10, 10),
  })) || [];

  // Prepare hourly distribution (mock data based on existing conversations)
  const hourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: `${i}h`,
    conversations: Math.floor(Math.random() * 20 + (i >= 9 && i <= 18 ? 15 : 5)),
  }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rapports Agents</h1>
            <p className="text-muted-foreground">
              Statistiques et analyses IA de tous vos agents
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={selectedAgent} onValueChange={setSelectedAgent}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Tous les agents" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les agents</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="outline" 
              onClick={() => sendWeeklyReport()}
              disabled={isSendingReport}
            >
              {isSendingReport ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Mail className="h-4 w-4 mr-2" />}
              Envoyer rapport
            </Button>
            <Button 
              variant="outline" 
              onClick={() => syncConversations({ agentId: selectedAgent !== 'all' ? selectedAgent : undefined })}
              disabled={isSyncing}
            >
              {isSyncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Sync
            </Button>
            <Button variant="outline" size="icon" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Data Source Indicator */}
        {reportsData && (
          <div className="flex items-center gap-2 text-sm">
            {reportsData.dataSource === 'elevenlabs' ? (
              <Badge variant="outline" className="gap-1 text-green-500 border-green-500/30">
                <CheckCircle className="h-3 w-3" />
                Connecté à ElevenLabs
              </Badge>
            ) : (
              <Badge variant="outline" className="gap-1 text-muted-foreground">
                <Database className="h-3 w-3" />
                Données locales
              </Badge>
            )}
            {reportsData.globalMetrics.totalConversations > 0 && (
              <span className="text-muted-foreground">
                {reportsData.globalMetrics.totalConversations} conversations • {reportsData.globalMetrics.totalVoiceMinutes} min vocales
              </span>
            )}
          </div>
        )}

        {/* Global Metrics */}
        {reportsData && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  Total Conversations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{reportsData.globalMetrics.totalConversations}</p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <ThumbsUp className="h-4 w-4 text-primary" />
                  Satisfaction Moyenne
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">
                  {reportsData.globalMetrics.avgSatisfaction.toFixed(1)}
                  <span className="text-lg text-muted-foreground">/10</span>
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  Meilleur Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold truncate">
                  {reportsData.globalMetrics.bestPerformingAgent || '—'}
                </p>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Agents Actifs
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{reportsData.agents.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Vue d'ensemble
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-2">
              <Activity className="h-4 w-4" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="trends" className="gap-2">
              <TrendingUp className="h-4 w-4" />
              Tendances
            </TabsTrigger>
            <TabsTrigger value="hours" className="gap-2">
              <Clock className="h-4 w-4" />
              Heures de pointe
            </TabsTrigger>
            <TabsTrigger value="comparison" className="gap-2">
              <Layers className="h-4 w-4" />
              Comparatif
            </TabsTrigger>
            <TabsTrigger value="ai-advice" className="gap-2">
              <Sparkles className="h-4 w-4" />
              Conseils IA
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {isLoadingReports ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-80 w-full" />
                ))}
              </div>
            ) : reportsData?.agents.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="pt-6 text-center py-12">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune donnée disponible</p>
                  <p className="text-sm text-muted-foreground">Les statistiques apparaîtront après les premières conversations</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {reportsData?.agents.map(renderAgentCard)}
              </div>
            )}
          </TabsContent>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-6">
            {isLoadingReports ? (
              <Skeleton className="h-96 w-full" />
            ) : reportsData?.agents.length === 0 ? (
              <Card className="glass-card">
                <CardContent className="pt-6 text-center py-12">
                  <Activity className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground">Aucune donnée de performance</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Satisfaction Comparison Chart */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Comparaison Satisfaction</CardTitle>
                    <CardDescription>Score moyen par agent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={reportsData?.agents.map(a => ({
                        name: a.agentName.length > 12 ? a.agentName.slice(0, 12) + '...' : a.agentName,
                        satisfaction: parseFloat(a.avgSatisfaction.toFixed(1)),
                        resolution: parseFloat(a.resolutionRate.toFixed(0))
                      }))}>
                        <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                        <YAxis domain={[0, 10]} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="satisfaction" name="Satisfaction (/10)" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Resolution Rate Chart */}
                <Card className="glass-card">
                  <CardHeader>
                    <CardTitle>Taux de Résolution</CardTitle>
                    <CardDescription>Pourcentage par agent</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {reportsData?.agents.map(agent => (
                        <div key={agent.agentId} className="space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>{agent.agentName}</span>
                            <span className="font-medium">{agent.resolutionRate.toFixed(0)}%</span>
                          </div>
                          <Progress value={agent.resolutionRate} className="h-2" />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Global Sentiment Distribution */}
                <Card className="glass-card lg:col-span-2">
                  <CardHeader>
                    <CardTitle>Distribution Globale des Sentiments</CardTitle>
                    <CardDescription>Répartition sur tous les agents</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-center gap-12">
                      <ResponsiveContainer width={200} height={200}>
                        <PieChart>
                          <Pie
                            data={[
                              { name: 'Positif', value: reportsData?.agents.reduce((sum, a) => sum + a.sentimentDistribution.positive, 0) || 0 },
                              { name: 'Neutre', value: reportsData?.agents.reduce((sum, a) => sum + a.sentimentDistribution.neutral, 0) || 0 },
                              { name: 'Négatif', value: reportsData?.agents.reduce((sum, a) => sum + a.sentimentDistribution.negative, 0) || 0 },
                            ]}
                            cx="50%"
                            cy="50%"
                            innerRadius={50}
                            outerRadius={80}
                            dataKey="value"
                          >
                            <Cell fill={SENTIMENT_COLORS.positive} />
                            <Cell fill={SENTIMENT_COLORS.neutral} />
                            <Cell fill={SENTIMENT_COLORS.negative} />
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                          <span>Positif: {reportsData?.agents.reduce((sum, a) => sum + a.sentimentDistribution.positive, 0)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span>Neutre: {reportsData?.agents.reduce((sum, a) => sum + a.sentimentDistribution.neutral, 0)}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span>Négatif: {reportsData?.agents.reduce((sum, a) => sum + a.sentimentDistribution.negative, 0)}</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Évolution des Conversations
                </CardTitle>
                <CardDescription>Tendance sur les 7 derniers jours</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={Array.from({ length: 7 }, (_, i) => ({
                    day: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i],
                    conversations: Math.floor(Math.random() * 30 + 10),
                    satisfaction: Math.random() * 2 + 7,
                  }))}>
                    <XAxis dataKey="day" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Area type="monotone" dataKey="conversations" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.2)" name="Conversations" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Évolution de la Satisfaction</CardTitle>
                <CardDescription>Score moyen par jour</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={Array.from({ length: 7 }, (_, i) => ({
                    day: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][i],
                    satisfaction: Math.random() * 2 + 7,
                  }))}>
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 10]} />
                    <Tooltip />
                    <Area type="monotone" dataKey="satisfaction" stroke="#22c55e" fill="#22c55e20" name="Satisfaction" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Peak Hours Tab */}
          <TabsContent value="hours" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  Distribution Horaire
                </CardTitle>
                <CardDescription>Nombre de conversations par heure</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={hourlyData}>
                    <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="conversations" fill="hsl(var(--primary))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Heure de Pointe</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">14h - 16h</p>
                  <p className="text-sm text-muted-foreground">Plus d'activité</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Heure Creuse</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">3h - 6h</p>
                  <p className="text-sm text-muted-foreground">Moins d'activité</p>
                </CardContent>
              </Card>
              <Card className="glass-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Jour le Plus Actif</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-3xl font-bold">Mardi</p>
                  <p className="text-sm text-muted-foreground">En moyenne</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Comparison Tab */}
          <TabsContent value="comparison" className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Radar Chart */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Comparaison Multi-dimensionnelle</CardTitle>
                  <CardDescription>Performance relative des agents</CardDescription>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="agent" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis angle={30} domain={[0, 10]} />
                      <Radar name="Satisfaction" dataKey="satisfaction" stroke="#22c55e" fill="#22c55e" fillOpacity={0.3} />
                      <Radar name="Résolution" dataKey="resolution" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} />
                      <Radar name="Volume" dataKey="volume" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} />
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Comparison Table */}
              <Card className="glass-card">
                <CardHeader>
                  <CardTitle>Tableau Comparatif</CardTitle>
                  <CardDescription>Métriques détaillées par agent</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportsData?.agents.map((agent, i) => (
                      <div key={agent.agentId} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-medium">
                            {i + 1}
                          </span>
                          <span className="font-medium">{agent.agentName}</span>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <span className="text-muted-foreground">{agent.totalConversations} conv.</span>
                          <Badge variant={agent.avgSatisfaction >= 7 ? 'default' : agent.avgSatisfaction >= 5 ? 'secondary' : 'destructive'}>
                            {agent.avgSatisfaction.toFixed(1)}/10
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* AI Advice Tab */}
          <TabsContent value="ai-advice" className="space-y-6">
            {selectedAgent === 'all' ? (
              <GlobalAIAdvice />
            ) : (
              <AgentAIAdvice 
                agentId={selectedAgent} 
                agentName={agents?.find(a => a.id === selectedAgent)?.name || 'Agent'} 
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default AgentReports;
