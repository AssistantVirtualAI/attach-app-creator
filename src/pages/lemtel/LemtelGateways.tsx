import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Network, RefreshCw, Search, Loader2, Power, Play, Square, Plus } from 'lucide-react';
import { toast } from 'sonner';

type Gateway = {
  gateway_uuid: string;
  gateway: string;
  proxy: string | null;
  context: string | null;
  register: string | boolean | null;
  enabled: string | boolean | null;
  hostname: string | null;
  description: string | null;
};

export default function LemtelGateways() {
  const [q, setQ] = useState('');
  const [restarting, setRestarting] = useState<string | null>(null);

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ['fpbx', 'gateways'],
    queryFn: async () => {
      // Primary: live FusionPBX call (no domain filter — gateways are global)
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'list-gateways' },
      });
      let arr: Gateway[] = [];
      if (!error) {
        arr = (data?.data || data?.gateways || []) as Gateway[];
      }
      // Fallback: cached pbx_gateways rows synced by cron (covers periods when
      // the FusionPBX REST API user lacks gateway_view permission).
      if (!Array.isArray(arr) || arr.length === 0) {
        const { data: cached } = await (supabase as any)
          .from('pbx_gateways')
          .select('pbx_uuid,name,proxy,realm,username,context,profile,status,enabled,register,config')
          .order('name', { ascending: true });
        arr = (cached || []).map((g: any) => ({
          gateway_uuid: g.pbx_uuid,
          gateway: g.name,
          proxy: g.proxy,
          context: g.context,
          register: g.register,
          enabled: g.enabled,
          hostname: g.realm,
          description: g.config?.description || null,
        }));
      }
      return Array.isArray(arr) ? arr : [];
    },
  });

  const restart = async (gw: Gateway) => {
    setRestarting(gw.gateway_uuid);
    try {
      const { error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'restart-gateway', params: { gateway_name: gw.gateway } },
      });
      if (error) throw error;
      toast.success(`Restarted ${gw.gateway}`);
    } catch (e: any) {
      toast.error('Restart failed: ' + (e?.message || ''));
    } finally { setRestarting(null); }
  };

  const filtered = rows.filter(g =>
    !q || `${g.gateway} ${g.proxy ?? ''} ${g.hostname ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );

  return (
    <div className="space-y-4 w-full min-w-0">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Network className="w-7 h-7" /> Gateways</h1>
          <p className="text-muted-foreground text-sm">SIP trunks &amp; carrier connections programmed on the PBX</p>
        </div>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <CardTitle>{filtered.length} gateway{filtered.length === 1 ? '' : 's'}</CardTitle>
            <div className="relative w-72 max-w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search gateway, proxy…" className="pl-9" />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Gateway</TableHead>
                  <TableHead>Proxy</TableHead>
                  <TableHead>Context</TableHead>
                  <TableHead>Register</TableHead>
                  <TableHead>Enabled</TableHead>
                  <TableHead>Hostname / Description</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    No gateways returned. If FusionPBX shows gateways in its admin UI but this list is empty, the API user needs the <code className="px-1 rounded bg-muted">gateway_view</code> permission enabled.
                  </TableCell></TableRow>
                ) : filtered.map(g => {
                  const enabled = g.enabled === true || g.enabled === 'true';
                  const register = g.register === true || g.register === 'true';
                  return (
                    <TableRow key={g.gateway_uuid}>
                      <TableCell className="font-mono font-medium">{g.gateway}</TableCell>
                      <TableCell className="font-mono text-xs">{g.proxy || '—'}</TableCell>
                      <TableCell className="text-xs">{g.context || 'public'}</TableCell>
                      <TableCell><Badge variant={register ? 'default' : 'secondary'}>{register ? 'Yes' : 'No'}</Badge></TableCell>
                      <TableCell><Badge variant={enabled ? 'default' : 'secondary'}>{enabled ? 'On' : 'Off'}</Badge></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{g.hostname || g.description || '—'}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" disabled={restarting === g.gateway_uuid} onClick={() => restart(g)}>
                          {restarting === g.gateway_uuid ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Power className="w-3.5 h-3.5 mr-1" />}
                          Restart
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
