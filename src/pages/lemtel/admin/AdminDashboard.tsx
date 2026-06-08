import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Phone, Users, Voicemail, Clock, Target, HardDrive } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

function KpiCard({ icon: Icon, title, value, sub }: { icon: any; title: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export default function AdminDashboard() {
  const { data: kpis } = useQuery({
    queryKey: ['admin-kpis', LEMTEL_ORG_ID],
    refetchInterval: 30_000,
    queryFn: async () => {
      const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
      const [calls, exts, vms] = await Promise.all([
        (supabase as any).from('pbx_call_records').select('id,call_status,duration_seconds,missed_call', { count: 'exact' })
          .eq('organization_id', LEMTEL_ORG_ID).gte('start_at', startOfDay.toISOString()),
        (supabase as any).from('pbx_softphone_users').select('id,status', { count: 'exact' })
          .eq('organization_id', LEMTEL_ORG_ID),
        (supabase as any).from('pbx_voicemails').select('id,read_at', { count: 'exact' })
          .eq('organization_id', LEMTEL_ORG_ID).is('read_at', null),
      ]);
      const callRows = (calls.data ?? []) as any[];
      const answered = callRows.filter(r => r.call_status === 'answered').length;
      const missed = callRows.filter(r => r.missed_call).length;
      const avg = callRows.length ? Math.round(callRows.reduce((s, r) => s + (r.duration_seconds || 0), 0) / callRows.length) : 0;
      const extRows = (exts.data ?? []) as any[];
      const online = extRows.filter(e => e.status === 'online').length;
      return {
        callsToday: callRows.length, answered, missed,
        extensions: extRows.length, online,
        voicemails: vms.count ?? 0,
        avgDuration: `${Math.floor(avg / 60)}:${String(avg % 60).padStart(2, '0')}`,
        sla: callRows.length ? Math.round((answered / callRows.length) * 100) : 100,
      };
    },
  });

  const [feed, setFeed] = useState<{ id: string; text: string; at: string }[]>([]);
  useEffect(() => {
    const ch = supabase
      .channel('admin-live-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_call_records', filter: `organization_id=eq.${LEMTEL_ORG_ID}` },
        (p: any) => {
          const r = p.new;
          setFeed(f => [{
            id: r.id,
            text: `${r.direction === 'inbound' ? '📞 Incoming' : '📤 Outbound'} ${r.caller_number ?? ''} → ${r.destination_number ?? ''}`,
            at: r.start_at,
          }, ...f].slice(0, 30));
        })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pbx_voicemails', filter: `organization_id=eq.${LEMTEL_ORG_ID}` },
        (p: any) => {
          const r = p.new;
          setFeed(f => [{ id: r.id, text: `📬 New voicemail (${r.duration_seconds || 0}s)`, at: r.created_at }, ...f].slice(0, 30));
        })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Real-time overview of your Lemtel phone system.</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard icon={Phone} title="Calls Today" value={String(kpis?.callsToday ?? '—')}
          sub={kpis ? `${kpis.answered} answered · ${kpis.missed} missed` : undefined} />
        <KpiCard icon={Users} title="Extensions" value={kpis ? `${kpis.online}/${kpis.extensions}` : '—'} sub="Online / total" />
        <KpiCard icon={Voicemail} title="Voicemails" value={String(kpis?.voicemails ?? '—')} sub="Unread" />
        <KpiCard icon={Clock} title="Avg Duration" value={kpis?.avgDuration ?? '—'} sub="Today" />
        <KpiCard icon={Target} title="SLA" value={kpis ? `${kpis.sla}%` : '—'} sub="Target 80%" />
        <KpiCard icon={HardDrive} title="Storage" value="—" sub="Recordings + VM" />
      </div>

      <Card>
        <CardHeader><CardTitle>Live Activity</CardTitle></CardHeader>
        <CardContent>
          {feed.length === 0 ? (
            <p className="text-sm text-muted-foreground">Listening for live events…</p>
          ) : (
            <ul className="space-y-2 max-h-80 overflow-auto">
              {feed.map(e => (
                <li key={e.id} className="text-sm flex justify-between border-b pb-1">
                  <span>{e.text}</span>
                  <span className="text-muted-foreground text-xs">
                    {formatDistanceToNow(new Date(e.at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
