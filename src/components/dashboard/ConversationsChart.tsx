import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line 
} from 'recharts';
import { DashboardMetrics } from '@/hooks/useDashboardMetrics';
import { TrendingUp, PieChartIcon, Star } from 'lucide-react';

interface ConversationsChartProps {
  metrics: DashboardMetrics;
}

const COLORS = ['#8B5CF6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

export const ConversationsChart = ({ metrics }: ConversationsChartProps) => {
  // Use real data from metrics or generate placeholder
  const weeklyData = metrics.weeklyData && metrics.weeklyData.length > 0
    ? metrics.weeklyData
    : [
        { name: 'Lun', conversations: 0, satisfaction: 0 },
        { name: 'Mar', conversations: 0, satisfaction: 0 },
        { name: 'Mer', conversations: 0, satisfaction: 0 },
        { name: 'Jeu', conversations: 0, satisfaction: 0 },
        { name: 'Ven', conversations: 0, satisfaction: 0 },
        { name: 'Sam', conversations: 0, satisfaction: 0 },
        { name: 'Dim', conversations: 0, satisfaction: 0 },
      ];

  const platformData = metrics.platformDistribution.length > 0 
    ? metrics.platformDistribution.map(p => ({
        name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        value: p.count,
      }))
    : [{ name: 'Aucune donnée', value: 1 }];

  const hasData = metrics.dataSource === 'elevenlabs' || metrics.totalConversations > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Conversations Area Chart */}
      <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Conversations cette semaine
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={weeklyData}>
              <defs>
                <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
              <XAxis 
                dataKey="name" 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis 
                stroke="hsl(var(--muted-foreground))" 
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
                labelStyle={{ color: 'hsl(var(--foreground))' }}
              />
              <Area 
                type="monotone" 
                dataKey="conversations" 
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                fillOpacity={1} 
                fill="url(#colorConversations)" 
                name="Conversations"
              />
            </AreaChart>
          </ResponsiveContainer>
          {!hasData && (
            <p className="text-center text-muted-foreground text-sm mt-2">
              Configurez ElevenLabs pour voir les données réelles
            </p>
          )}
        </CardContent>
      </Card>

      {/* Platform Distribution Pie Chart */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
            Distribution par plateforme
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={platformData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={75}
                paddingAngle={5}
                dataKey="value"
              >
                {platformData.map((_, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]}
                    className="hover:opacity-80 transition-opacity cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex flex-wrap justify-center gap-3 mt-2">
            {platformData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-1.5">
                <div
                  className="w-2.5 h-2.5 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-xs text-muted-foreground">{entry.name}</span>
                <span className="text-xs font-medium">{entry.value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Satisfaction Trend Line Chart */}
      {metrics.weeklyData && metrics.weeklyData.some(d => d.satisfaction > 0) && (
        <Card className="lg:col-span-3 bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-all">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Évolution de la satisfaction
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} />
                <XAxis 
                  dataKey="name" 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))" 
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                  domain={[0, 5]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}/5`, 'Satisfaction']}
                />
                <Line 
                  type="monotone" 
                  dataKey="satisfaction" 
                  stroke="#f59e0b" 
                  strokeWidth={2}
                  dot={{ fill: '#f59e0b', strokeWidth: 2, r: 4 }}
                  activeDot={{ r: 6, stroke: '#f59e0b', strokeWidth: 2 }}
                  name="Satisfaction"
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
