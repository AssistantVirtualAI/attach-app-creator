import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { AiGreetingGenerator } from '@/components/portal/AiGreetingGenerator';
import { Trash2, PhoneCall } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const LEMTEL_ORG_ID = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

type VM = {
  id: string; extension: string | null; caller_number: string | null;
  duration_seconds: number | null; transcript: string | null;
  read_at: string | null; created_at: string; storage_path: string | null;
};

export default function AdminVoicemail({ scope = 'org' }: { scope?: 'org' | 'mine' }) {
  const [rows, setRows] = useState<VM[]>([]);
  const [urls, setUrls] = useState<Record<string, string>>({});

  const load = async () => {
    let q = (supabase as any).from('pbx_voicemails')
      .select('id,extension,caller_number,duration_seconds,transcript,read_at,created_at,storage_path')
      .eq('organization_id', LEMTEL_ORG_ID)
      .order('created_at', { ascending: false })
      .limit(200);
    if (scope === 'mine') {
      const { data: auth } = await supabase.auth.getUser();
      const { data: spu } = await (supabase as any).from('pbx_softphone_users')
        .select('extension').eq('portal_user_id', auth.user?.id).maybeSingle();
      if (spu?.extension) q = q.eq('extension', spu.extension);
    }
    const { data } = await q;
    setRows((data ?? []) as VM[]);
  };
  useEffect(() => { load(); }, [scope]);

  const markRead = async (id: string) => {
    await supabase.rpc('mark_voicemail_read', { _id: id });
    load();
  };

  const sign = async (path: string) => {
    if (urls[path]) return urls[path];
    const { data } = await supabase.storage.from('voicemail-audio').createSignedUrl(path, 3600);
    if (data?.signedUrl) setUrls(u => ({ ...u, [path]: data.signedUrl }));
    return data?.signedUrl;
  };

  const grouped = rows.reduce<Record<string, VM[]>>((acc, r) => {
    const k = r.extension ?? 'Unknown';
    (acc[k] ||= []).push(r);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{scope === 'mine' ? 'My Voicemail' : 'Voicemail Management'}</h1>

      {Object.entries(grouped).map(([ext, items]) => (
        <Card key={ext}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Extension {ext}
              <Badge variant="outline">{items.filter(v => !v.read_at).length} unread</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(v => (
              <div key={v.id} className={`border rounded p-3 space-y-2 ${!v.read_at ? 'bg-muted/40' : ''}`}>
                <div className="flex justify-between flex-wrap gap-2 text-sm">
                  <div>
                    <strong>{v.caller_number ?? 'Unknown'}</strong>
                    <span className="text-muted-foreground ml-2">{Math.round(v.duration_seconds ?? 0)}s · {formatDistanceToNow(new Date(v.created_at), { addSuffix: true })}</span>
                  </div>
                  <div className="flex gap-1">
                    {v.storage_path && (
                      <Button size="sm" variant="outline" onClick={async () => { await sign(v.storage_path!); markRead(v.id); }}>Load</Button>
                    )}
                    {v.caller_number && (
                      <Button size="sm" variant="outline"><PhoneCall className="h-3.5 w-3.5" /></Button>
                    )}
                    <Button size="sm" variant="outline"><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                {v.storage_path && urls[v.storage_path] && <audio controls src={urls[v.storage_path]} className="w-full h-10" />}
                {v.transcript && <p className="text-xs text-muted-foreground italic">"{v.transcript}"</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      {scope !== 'mine' && (
        <AiGreetingGenerator defaultText="Thank you for calling Lemtel. We're currently unavailable. Please leave a message." />
      )}
    </div>
  );
}
