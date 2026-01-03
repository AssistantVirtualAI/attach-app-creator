import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { useFAQGeneration } from '@/hooks/useFAQGeneration';
import { useAgentReports, AgentMetrics } from '@/hooks/useAgentReports';
import { useSyncElevenLabsConversations } from '@/hooks/useAgentAdvice';
import { useOrganization } from '@/context/OrganizationContext';
import { AgentAIAdvice } from '@/components/agents/AgentAIAdvice';
import { 
  FileQuestion, 
  RefreshCw, 
  AlertTriangle, 
  TrendingUp,
  TrendingDown,
  Minus,
  BarChart3,
  MessageSquareWarning,
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
  Database
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';

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
  
  const { faqs, misunderstoodQueries, conversationsAnalyzed, isLoading: isLoadingFAQ, isGenerating, regenerateFAQs } = useFAQGeneration(
    selectedAgent !== 'all' ? selectedAgent : undefined
  );

  const { mutate: syncConversations, isPending: isSyncing } = useSyncElevenLabsConversations();

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

  const categoryColors: Record<string, string> = {
    'Produits': 'bg-blue-500/20 text-blue-400',
    'Services': 'bg-purple-500/20 text-purple-400',
    'Support': 'bg-red-500/20 text-red-400',
    'Facturation': 'bg-green-500/20 text-green-400',
    'Compte': 'bg-yellow-500/20 text-yellow-400',
    'Livraison': 'bg-cyan-500/20 text-cyan-400',
    'Général': 'bg-gray-500/20 text-gray-400'
  };

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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Rapports Agents</h1>
            <p className="text-muted-foreground">
              Statistiques personnalisées et analyses par agent
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
              onClick={() => syncConversations({ agentId: selectedAgent !== 'all' ? selectedAgent : undefined })}
              disabled={isSyncing}
            >
              {isSyncing ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              Sync ElevenLabs
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
            <TabsTrigger value="faq" className="gap-2">
              <FileQuestion className="h-4 w-4" />
              FAQs Générées
            </TabsTrigger>
            <TabsTrigger value="misunderstood" className="gap-2">
              <MessageSquareWarning className="h-4 w-4" />
              Requêtes Incomprises
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

          {/* FAQ Tab */}
          <TabsContent value="faq" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <FileQuestion className="h-5 w-5" />
                      FAQs Générées Automatiquement
                    </CardTitle>
                    <CardDescription>
                      {conversationsAnalyzed} conversations analysées
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={regenerateFAQs} 
                    disabled={isGenerating}
                    variant="outline"
                  >
                    <RefreshCw className={`h-4 w-4 mr-2 ${isGenerating ? 'animate-spin' : ''}`} />
                    Régénérer
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingFAQ ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : faqs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <FileQuestion className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune FAQ générée pour le moment</p>
                    <p className="text-sm">Les FAQs seront générées à partir de vos conversations</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {faqs.map((faq, index) => (
                      <div 
                        key={index} 
                        className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className={categoryColors[faq.category] || categoryColors['Général']}>
                                {faq.category}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {faq.frequency}x mentionné
                              </Badge>
                            </div>
                            <h4 className="font-medium mb-2">{faq.question}</h4>
                            <p className="text-sm text-muted-foreground">{faq.answer}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Misunderstood Queries Tab */}
          <TabsContent value="misunderstood" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-yellow-500" />
                  Requêtes Incomprises
                </CardTitle>
                <CardDescription>
                  Conversations avec sentiment négatif ou faible satisfaction
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingFAQ ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : misunderstoodQueries.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquareWarning className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucune requête incomprise détectée</p>
                    <p className="text-sm">Les agents semblent bien répondre aux questions</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {misunderstoodQueries.map((query, index) => (
                      <div 
                        key={index} 
                        className="border border-yellow-500/30 rounded-lg p-4 bg-yellow-500/5"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant="destructive" className="text-xs">
                            {query.sentiment || 'négatif'}
                          </Badge>
                          {query.keywords?.map((kw, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {kw}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-sm">{query.transcript_excerpt}...</p>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* AI Advice Tab */}
          <TabsContent value="ai-advice" className="space-y-6">
            {selectedAgent === 'all' ? (
              <Card className="glass-card">
                <CardContent className="pt-6 text-center py-12">
                  <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground">Sélectionnez un agent spécifique</p>
                  <p className="text-sm text-muted-foreground">Les conseils IA sont générés par agent</p>
                </CardContent>
              </Card>
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
