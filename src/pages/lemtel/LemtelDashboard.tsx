import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Bot, PhoneCall, Activity, TrendingUp, Smartphone, Building2 } from 'lucide-react';
import { MOCK_CDRS, MOCK_EXTENSIONS, MOCK_DIDS, MOCK_VOICE_AGENTS, MOCK_CUSTOMERS, MOCK_SMS_THREADS } from '@/lib/lemtelMockData';
import { useLemtelMockMode } from '@/hooks/useLemtelMockMode';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function LemtelDashboard() {
  const { useMock } = useLemtelMockMode();
  const todayCalls = MOCK_CDRS.filter(c => new Date(c.start_time).toDateString() === new Date().toDateString()).length;
  const trend = Array.from({ length: 7 }, (_, i) => ({
    day: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][i],
    calls: 12 + Math.round(Math.sin(i) * 6) + i * 3,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lemtel Dashboard</h1>
          <p className="text-muted-foreground">Telecom operations overview {useMock && <Badge variant="outline" className="ml-2">Mock Data</Badge>}</p>
        </div>
        <div className="flex gap-2">
          <Badge variant="default">FusionPBX ✅</Badge>
          <Badge variant="default">Telnyx ✅</Badge>
          <Badge variant="default">ElevenLabs ✅</Badge>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Customers', value: MOCK_CUSTOMERS.length, icon: Building2, color: 'text-blue-500' },
          { label: 'Extensions', value: MOCK_EXTENSIONS.length, icon: Smartphone, color: 'text-purple-500' },
          { label: 'DIDs', value: MOCK_DIDS.length, icon: Phone, color: 'text-green-500' },
          { label: 'Voice Agents', value: MOCK_VOICE_AGENTS.length, icon: Bot, color: 'text-orange-500' },
        ].map(s => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{s.value}</div></CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Call Volume (Last 7 days)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }} />
                <Area type="monotone" dataKey="calls" stroke="hsl(var(--primary))" fill="url(#g1)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Activity className="w-4 h-4" /> Today</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Calls handled</span><span className="font-bold">{todayCalls}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">SMS threads</span><span className="font-bold">{MOCK_SMS_THREADS.length}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Unread SMS</span><span className="font-bold">{MOCK_SMS_THREADS.reduce((s, t) => s + t.unread, 0)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Registered extensions</span><span className="font-bold">{MOCK_EXTENSIONS.filter(e => e.registered).length} / {MOCK_EXTENSIONS.length}</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><PhoneCall className="w-4 h-4" /> Recent Calls</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {MOCK_CDRS.slice(0, 6).map(c => (
            <div key={c.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
              <div className="flex items-center gap-3">
                <Badge variant={c.direction === 'missed' ? 'destructive' : 'outline'}>{c.direction}</Badge>
                <div>
                  <div className="font-mono text-sm">{c.from_number} → {c.to_number}</div>
                  <div className="text-xs text-muted-foreground">{c.customer_name} • {new Date(c.start_time).toLocaleString()}</div>
                </div>
              </div>
              <div className="text-sm text-muted-foreground">{c.duration_seconds}s</div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
