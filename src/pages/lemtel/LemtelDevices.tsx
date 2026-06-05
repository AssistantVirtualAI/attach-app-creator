import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Router, Circle, Loader2 } from 'lucide-react';
import { usePbxDevices } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';

export default function LemtelDevices() {
  const { data: devices = [], isLoading } = usePbxDevices();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Router className="w-7 h-7" /> Devices</h1>
          <p className="text-muted-foreground">Provisioned SIP phones and ATAs</p>
        </div>
        <PbxRefreshButton kind="devices" />
      </div>
      <Card>
        <CardHeader><CardTitle>{devices.length} devices</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>MAC</TableHead>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Template</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {devices.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No devices synced yet.</TableCell></TableRow>
                ) : devices.map((d: any) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.label || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{d.mac_address || '—'}</TableCell>
                    <TableCell>{d.vendor || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.template || '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Circle className={`w-2.5 h-2.5 ${d.registration_status === 'registered' ? 'fill-green-500 text-green-500' : 'fill-muted text-muted'}`} />
                        {d.registration_status || (d.enabled ? 'enabled' : 'disabled')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</TableCell>
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
