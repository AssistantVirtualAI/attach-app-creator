import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/StatCard';
import { ChartCard } from '@/components/ChartCard';
import { Users, Clock, Star, Phone } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const VoiceAnalytics = () => {
  const stats = [
    {
      title: 'Total Conversations',
      value: '1,234',
      change: '+15.3%',
      changeType: 'positive' as const,
      icon: Phone,
      trend: [45, 52, 48, 65, 58, 72, 68],
    },
    {
      title: 'Durée Moyenne',
      value: '4m 32s',
      change: '+8.1%',
      changeType: 'positive' as const,
      icon: Clock,
      trend: [30, 42, 38, 55, 48, 62, 58],
    },
    {
      title: 'Satisfaction',
      value: '4.7/5',
      change: '+0.3',
      changeType: 'positive' as const,
      icon: Star,
      trend: [75, 78, 80, 82, 81, 85, 87],
    },
    {
      title: 'Utilisateurs Actifs',
      value: '892',
      change: '+12%',
      changeType: 'positive' as const,
      icon: Users,
      trend: [40, 48, 45, 58, 52, 65, 70],
    },
  ];

  const platformData = [
    { platform: 'ElevenLabs', value: 450 },
    { platform: 'Vapi', value: 380 },
    { platform: 'Retell AI', value: 404 },
  ];

  const sentimentData = [
    { day: 'Lun', positive: 85, neutral: 12, negative: 3 },
    { day: 'Mar', positive: 78, neutral: 18, negative: 4 },
    { day: 'Mer', positive: 92, neutral: 6, negative: 2 },
    { day: 'Jeu', positive: 88, neutral: 10, negative: 2 },
    { day: 'Ven', positive: 95, neutral: 4, negative: 1 },
    { day: 'Sam', positive: 90, neutral: 8, negative: 2 },
    { day: 'Dim', positive: 87, neutral: 11, negative: 2 },
  ];

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Voice Analytics</h1>
            <p className="text-muted-foreground text-lg">
              Analyse détaillée des performances vocales IA
            </p>
          </div>
          <Select defaultValue="7days">
            <SelectTrigger className="w-[180px] glass-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Dernières 24h</SelectItem>
              <SelectItem value="7days">7 derniers jours</SelectItem>
              <SelectItem value="30days">30 derniers jours</SelectItem>
              <SelectItem value="90days">90 derniers jours</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <StatCard key={index} {...stat} />
          ))}
        </div>

        {/* Charts Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <ChartCard
            title="Conversations par Plateforme"
            data={platformData}
            type="bar"
            dataKey="value"
            xAxisKey="platform"
          />
          <ChartCard
            title="Analyse de Sentiment"
            data={sentimentData}
            type="area"
            dataKey="positive"
            xAxisKey="day"
          />
        </div>

        {/* Top Keywords */}
        <Card className="glass-card">
          <CardHeader>
            <CardTitle>Mots-clés Populaires</CardTitle>
            <CardDescription>Les sujets les plus discutés cette semaine</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {['Support Client', 'Facturation', 'Produit', 'Installation', 'Livraison', 'Retour', 'Garantie', 'Paiement'].map((keyword) => (
                <div
                  key={keyword}
                  className="px-4 py-2 rounded-full bg-primary/20 text-primary border border-primary/30 text-sm font-medium"
                >
                  {keyword}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default VoiceAnalytics;