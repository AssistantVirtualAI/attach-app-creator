import { useEffect, useState } from 'react';
import { useActiveDomain } from '@/hooks/useActiveDomain';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Users, Hash, Voicemail, Activity, Radio } from 'lucide-react';
import { Link } from 'react-router-dom';

type Counts = {
  extensions: number;
  devices: number;
  numbers: number;
  ivrs: number;
  queues: number;
  ringGroups: number;
  callsToday: number;
  recordings: number;
};

const TILE = [
  { key: 'extensions', label: 'Extensions', icon: Phone, path: 'extensions' },
  { key: 'devices', label: 'Devices', icon: Radio, path: 'devices' },
  { key: 'numbers', label: 'Phone Numbers', icon: Hash, path: 'dids' },
  { key: 'ivrs', label: 'IVR Menus', icon: Voicemail, path: 'ivr' },
  { key: 'queues', label: 'Queues', icon: Users, path: 'queues' },
  { key: 'ringGroups', label: 'Ring Groups', icon: Users, path: 'ring-groups' },
  { key: 'callsToday', label: 'Calls today', icon: Activity, path: 'calls' },
  { key: 'recordings', label: 'Recordings', icon: Voicemail, path: 'recordings' },
] as const;

export default function DomainDashboard() {
  const active = useActiveDomain();
  const [c, setC] = useState<Counts>({
    extensions: 0, devices: 0, numbers: 0, ivrs: 0, queues: 0, ringGroups: 0, callsToday: 0, recordings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!active?.org_id) return;
    (async () => {
      setLoading(true);
      const org = active.org_id;
      const today = new Date(); today.setHours(0, 0, 0, 0);
      const ts = today.toISOString();
      const sb: any = supabase;
      const [ext, dev, num, ivr, q, rg, cdrs, rec] = await Promise.all([
        sb.from('pbx_extensions').select('extension_uuid', { count: 'exact', head: true }).eq('organization_id', org),
        sb.from('pbx_devices').select('device_uuid', { count: 'exact', head: true }).eq('organization_id', org),
        sb.from('phone_numbers').select('id', { count: 'exact', head: true }).eq('organization_id', org),
        sb.from('pbx_ivrs').select('ivr_menu_uuid', { count: 'exact', head: true }).eq('organization_id', org),
        sb.from('pbx_call_queues').select('queue_uuid', { count: 'exact', head: true }).eq('organization_id', org),
        sb.from('pbx_ring_groups').select('ring_group_uuid', { count: 'exact', head: true }).eq('organization_id', org),
        sb.from('pbx_call_records').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('start_stamp', ts),
        sb.from('pbx_call_recordings').select('id', { count: 'exact', head: true }).eq('organization_id', org),
      ]);
      setC({
        extensions: ext.count ?? 0,
        devices: dev.count ?? 0,
        numbers: num.count ?? 0,
        ivrs: ivr.count ?? 0,
        queues: q.count ?? 0,
        ringGroups: rg.count ?? 0,
        callsToday: cdrs.count ?? 0,
        recordings: rec.count ?? 0,
      });
      setLoading(false);
    })();
  }, [active?.org_id]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{active?.name || 'Domain'} · Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Phone system cockpit for this customer domain.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {TILE.map(({ key, label, icon: Icon, path }) => (
          <Link key={key} to={`./${path}`}>
            <Card className="hover:border-primary/50 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? '—' : (c as any)[key]}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle className="text-sm">Quick links</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-2 text-sm">
          {[
            ['extensions', 'Extensions'], ['devices', 'Devices'], ['ivr', 'IVR'],
            ['queues', 'Queues'], ['ring-groups', 'Ring Groups'], ['hold-music', 'Music on hold'],
            ['dids', 'Phone Numbers'], ['hours', 'Business Hours'], ['recordings', 'Recordings'],
            ['calls', 'Call History'], ['pbx-users', 'Users'], ['settings', 'Settings'],
          ].map(([p, l]) => (
            <Link key={p} to={`./${p}`} className="px-3 py-1.5 rounded-md border border-border/60 hover:bg-accent">{l}</Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
