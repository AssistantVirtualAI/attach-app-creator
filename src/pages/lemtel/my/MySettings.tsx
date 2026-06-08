import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { AiGreetingGenerator } from '@/components/portal/AiGreetingGenerator';

export default function MySettings() {
  const [spu, setSpu] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const { data } = await (supabase as any).from('pbx_softphone_users')
        .select('*').eq('portal_user_id', auth.user?.id).maybeSingle();
      setSpu(data);
    })();
  }, []);

  if (!spu) return <p className="text-muted-foreground">Loading…</p>;

  const save = async (patch: Record<string, any>) => {
    setBusy(true);
    const { error } = await (supabase as any).from('pbx_softphone_users')
      .update(patch).eq('id', spu.id);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success('Saved'); setSpu({ ...spu, ...patch }); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">My Settings</h1>

      <Card>
        <CardHeader><CardTitle>Caller ID</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Display name</Label>
            <Input defaultValue={spu.display_name ?? ''}
              onBlur={e => save({ display_name: e.target.value })} />
          </div>
          <div><Label>Outbound number (set by admin)</Label>
            <Input value={spu.outbound_cid ?? ''} readOnly />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Call Forwarding</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Forward all → number</Label>
            <Input defaultValue={spu.forward_all ?? ''} onBlur={e => save({ forward_all: e.target.value || null })} /></div>
          <div><Label>Forward busy → number</Label>
            <Input defaultValue={spu.forward_busy ?? ''} onBlur={e => save({ forward_busy: e.target.value || null })} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>No answer → number</Label>
              <Input defaultValue={spu.forward_no_answer ?? ''} onBlur={e => save({ forward_no_answer: e.target.value || null })} /></div>
            <div><Label>Ring time (s)</Label>
              <Input type="number" defaultValue={spu.no_answer_ring ?? 20}
                onBlur={e => save({ no_answer_ring: Number(e.target.value) })} /></div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Do Not Disturb</CardTitle></CardHeader>
        <CardContent className="flex items-center justify-between">
          <Label>DND</Label>
          <Switch checked={!!spu.dnd_enabled} onCheckedChange={v => save({ dnd_enabled: v })} disabled={busy} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Voicemail</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between"><Label>Email notifications</Label>
            <Switch checked={!!spu.vm_email_enabled} onCheckedChange={v => save({ vm_email_enabled: v })} /></div>
          <div className="flex items-center justify-between"><Label>Transcription</Label>
            <Switch checked={!!spu.vm_transcribe_enabled} onCheckedChange={v => save({ vm_transcribe_enabled: v })} /></div>
          <div><Label>Voicemail PIN</Label>
            <Input defaultValue={spu.vm_pin ?? ''} onBlur={e => save({ vm_pin: e.target.value })} /></div>
        </CardContent>
      </Card>

      <AiGreetingGenerator />

      <Card>
        <CardHeader><CardTitle>My Devices</CardTitle></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">Synced from FusionPBX. View in the Devices admin page.</p></CardContent>
      </Card>
    </div>
  );
}
