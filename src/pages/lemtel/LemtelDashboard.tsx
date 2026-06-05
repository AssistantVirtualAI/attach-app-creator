import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Phone, MessageSquare, Bot, PhoneCall, Activity } from 'lucide-react';

export default function LemtelDashboard() {
  const [pbxStatus] = useState<'ok' | 'down'>('ok');
  const [telnyxStatus] = useState<'ok' | 'down'>('ok');
  const [elevenStatus] = useState<'ok' | 'down'>('ok');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Lemtel Dashboard</h1>
          <p className="text-muted-foreground">Telecom operations overview</p>
        </div>
        <div className="flex gap-2">
          <Badge variant={pbxStatus === 'ok' ? 'default' : 'destructive'}>
            FusionPBX {pbxStatus === 'ok' ? '✅' : '❌'}
          </Badge>
          <Badge variant={telnyxStatus === 'ok' ? 'default' : 'destructive'}>
            Telnyx {telnyxStatus === 'ok' ? '✅' : '❌'}
          </Badge>
          <Badge variant={elevenStatus === 'ok' ? 'default' : 'destructive'}>
            ElevenLabs {elevenStatus === 'ok' ? '✅' : '❌'}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Active Calls', value: 0, icon: PhoneCall, color: 'text-green-500' },
          { label: 'Extensions', value: 0, icon: Phone, color: 'text-blue-500' },
          { label: 'Registered DIDs', value: 0, icon: MessageSquare, color: 'text-purple-500' },
          { label: 'Voice Agents', value: 0, icon: Bot, color: 'text-orange-500' },
        ].map((s) => (
          <Card key={s.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{s.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Activity className="w-4 h-4" /> Recent Calls
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No recent calls. Configure FusionPBX in Settings to begin syncing CDRs.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" /> SMS Inbox
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No SMS conversations yet.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
