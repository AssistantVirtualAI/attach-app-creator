import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalAnalytics } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Clock, MessageSquare, Users, Zap, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { PortalStatCard } from '@/components/portal/PortalStatCard';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const PortalAnalytics = () => {
  const { session } = usePortal();
  const { data: analytics, isLoading } = usePortalAnalytics('7days');

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
        <>
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
        </>
      )}
    </motion.div>
  );
};

export default PortalAnalytics;
