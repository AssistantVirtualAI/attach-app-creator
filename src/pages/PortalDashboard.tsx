import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalAnalytics, usePortalConversations } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Clock, TrendingUp, Phone, Activity, Sparkles, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalStatCard } from '@/components/portal/PortalStatCard';
import { AvaLogo } from '@/components/shared/AvaLogo';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PortalDashboard = () => {
  const { session } = usePortal();
  const { data: analytics, isLoading: analyticsLoading } = usePortalAnalytics('7days');
  const { data: conversationsData, isLoading: conversationsLoading } = usePortalConversations(1, 100);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  const isLoading = analyticsLoading || conversationsLoading;
  const hasData = analytics || conversationsData;

  // Format chart data
  const chartData = analytics?.charts?.conversations_over_time?.map(item => ({
    name: new Date(item.date).toLocaleDateString('fr-FR', { weekday: 'short' }),
    conversations: item.count,
  })) || [];

  // Format duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-8">
      {/* Hero Section */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 p-8 border border-border/30">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-500/10 rounded-full blur-3xl" />
        
        <div className="relative flex items-center gap-6">
          <AvaLogo size="lg" animated />
          <div>
            <h1 className="text-3xl font-bold mb-2">
              Bienvenue sur <span className="bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">AVA Statistics</span>
            </h1>
            <p className="text-muted-foreground text-lg">
              Agent: <span className="font-semibold text-foreground">{session?.agentName}</span>
            </p>
          </div>
        </div>
      </motion.div>

      {/* Loading State */}
      {isLoading && !hasData && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {/* No Data State */}
      {!isLoading && !hasData && (
        <motion.div variants={itemVariants}>
          <Card className="bg-card/50 backdrop-blur-sm border-border/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">Configuration requise</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Aucune donnée disponible. Vérifiez que l'agent ElevenLabs est correctement configuré.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Stats Grid */}
      {hasData && (
        <>
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <PortalStatCard
              title="Total Conversations"
              value={analytics?.metrics?.total_conversations || conversationsData?.total || 0}
              icon={MessageSquare}
              gradient="blue"
              trend={{ value: 12, isPositive: true }}
            />
            <PortalStatCard
              title="Durée Moyenne"
              value={formatDuration(analytics?.metrics?.avg_duration || 0)}
              icon={Clock}
              gradient="green"
              trend={{ value: 8, isPositive: true }}
            />
            <PortalStatCard
              title="Appels Aujourd'hui"
              value={analytics?.metrics?.today_conversations || 0}
              icon={Phone}
              gradient="purple"
              trend={{ value: 5, isPositive: true }}
            />
            <PortalStatCard
              title="Taux de Succès"
              value={`${analytics?.metrics?.success_rate || 0}%`}
              icon={Activity}
              gradient="pink"
              trend={{ value: 3, isPositive: true }}
            />
          </motion.div>

          {/* Charts */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  Tendance des conversations
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[300px]">
                  {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
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
                          dataKey="conversations" 
                          stroke="hsl(var(--primary))" 
                          strokeWidth={2}
                          fillOpacity={1} 
                          fill="url(#colorConversations)" 
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      Pas assez de données pour afficher le graphique
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Quick Stats Card */}
            <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border-border/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Insights IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Conversations réussies', value: analytics?.metrics?.successful_conversations || 0, color: 'text-green-400' },
                  { label: 'Durée totale', value: formatDuration(analytics?.metrics?.total_duration || 0), color: 'text-blue-400' },
                  { label: 'Appels échoués', value: analytics?.metrics?.failed_conversations || 0, color: 'text-red-400' },
                ].map((item, i) => (
                  <motion.div 
                    key={item.label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.5 + i * 0.1 }}
                    className="flex items-center justify-between p-3 rounded-xl bg-card/50 border border-border/30"
                  >
                    <span className="text-sm text-muted-foreground">{item.label}</span>
                    <span className={`font-bold ${item.color}`}>{item.value}</span>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default PortalDashboard;
