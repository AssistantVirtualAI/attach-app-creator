import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SoftphoneWidget } from '@/components/softphone/SoftphoneWidget';
import { Phone, Users, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { DesktopDownloadCard } from '@/components/telephony/DesktopDownloadCard';

export default function TelephonyWebphone() {
  const [search, setSearch] = useState('');

  const { data: contacts = [] } = useQuery({
    queryKey: ['webphone-contacts'],
    queryFn: async () => {
      const [{ data: exts }, { data: clients }] = await Promise.all([
        supabase.from('pbx_extensions').select('id, extension, effective_cid_name, description'),
        supabase.from('clients').select('id, name, phone').not('phone', 'is', null),
      ]);
      return [
        ...(exts || []).map((e: any) => ({ id: `e-${e.id}`, name: e.effective_cid_name || `Ext ${e.extension}`, number: e.extension, type: 'internal' })),
        ...(clients || []).map((c: any) => ({ id: `c-${c.id}`, name: c.name, number: c.phone, type: 'external' })),
      ];
    },
  });

  const { data: recents = [] } = useQuery({
    queryKey: ['webphone-recents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pbx_call_records')
        .select('id, direction, caller_number, destination_number, duration_seconds, start_at, missed_call')
        .order('start_at', { ascending: false }).limit(30);
      if (error) console.warn('[webphone-recents] query failed:', error.message);
      return data || [];
    },
    refetchInterval: 15000,
  });

  const filtered = contacts.filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) || c.number?.includes(search)
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Phone className="w-7 h-7" /> Softphone</h1>
        <p className="text-muted-foreground">Make and receive calls in the browser via WebRTC</p>
      </div>

      <DesktopDownloadCard />

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr_360px] gap-4">
        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Users className="w-4 h-4" /> Contacts</CardTitle>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search…" className="h-8 mt-2" />
          </CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="space-y-1 pt-0">
              {filtered.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div>
                    <div className="text-sm">{c.name}</div>
                    <div className="text-xs text-muted-foreground">{c.number}</div>
                  </div>
                  <span className="text-[10px] uppercase text-muted-foreground">{c.type}</span>
                </div>
              ))}
            </CardContent>
          </ScrollArea>
        </Card>

        <div className="flex items-start justify-center">
          <SoftphoneWidget variant="full" />
        </div>

        <Card className="h-[600px] flex flex-col">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Clock className="w-4 h-4" /> Recents</CardTitle>
          </CardHeader>
          <ScrollArea className="flex-1">
            <CardContent className="space-y-1 pt-0">
              {recents.length === 0 ? (
                <div className="text-xs text-muted-foreground p-2">No recent calls yet.</div>
              ) : recents.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between p-2 rounded hover:bg-muted/50">
                  <div>
                    <div className="text-sm">{r.direction === 'outbound' ? r.destination_number : r.caller_number}</div>
                    <div className="text-xs text-muted-foreground">{r.start_at ? new Date(r.start_at).toLocaleString() : ''}</div>
                  </div>
                  <span className="text-xs text-muted-foreground">{r.duration_seconds || 0}s</span>
                </div>
              ))}
            </CardContent>
          </ScrollArea>
        </Card>
      </div>
    </div>
  );
}
