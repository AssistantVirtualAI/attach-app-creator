import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Bell, Plus, Loader2 } from 'lucide-react';
import { usePbxRingGroups } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';

export default function TelephonyRingGroups() {
  const { data: groups = [], isLoading } = usePbxRingGroups();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="w-7 h-7" /> Ring Groups</h1>
          <p className="text-muted-foreground">Hunt groups for parallel/sequential ringing</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <Button><Plus className="w-4 h-4 mr-2" /> New Ring Group</Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{groups.length} ring groups</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>Name</TableHead><TableHead>Extension</TableHead><TableHead>Strategy</TableHead>
                <TableHead>Members</TableHead><TableHead>Status</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No ring groups.</TableCell></TableRow>
                ) : (groups as any[]).map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono">{g.extension || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{g.strategy || g.ring_group_strategy || '—'}</Badge></TableCell>
                    <TableCell>{Array.isArray(g.destinations) ? g.destinations.length : (g.member_count ?? '—')}</TableCell>
                    <TableCell><Badge variant={g.enabled === false ? 'outline' : 'default'}>{g.enabled === false ? 'disabled' : 'enabled'}</Badge></TableCell>
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
