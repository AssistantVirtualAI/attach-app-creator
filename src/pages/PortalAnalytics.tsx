import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Clock, MessageSquare, Users, Zap } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { PortalStatCard } from '@/components/portal/PortalStatCard';
import { 
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from 'recharts';

const conversationData = [
  { name: 'Lun', calls: 45, duration: 120 },
  { name: 'Mar', calls: 52, duration: 145 },
  { name: 'Mer', calls: 38, duration: 98 },
  { name: 'Jeu', calls: 65, duration: 180 },
  { name: 'Ven', calls: 58, duration: 156 },
  { name: 'Sam', calls: 22, duration: 65 },
  { name: 'Dim', calls: 15, duration: 42 },
];

const hourlyData = [
  { hour: '8h', calls: 5 },
  { hour: '9h', calls: 12 },
  { hour: '10h', calls: 18 },
  { hour: '11h', calls: 22 },
  { hour: '12h', calls: 15 },
  { hour: '13h', calls: 8 },
  { hour: '14h', calls: 20 },
  { hour: '15h', calls: 25 },
  { hour: '16h', calls: 28 },
  { hour: '17h', calls: 22 },
  { hour: '18h', calls: 12 },
];

const sentimentData = [
  { name: 'Positif', value: 65, color: 'hsl(var(--success))' },
  { name: 'Neutre', value: 25, color: 'hsl(var(--muted-foreground))' },
  { name: 'Négatif', value: 10, color: 'hsl(var(--destructive))' },
];

const PortalAnalytics = () => {
  const { session } = usePortal();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <PortalPageHeader
        icon={BarChart3}
        title="Analytics"
        description={session?.agentName}
        gradient="purple-pink"
      />

      {/* Stats Grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <PortalStatCard
          title="Total Conversations"
          value={1247}
          icon={MessageSquare}
          gradient="blue"
          trend={{ value: 12, isPositive: true }}
        />
        <PortalStatCard
          title="Durée Totale"
          value="86h"
          icon={Clock}
          gradient="purple"
          trend={{ value: 8, isPositive: true }}
        />
        <PortalStatCard
          title="Durée Moyenne"
          value="4:12"
          icon={TrendingUp}
          gradient="green"
          trend={{ value: 5, isPositive: false }}
        />
        <PortalStatCard
          title="Utilisateurs Uniques"
          value={423}
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
            </div>
          </CardContent>
        </Card>

        {/* Hourly Distribution */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-purple-400" />
              Distribution horaire
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
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
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Charts Row 2 */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sentiment Pie */}
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-400" />
              Sentiment global
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
                { title: 'Pic d\'activité', value: '15h - 17h', desc: 'Période la plus active de la journée' },
                { title: 'Sujet principal', value: 'Support produit', desc: '45% des conversations' },
                { title: 'Taux de résolution', value: '87%', desc: '+5% par rapport à la semaine dernière' },
                { title: 'Score satisfaction', value: '4.6/5', desc: 'Basé sur 234 évaluations' },
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
    </motion.div>
  );
};

export default PortalAnalytics;
