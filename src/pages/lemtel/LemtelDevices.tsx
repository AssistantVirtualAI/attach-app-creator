import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Router, Circle, Loader2, Plus, Pencil, Trash2 } from 'lucide-react';
import { usePbxDevices, usePbxExtensions, LEMTEL_ORG } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { PBX_DEVICE_BRANDS, formatMac } from '@/data/pbxDeviceModels';
import { usePbxDeviceCatalog } from '@/hooks/usePbxDeviceCatalog';
import { DeviceProvisioningPanel } from '@/components/lemtel/DeviceProvisioningPanel';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

type Device = any;

export default function LemtelDevices() {
  const { data: devices = [], isLoading } = usePbxDevices();
  const { data: extensions = [] } = usePbxExtensions();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Router className="w-7 h-7" /> Devices</h1>
          <p className="text-muted-foreground">SIP phones and ATAs — synced bidirectionally with FusionPBX</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="devices" />
          <DeviceDialog
            mode="create"
            extensions={extensions as any[]}
            trigger={<Button><Plus className="w-4 h-4 mr-2" /> New device</Button>}
          />
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{(devices as Device[]).length} devices</CardTitle></CardHeader>
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
                  <TableHead>Model / Template</TableHead>
                  <TableHead>Extension</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Seen</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(devices as Device[]).length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No devices yet — click “New device” to provision one.</TableCell></TableRow>
                ) : (devices as Device[]).map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-medium">{d.label || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{d.mac_address || '—'}</TableCell>
                    <TableCell>{d.vendor || '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{d.model || d.template || '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{d.assigned_extension || '—'}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Circle className={`w-2.5 h-2.5 ${d.registration_status === 'registered' ? 'fill-green-500 text-green-500' : 'fill-muted text-muted'}`} />
                        {d.registration_status || (d.enabled ? 'enabled' : 'disabled')}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <DeviceDialog
                          mode="edit"
                          device={d}
                          extensions={extensions as any[]}
                          trigger={<Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>}
                        />
                        <DeleteDeviceBtn device={d} />
                      </div>
                    </TableCell>
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

function DeviceDialog({ mode, device, extensions, trigger }:
  { mode: 'create' | 'edit'; device?: Device; extensions: any[]; trigger: React.ReactNode }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    label: device?.label || '',
    mac: device?.mac_address || '',
    vendor: device?.vendor || 'Yealink',
    model: device?.model || '',
    template: device?.template || '',
    extension: device?.assigned_extension || '',
    enabled: device?.enabled ?? true,
  });

  const models = useMemo(() => PBX_DEVICE_BRANDS[form.vendor] || [], [form.vendor]);

  const submit = async () => {
    const macClean = form.mac.replace(/[^0-9a-fA-F]/g, '').toLowerCase();
    if (macClean.length !== 12) {
      toast.error('MAC must be 12 hex characters');
      return;
    }
    setBusy(true);
    try {
      const action = mode === 'create' ? 'create-device' : 'update-device';
      const params: any = {
        device_label: form.label || macClean,
        device_mac_address: macClean,
        device_vendor: form.vendor,
        device_model: form.model,
        device_template: form.template || `${form.vendor.toLowerCase()}/${form.model}`,
        device_enabled: form.enabled ? 'true' : 'false',
      };
      if (form.extension) {
        const ext = (extensions as any[]).find((e) => e.extension === form.extension);
        if (ext?.pbx_uuid) params.device_user_uuid = ext.pbx_uuid;
        params.device_user_extension = form.extension;
      }
      if (mode === 'edit') params.device_uuid = device.pbx_uuid;

      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action, params },
      });
      if (error) throw error;
      if (data?.ok === false || data?.error) throw new Error(data?.message || data?.error || 'FusionPBX error');

      // Pull fresh device list from PBX
      await supabase.functions.invoke('realtime-sync', { body: { organizationId: LEMTEL_ORG, kind: 'devices' } });
      qc.invalidateQueries({ queryKey: ['pbx'] });
      toast.success(mode === 'create' ? 'Device created' : 'Device updated');
      setOpen(false);
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Provision new device' : `Edit ${device?.label || device?.mac_address}`}</DialogTitle>
          <DialogDescription>Provisioning is pushed live to FusionPBX. Compatible vendors are loaded from the device catalog.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label>Label</Label>
            <Input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="Reception phone" />
          </div>
          <div className="col-span-2">
            <Label>MAC address</Label>
            <Input
              value={form.mac}
              onChange={(e) => setForm({ ...form, mac: formatMac(e.target.value) })}
              placeholder="aa:bb:cc:dd:ee:ff"
              className="font-mono"
            />
          </div>
          <div>
            <Label>Vendor</Label>
            <Select value={form.vendor} onValueChange={(v) => setForm({ ...form, vendor: v, model: '' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.keys(PBX_DEVICE_BRANDS).map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Model</Label>
            <Select value={form.model} onValueChange={(v) => setForm({ ...form, model: v })}>
              <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
              <SelectContent>
                {models.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Assigned extension</Label>
            <Select value={form.extension || 'none'} onValueChange={(v) => setForm({ ...form, extension: v === 'none' ? '' : v })}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {(extensions as any[]).map((e: any) => (
                  <SelectItem key={e.id} value={e.extension}>
                    {e.extension}{e.display_name ? ` · ${e.display_name}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2">
            <Label>Template override (optional)</Label>
            <Input
              value={form.template}
              onChange={(e) => setForm({ ...form, template: e.target.value })}
              placeholder={`${form.vendor.toLowerCase()}/${form.model || 'auto'}`}
              className="font-mono text-xs"
            />
          </div>
          <div className="flex items-center gap-2 col-span-2">
            <Switch checked={form.enabled} onCheckedChange={(v) => setForm({ ...form, enabled: v })} />
            <Label>Enabled</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !form.mac || !form.model}>
            {busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === 'create' ? 'Provision' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDeviceBtn({ device }: { device: Device }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (!confirm(`Delete device ${device.label || device.mac_address}? This removes it from FusionPBX.`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action: 'delete-device', params: { device_uuid: device.pbx_uuid } },
      });
      if (error || data?.ok === false) throw new Error(data?.message || error?.message || 'Failed');
      await supabase.from('pbx_devices').delete().eq('id', device.id);
      qc.invalidateQueries({ queryKey: ['pbx'] });
      toast.success('Device deleted');
    } catch (e: any) {
      toast.error(e.message || 'Failed');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Button size="sm" variant="ghost" onClick={onClick} disabled={busy}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}
    </Button>
  );
}
