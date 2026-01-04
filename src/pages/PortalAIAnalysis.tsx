import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalConversations, usePortalAnalytics } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, AlertTriangle, CheckCircle, Loader2, Sparkles, Target, MessageSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';

const PortalAIAnalysis = () => {
  const { session } = usePortal();
  const { data: analytics, isLoading: analyticsLoading } = usePortalAnalytics('30days');
  const { data: conversationsData, isLoading: conversationsLoading } = usePortalConversations(1, 100);

  const isLoading = analyticsLoading || conversationsLoading;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  // Calculate AI insights
  const totalConversations = analytics?.metrics?.total_conversations || 0;
  const successRate = analytics?.metrics?.success_rate || 0;
  const avgDuration = analytics?.metrics?.avg_duration || 0;

  const insights = [
    {
      title: 'Performance globale',
      value: successRate >= 80 ? 'Excellente' : successRate >= 60 ? 'Bonne' : 'À améliorer',
      description: `Taux de succès de ${successRate}% sur ${totalConversations} conversations`,
      icon: TrendingUp,
      color: successRate >= 80 ? 'text-green-400' : successRate >= 60 ? 'text-yellow-400' : 'text-red-400',
      bgColor: successRate >= 80 ? 'from-green-500/10 to-emerald-500/10' : successRate >= 60 ? 'from-yellow-500/10 to-orange-500/10' : 'from-red-500/10 to-pink-500/10',
    },
    {
      title: 'Durée optimale',
      value: avgDuration < 180 ? 'Efficace' : avgDuration < 300 ? 'Normal' : 'Long',
      description: `Durée moyenne de ${Math.floor(avgDuration / 60)}:${(avgDuration % 60).toString().padStart(2, '0')}`,
      icon: Target,
      color: avgDuration < 180 ? 'text-green-400' : avgDuration < 300 ? 'text-yellow-400' : 'text-orange-400',
      bgColor: avgDuration < 180 ? 'from-green-500/10 to-emerald-500/10' : avgDuration < 300 ? 'from-yellow-500/10 to-orange-500/10' : 'from-orange-500/10 to-red-500/10',
    },
    {
      title: 'Volume d\'appels',
      value: totalConversations > 100 ? 'Élevé' : totalConversations > 50 ? 'Modéré' : 'Faible',
      description: `${totalConversations} conversations enregistrées`,
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
        successRate >= 70 && 'Bon taux de résolution des conversations',
        avgDuration < 300 && 'Durée des appels optimisée',
        totalConversations > 50 && 'Volume d\'utilisation satisfaisant',
      ].filter(Boolean),
      icon: CheckCircle,
      color: 'text-green-400',
      bgColor: 'bg-green-500/10',
    },
    {
      type: 'warning',
      title: 'Points d\'amélioration',
      items: [
        successRate < 70 && 'Améliorer le taux de succès des conversations',
        avgDuration > 300 && 'Optimiser la durée des appels',
        totalConversations < 20 && 'Augmenter l\'utilisation de l\'agent',
      ].filter(Boolean),
      icon: AlertTriangle,
      color: 'text-yellow-400',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <PortalPageHeader
        icon={Brain}
        title="Analyse IA"
        description={session?.agentName}
        gradient="purple-pink"
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && (
        <>
          {/* AI Score Card */}
          <motion.div variants={itemVariants}>
            <Card className="bg-gradient-to-br from-primary/10 via-purple-500/10 to-pink-500/10 border-primary/20 overflow-hidden">
              <CardContent className="p-8">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
                        <Sparkles className="h-7 w-7 text-white" />
                      </div>
                      <div>
                        <h2 className="text-2xl font-bold">Score de Performance</h2>
                        <p className="text-muted-foreground">Analyse IA de votre agent</p>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-6xl font-bold bg-gradient-to-r from-primary via-purple-400 to-pink-400 bg-clip-text text-transparent">
                      {successRate}%
                    </div>
                    <p className="text-muted-foreground mt-1">Taux de succès global</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Insights Grid */}
          <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {insights.map((insight, index) => (
              <Card 
                key={insight.title} 
                className={`bg-gradient-to-br ${insight.bgColor} border-border/30`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-10 h-10 rounded-xl bg-background/50 flex items-center justify-center ${insight.color}`}>
                      <insight.icon className="h-5 w-5" />
                    </div>
                    <GlowBadge variant={successRate >= 80 ? 'success' : 'secondary'}>
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
    </motion.div>
  );
};

export default PortalAIAnalysis;
