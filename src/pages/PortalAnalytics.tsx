import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, TrendingUp, Clock, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';

const PortalAnalytics = () => {
  const { session } = usePortal();

  const stats = [
    { title: 'Total Conversations', icon: MessageSquare, color: 'from-electric-blue/20 to-cyber-cyan/10' },
    { title: 'Durée Totale', icon: Clock, color: 'from-vivid-purple/20 to-primary/10' },
    { title: 'Durée Moyenne', icon: TrendingUp, color: 'from-neon-green/20 to-success/10' },
    { title: 'Appels/Jour', icon: BarChart3, color: 'from-sunset-orange/20 to-warning/10' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-vivid-purple to-hot-pink flex items-center justify-center">
          <BarChart3 className="h-6 w-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">{session?.agentName}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
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
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader><CardTitle>Tendance des conversations</CardTitle></CardHeader>
          <CardContent><div className="h-[300px] flex items-center justify-center text-muted-foreground">Chargement...</div></CardContent>
        </Card>
        <Card className="bg-card/50 backdrop-blur-sm border-border/50">
          <CardHeader><CardTitle>Distribution horaire</CardTitle></CardHeader>
          <CardContent><div className="h-[300px] flex items-center justify-center text-muted-foreground">Chargement...</div></CardContent>
        </Card>
      </div>
    </motion.div>
  );
};

export default PortalAnalytics;
