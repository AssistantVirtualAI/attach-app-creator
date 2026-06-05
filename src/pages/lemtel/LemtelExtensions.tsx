import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Smartphone, Plus, Circle } from 'lucide-react';
import { MOCK_EXTENSIONS } from '@/lib/lemtelMockData';

export default function LemtelExtensions() {
  const [search, setSearch] = useState('');
  const exts = MOCK_EXTENSIONS.filter(e =>
    e.number.includes(search) || e.display_name.toLowerCase().includes(search.toLowerCase()) || e.customer_name.toLowerCase().includes(search.toLowerCase())
  );
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Smartphone className="w-7 h-7" /> Extensions</h1>
          <p className="text-muted-foreground">FusionPBX SIP extensions across all customers</p>
        </div>
        <Button><Plus className="w-4 h-4 mr-2" /> Provision Extension</Button>
      </div>
      <Card>
        <CardHeader><CardTitle>{exts.length} extensions</CardTitle></CardHeader>
        <CardContent>
          <Input className="mb-4 max-w-sm" placeholder="Search extension, name, customer..." value={search} onChange={e => setSearch(e.target.value)} />
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Ext</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Device</TableHead>
                <TableHead>Voicemail</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {exts.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-mono font-bold">{e.number}</TableCell>
                  <TableCell>{e.display_name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{e.customer_name}</TableCell>
                  <TableCell className="text-sm">{e.device}</TableCell>
                  <TableCell>{e.voicemail ? <Badge variant="secondary">Enabled</Badge> : <Badge variant="outline">Off</Badge>}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center gap-1 text-sm">
                      <Circle className={`w-2.5 h-2.5 ${e.registered ? 'fill-green-500 text-green-500' : 'fill-muted text-muted'}`} />
                      {e.registered ? 'Registered' : 'Offline'}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
