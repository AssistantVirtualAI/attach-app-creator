import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { PhoneForwarded } from 'lucide-react';

export default function MyForwarding() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ext, setExt] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState('');
  const [rowId, setRowId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) { setLoading(false); return; }
      const { data: spu } = await (supabase as any)
        .from('pbx_softphone_users')
        .select('extension, organization_id')
        .eq('portal_user_id', auth.user.id)
        .maybeSingle();
      if (!spu) { setLoading(false); return; }
      setExt(spu.extension);
      setOrgId(spu.organization_id);
      const { data: fwd } = await (supabase as any)
        .from('pbx_call_forwarding')
        .select('id, enabled, forward_to')
        .eq('organization_id', spu.organization_id)
        .eq('extension', spu.extension)
        .maybeSingle();
      if (fwd) {
        setRowId(fwd.id);
        setEnabled(!!fwd.enabled);
        setTarget(fwd.forward_to ?? '');
      }
      setLoading(false);
    })();
  }, []);

  const save = async () => {
    if (!ext || !orgId) return;
    setSaving(true);
    const payload = { organization_id: orgId, extension: ext, enabled, forward_to: target };
    const q = rowId
      ? (supabase as any).from('pbx_call_forwarding').update(payload).eq('id', rowId)
      : (supabase as any).from('pbx_call_forwarding').insert(payload).select('id').single();
    const { data, error } = await q;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    if (!rowId && data?.id) setRowId(data.id);
    toast.success('Forwarding updated');
  };

  if (loading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!ext) return <div className="p-6 text-muted-foreground">No extension assigned.</div>;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <PhoneForwarded className="h-6 w-6 text-cockpit-cyan" />
        <h1 className="page-title text-2xl font-semibold">Call Forwarding · Ext {ext}</h1>
      </div>
      <Card>
        <CardHeader><CardTitle>Forward incoming calls</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="fwd-on">Enable forwarding</Label>
            <Switch id="fwd-on" checked={enabled} onCheckedChange={setEnabled} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="fwd-to">Forward to (phone or extension)</Label>
            <Input id="fwd-to" value={target} onChange={(e) => setTarget(e.target.value)} placeholder="+15145551234 or 102" />
          </div>
          <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
        </CardContent>
      </Card>
    </div>
  );
}
