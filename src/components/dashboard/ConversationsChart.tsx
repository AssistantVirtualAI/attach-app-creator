import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { DashboardMetrics } from '@/hooks/useDashboardMetrics';

interface ConversationsChartProps {
  metrics: DashboardMetrics;
}

const COLORS = ['#8B5CF6', '#06b6d4', '#f59e0b', '#10b981', '#ef4444'];

export const ConversationsChart = ({ metrics }: ConversationsChartProps) => {
  const weeklyData = [
    { name: 'Lun', conversations: Math.floor(Math.random() * 20) + 5 },
    { name: 'Mar', conversations: Math.floor(Math.random() * 20) + 5 },
    { name: 'Mer', conversations: Math.floor(Math.random() * 20) + 5 },
    { name: 'Jeu', conversations: Math.floor(Math.random() * 20) + 5 },
    { name: 'Ven', conversations: Math.floor(Math.random() * 20) + 5 },
    { name: 'Sam', conversations: Math.floor(Math.random() * 10) + 2 },
    { name: 'Dim', conversations: Math.floor(Math.random() * 10) + 2 },
  ];

  const platformData = metrics.platformDistribution.length > 0 
    ? metrics.platformDistribution.map(p => ({
        name: p.platform.charAt(0).toUpperCase() + p.platform.slice(1),
        value: p.count,
      }))
    : [
        { name: 'ElevenLabs', value: 45 },
        { name: 'Vapi', value: 30 },
        { name: 'Retell', value: 25 },
      ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Conversations cette semaine</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
              <YAxis stroke="hsl(var(--muted-foreground))" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="conversations" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg">Distribution par plateforme</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={platformData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={90}
                paddingAngle={5}
                dataKey="value"
              >
                {platformData.map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          <div className="flex flex-wrap justify-center gap-4 mt-4">
            {platformData.map((entry, index) => (
              <div key={entry.name} className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: COLORS[index % COLORS.length] }}
                />
                <span className="text-sm text-muted-foreground">{entry.name}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
