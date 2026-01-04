import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { MessageSquare, Clock, TrendingUp, Phone, BarChart3, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';

const PortalDashboard = () => {
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
      <motion.div variants={itemVariants} className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">{session?.agentName}</p>
        </div>
      </motion.div>

      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: 'Total Conversations', icon: MessageSquare, color: 'from-electric-blue/20 to-cyber-cyan/10' },
          { title: 'Durée Moyenne', icon: Clock, color: 'from-neon-green/20 to-success/10' },
          { title: 'Appels Aujourd\'hui', icon: Phone, color: 'from-vivid-purple/20 to-primary/10' },
          { title: 'Score Performance', icon: BarChart3, color: 'from-sunset-orange/20 to-warning/10' },
        ].map((stat) => (
          <Card key={stat.title} className={`bg-gradient-to-br ${stat.color} border backdrop-blur-sm`}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <Skeleton className="h-8 w-20" />
                </div>
                <stat.icon className="h-6 w-6 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        ))}
      </motion.div>

      <motion.div variants={itemVariants}>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Tendance des conversations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              Chargement des données...
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default PortalDashboard;
