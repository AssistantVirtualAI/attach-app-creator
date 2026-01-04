import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalAnalytics, usePortalConversations } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, TrendingUp, Clock, MessageSquare, Users, Zap, Loader2, AlertCircle, Brain, Target, CheckCircle, AlertTriangle, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { PortalStatCard } from '@/components/portal/PortalStatCard';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const PortalAnalytics = () => {
  const { session } = usePortal();
  const { data: analytics, isLoading } = usePortalAnalytics('7days');
  const { data: analytics30, isLoading: analytics30Loading } = usePortalAnalytics('30days');

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Format chart data
  const conversationData = analytics?.charts?.conversations_over_time?.map(item => ({
    name: new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
    calls: item.count,
  })) || [];

  const hourlyData = analytics?.charts?.peak_hours?.map(item => ({
    hour: `${item.hour}h`,
    calls: item.count,
  })) || [];

  // Calculate sentiment data from success rate
  const successRate = analytics?.metrics?.success_rate || 0;
  const sentimentData = [
    { name: 'Réussis', value: successRate, color: 'hsl(var(--success))' },
    { name: 'Échoués', value: 100 - successRate, color: 'hsl(var(--destructive))' },
  ];

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatTotalDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h${mins}m`;
    return `${mins}m`;
  };

  // AI Analysis data (from 30 days)
  const totalConversations30 = analytics30?.metrics?.total_conversations || 0;
  const successRate30 = analytics30?.metrics?.success_rate || 0;
  const avgDuration30 = analytics30?.metrics?.avg_duration || 0;

  const insights = [
    {
      title: 'Performance globale',
      value: successRate30 >= 80 ? 'Excellente' : successRate30 >= 60 ? 'Bonne' : 'À améliorer',
      description: `Taux de succès de ${successRate30}% sur ${totalConversations30} conversations`,
      icon: TrendingUp,
      color: successRate30 >= 80 ? 'text-green-400' : successRate30 >= 60 ? 'text-yellow-400' : 'text-red-400',
      bgColor: successRate30 >= 80 ? 'from-green-500/10 to-emerald-500/10' : successRate30 >= 60 ? 'from-yellow-500/10 to-orange-500/10' : 'from-red-500/10 to-pink-500/10',
    },
    {
      title: 'Durée optimale',
      value: avgDuration30 < 180 ? 'Efficace' : avgDuration30 < 300 ? 'Normal' : 'Long',
      description: `Durée moyenne de ${Math.floor(avgDuration30 / 60)}:${(avgDuration30 % 60).toString().padStart(2, '0')}`,
      icon: Target,
      color: avgDuration30 < 180 ? 'text-green-400' : avgDuration30 < 300 ? 'text-yellow-400' : 'text-orange-400',
      bgColor: avgDuration30 < 180 ? 'from-green-500/10 to-emerald-500/10' : avgDuration30 < 300 ? 'from-yellow-500/10 to-orange-500/10' : 'from-orange-500/10 to-red-500/10',
    },
    {
      title: 'Volume d\'appels',
      value: totalConversations30 > 100 ? 'Élevé' : totalConversations30 > 50 ? 'Modéré' : 'Faible',
      description: `${totalConversations30} conversations enregistrées`,
      icon: MessageSquare,
      color: 'text-blue-400',
      bgColor: 'from-blue-500/10 to-cyan-500/10',
    },
  ];

  const recommendations = [
    {
      type: 'success',
      title: 'Points forts',
      items: [
        successRate30 >= 70 && 'Bon taux de résolution des conversations',
        avgDuration30 < 300 && 'Durée des appels optimisée',
        totalConversations30 > 50 && 'Volume d\'utilisation satisfaisant',
      ].filter(Boolean),
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      type: 'warning',
      title: 'Points d\'amélioration',
      items: [
        successRate30 < 70 && 'Améliorer le taux de succès des conversations',
        avgDuration30 > 300 && 'Optimiser la durée des appels',
        totalConversations30 < 20 && 'Augmenter l\'utilisation de l\'agent',
      ].filter(Boolean),
      icon: AlertTriangle,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <PortalPageHeader
        icon={BarChart3}
        title="Analytics"
        description={session?.agentName}
        gradient="purple-pink"
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && !analytics && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Données non disponibles</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Vérifiez que l'agent ElevenLabs est correctement configuré.
            </p>
          </CardContent>
        </Card>
      )}

      {analytics && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="bg-muted/30 border border-border/30">
            <TabsTrigger value="overview" className="gap-2">
              <BarChart3 className="h-4 w-4" />
              Vue globale
            </TabsTrigger>
            <TabsTrigger value="ai-analysis" className="gap-2">
              <Brain className="h-4 w-4" />
              Analyse IA
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            {/* Stats Grid */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <PortalStatCard
                title="Total Conversations"
                value={analytics.metrics.total_conversations}
                icon={MessageSquare}
                gradient="blue"
                trend={{ value: 12, isPositive: true }}
              />
              <PortalStatCard
                title="Durée Totale"
                value={formatTotalDuration(analytics.metrics.total_duration)}
                icon={Clock}
                gradient="purple"
                trend={{ value: 8, isPositive: true }}
              />
              <PortalStatCard
                title="Durée Moyenne"
                value={formatDuration(analytics.metrics.avg_duration)}
                icon={TrendingUp}
                gradient="green"
                trend={{ value: 5, isPositive: true }}
              />
              <PortalStatCard
                title="Aujourd'hui"
                value={analytics.metrics.today_conversations}
                icon={Users}
                gradient="pink"
                trend={{ value: 15, isPositive: true }}
              />
            </motion.div>

            {/* Charts Row 1 */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Conversations Trend */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Tendance des conversations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {conversationData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={conversationData}>
                          <defs>
                            <linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Area 
                            type="monotone" 
                            dataKey="calls" 
                            stroke="hsl(var(--primary))" 
                            strokeWidth={2}
                            fillOpacity={1} 
                            fill="url(#colorCalls)" 
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Pas assez de données
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Hourly Distribution */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-purple-400" />
                    Heures de pointe
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[300px]">
                    {hourlyData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={hourlyData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                          <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: 'hsl(var(--card))', 
                              border: '1px solid hsl(var(--border))',
                              borderRadius: '8px'
                            }}
                          />
                          <Bar 
                            dataKey="calls" 
                            fill="hsl(var(--primary))" 
                            radius={[4, 4, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-muted-foreground">
                        Pas assez de données
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Charts Row 2 */}
            <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Success Rate Pie */}
              <Card className="bg-card/50 backdrop-blur-sm border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Taux de succès
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={sentimentData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {sentimentData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: 'hsl(var(--card))', 
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px'
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, '']}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* AI Insights */}
              <Card className="lg:col-span-2 bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border-border/30">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary animate-pulse" />
                    Insights IA
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { 
                        title: 'Conversations réussies', 
                        value: `${analytics.metrics.successful_conversations}`, 
                        desc: `Sur ${analytics.metrics.total_conversations} total` 
                      },
                      { 
                        title: 'Conversations échouées', 
                        value: `${analytics.metrics.failed_conversations}`, 
                        desc: 'Nécessitent attention' 
                      },
                      { 
                        title: 'Taux de succès', 
                        value: `${analytics.metrics.success_rate}%`, 
                        desc: 'Performance globale' 
                      },
                      { 
                        title: 'Durée moyenne', 
                        value: formatDuration(analytics.metrics.avg_duration), 
                        desc: 'Par conversation' 
                      },
                    ].map((insight, i) => (
                      <motion.div
                        key={insight.title}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="p-4 rounded-xl bg-card/50 border border-border/30"
                      >
                        <p className="text-sm text-muted-foreground mb-1">{insight.title}</p>
                        <p className="text-xl font-bold text-primary">{insight.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{insight.desc}</p>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </TabsContent>

          {/* AI Analysis Tab */}
          <TabsContent value="ai-analysis" className="space-y-6">
            {analytics30Loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <>
                {/* AI Score Card */}
                <motion.div variants={itemVariants}>
                  <Card className="bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-primary/20 overflow-hidden">
                    <CardContent className="p-8">
                      <div className="flex items-center justify-between flex-wrap gap-6">
                        <div>
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                              <Sparkles className="h-7 w-7 text-white" />
                            </div>
                            <div>
                              <h2 className="text-2xl font-bold">Score de Performance</h2>
                              <p className="text-muted-foreground">Analyse IA de votre agent (30 jours)</p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-6xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            {successRate30}%
                          </div>
                          <p className="text-muted-foreground mt-1">Taux de succès global</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Insights Grid */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {insights.map((insight) => (
                    <Card 
                      key={insight.title} 
                      className={`bg-gradient-to-br ${insight.bgColor} border-border/30`}
                    >
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className={`w-10 h-10 rounded-xl bg-background/50 flex items-center justify-center ${insight.color}`}>
                            <insight.icon className="h-5 w-5" />
                          </div>
                          <GlowBadge variant={successRate30 >= 80 ? 'success' : 'secondary'}>
                            {insight.value}
                          </GlowBadge>
                        </div>
                        <h3 className="font-semibold text-lg mb-1">{insight.title}</h3>
                        <p className="text-sm text-muted-foreground">{insight.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </motion.div>

                {/* Recommendations */}
                <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {recommendations.map((rec) => (
                    <Card key={rec.type} className="bg-card/50 backdrop-blur-sm border-border/30">
                      <CardHeader>
                        <CardTitle className={`flex items-center gap-2 ${rec.color}`}>
                          <rec.icon className="h-5 w-5" />
                          {rec.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        {rec.items.length > 0 ? (
                          <ul className="space-y-3">
                            {rec.items.map((item, idx) => (
                              <motion.li
                                key={idx}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 + idx * 0.1 }}
                                className={`flex items-start gap-3 p-3 rounded-lg ${rec.bgColor}`}
                              >
                                <div className={`w-2 h-2 rounded-full mt-2 ${rec.color.replace('text-', 'bg-')}`} />
                                <span className="text-sm">{item}</span>
                              </motion.li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-4">
                            Aucune recommandation pour le moment
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </motion.div>

                {/* Tips Card */}
                <motion.div variants={itemVariants}>
                  <Card className="bg-gradient-to-r from-blue-500/10 to-cyan-500/10 border-blue-500/20">
                    <CardContent className="p-6">
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                          <Brain className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold mb-2">Conseils pour améliorer les performances</h3>
                          <ul className="space-y-2 text-sm text-muted-foreground">
                            <li>• Affinez le prompt système pour des réponses plus précises</li>
                            <li>• Enrichissez la base de connaissances avec des FAQ détaillées</li>
                            <li>• Analysez les conversations échouées pour identifier les patterns</li>
                            <li>• Testez régulièrement l'agent avec différents scénarios</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </>
            )}
          </TabsContent>
        </Tabs>
      )}
    </motion.div>
  );
};

export default PortalAnalytics;