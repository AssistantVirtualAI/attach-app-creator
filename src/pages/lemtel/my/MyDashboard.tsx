import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Voicemail, MessageCircle, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export default function MyDashboard() {
  const { data } = useQuery({
    queryKey: ['my-dashboard'],
    queryFn: async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return null;
      const { data: spu } = await (supabase as any)
        .from('pbx_softphone_users')
        .select('extension,display_name,organization_id')
        .eq('portal_user_id', uid)
        .maybeSingle();
      if (!spu) return { ext: null };

      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const { data: calls } = await (supabase as any).from('pbx_call_records')
        .select('id,duration_seconds')
        .eq('organization_id', spu.organization_id)
        .eq('extension', spu.extension)
        .gte('start_at', startOfDay.toISOString());
      const { count: vms } = await (supabase as any).from('pbx_voicemails')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', spu.organization_id)
        .eq('extension', spu.extension)
        .is('read_at', null);
      const callRows = (calls ?? []) as any[];
      const talkSec = callRows.reduce((s, r) => s + (r.duration_seconds || 0), 0);
      return {
        ext: spu.extension,
        name: spu.display_name,
        callsToday: callRows.length,
        voicemails: vms ?? 0,
        talkTime: `${Math.floor(talkSec / 3600)}h ${Math.floor((talkSec % 3600) / 60)}m`,
      };
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Dashboard</h1>
        <p className="text-muted-foreground">
          {data?.ext ? `Extension ${data.ext} · ${data.name ?? ''}` : 'No extension assigned'}
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">My calls today</CardTitle><Phone className="h-4 w-4" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.callsToday ?? '—'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">Voicemails</CardTitle><Voicemail className="h-4 w-4" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.voicemails ?? '—'}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">SMS</CardTitle><MessageCircle className="h-4 w-4" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">—</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm">Talk time today</CardTitle><Clock className="h-4 w-4" />
          </CardHeader>
          <CardContent><div className="text-2xl font-bold">{data?.talkTime ?? '—'}</div></CardContent>
        </Card>
      </div>
    </div>
  );
}
