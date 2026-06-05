import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Smartphone, Plus, Circle } from 'lucide-react';
import { MOCK_SOFTPHONE_USERS } from '@/lib/lemtelMockData';

export default function LemtelSoftphoneUsers() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Smartphone className="w-7 h-7" /> Softphone Users</h1>
          <p className="text-muted-foreground">WebRTC / JsSIP-registered SIP credentials</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> New SIP User</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{MOCK_SOFTPHONE_USERS.length} registered users</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow>
              <TableHead>SIP Username</TableHead><TableHead>Display Name</TableHead><TableHead>Extension</TableHead>
              <TableHead>Customer</TableHead><TableHead>Status</TableHead><TableHead>Last Seen</TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {MOCK_SOFTPHONE_USERS.map(u => (
                <TableRow key={u.id}>
                  <TableCell className="font-mono text-sm">{u.username}</TableCell>
                  <TableCell>{u.display_name}</TableCell>
                  <TableCell className="font-bold">{u.extension}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{u.customer_name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Circle className={`w-2.5 h-2.5 ${u.registered ? 'fill-green-500 text-green-500' : 'fill-muted text-muted'}`} />
                      {u.registered ? 'Online' : 'Offline'}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{new Date(u.last_seen).toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
