import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bot, Plus, Star } from 'lucide-react';
import { MOCK_VOICE_AGENTS } from '@/lib/lemtelMockData';

export default function LemtelVoiceAgents() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bot className="w-7 h-7" /> Voice Agents</h1>
          <p className="text-muted-foreground">ElevenLabs AI receptionists and after-hours intake agents</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New Voice Agent</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Active Agents</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{MOCK_VOICE_AGENTS.filter(a => a.status === 'active').length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Calls</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{MOCK_VOICE_AGENTS.reduce((s, a) => s + a.total_calls, 0)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Duration</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{Math.round(MOCK_VOICE_AGENTS.reduce((s, a) => s + a.avg_duration, 0) / MOCK_VOICE_AGENTS.length)}s</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Avg Satisfaction</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold flex items-center gap-1">{(MOCK_VOICE_AGENTS.reduce((s, a) => s + a.satisfaction, 0) / MOCK_VOICE_AGENTS.length).toFixed(1)}<Star className="w-5 h-5 fill-yellow-500 text-yellow-500" /></div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Voice Agents</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>Agent</TableHead><TableHead>Customer</TableHead><TableHead>DID</TableHead>
              <TableHead>Lang</TableHead><TableHead>Calls</TableHead><TableHead>Avg Dur</TableHead>
              <TableHead>CSAT</TableHead><TableHead>Status</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {MOCK_VOICE_AGENTS.map(a => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{a.customer_name}</TableCell>
                  <TableCell className="font-mono text-sm">{a.did}</TableCell>
                  <TableCell><Badge variant="outline">{a.language}</Badge></TableCell>
                  <TableCell>{a.total_calls}</TableCell>
                  <TableCell>{a.avg_duration}s</TableCell>
                  <TableCell className="inline-flex items-center gap-1">{a.satisfaction.toFixed(1)} <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" /></TableCell>
                  <TableCell><Badge variant={a.status === 'active' ? 'default' : 'secondary'}>{a.status}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
