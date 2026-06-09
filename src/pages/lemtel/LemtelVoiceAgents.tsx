import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bot, Plus, Loader2 } from 'lucide-react';
import { usePbxAgents } from '@/hooks/usePbxData';

export default function LemtelVoiceAgents() {
  const { data: agents = [], isLoading } = usePbxAgents();
  const voice = (agents as any[]).filter(a => ['elevenlabs', 'vapi', 'retell'].includes((a.platform || '').toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bot className="w-7 h-7" /> Voice Agents</h1>
          <p className="text-muted-foreground">AI receptionists and after-hours intake agents</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New Voice Agent</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Agents</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{voice.length}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Platforms</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{new Set(voice.map(a => a.platform)).size}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">External</CardTitle></CardHeader><CardContent><div className="text-3xl font-bold">{voice.filter(a => a.is_external).length}</div></CardContent></Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Voice Agents</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Agent</TableHead><TableHead>Platform</TableHead><TableHead>Phone</TableHead>
                <TableHead>External</TableHead><TableHead>Description</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {voice.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No voice agents yet.</TableCell></TableRow>
                ) : voice.map((a: any) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-medium">{a.name}</TableCell>
                    <TableCell><Badge variant="outline">{a.platform}</Badge></TableCell>
                    <TableCell className="font-mono text-sm">{a.twilio_number || '—'}</TableCell>
                    <TableCell>{a.is_external ? <Badge>Yes</Badge> : <span className="text-xs text-muted-foreground">No</span>}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{a.description || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
