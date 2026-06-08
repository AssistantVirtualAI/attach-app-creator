import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Bell, Plus, Loader2, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { LEMTEL_ORG, usePbxExtensions, usePbxRingGroups } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useLanguage } from '@/context/LanguageContext';

const STRATEGIES = ['simultaneous', 'sequence', 'enterprise', 'rollover', 'random'];

const copy = {
  en: {
    title: 'Ring Groups', subtitle: 'Create, edit, and sync hunt groups with FusionPBX in real time.', new: 'New Ring Group', count: 'ring groups',
    empty: 'No ring groups yet — create one to route inbound calls to several extensions.', name: 'Name', extension: 'Extension', strategy: 'Strategy', members: 'Members', status: 'Status', actions: 'Actions', enabled: 'enabled', disabled: 'disabled', destinations: 'Destinations', save: 'Save', create: 'Create', cancel: 'Cancel', description: 'Description', forwarding: 'Forwarding / fallback', synced: 'Synced to FusionPBX', failed: 'FusionPBX sync failed', deleteConfirm: 'Delete ring group from FusionPBX?'
  },
  fr: {
    title: 'Groupes d’appel', subtitle: 'Créer, modifier et synchroniser les groupes d’appel avec FusionPBX en temps réel.', new: 'Nouveau groupe', count: 'groupes',
    empty: 'Aucun groupe d’appel — créez-en un pour router les appels entrants vers plusieurs extensions.', name: 'Nom', extension: 'Extension', strategy: 'Stratégie', members: 'Membres', status: 'Statut', actions: 'Actions', enabled: 'actif', disabled: 'inactif', destinations: 'Destinations', save: 'Enregistrer', create: 'Créer', cancel: 'Annuler', description: 'Description', forwarding: 'Renvoi / secours', synced: 'Synchronisé avec FusionPBX', failed: 'Échec de synchronisation FusionPBX', deleteConfirm: 'Supprimer ce groupe dans FusionPBX ?'
  },
};

export default function TelephonyRingGroups() {
  const { data: groups = [], isLoading } = usePbxRingGroups();
  const { data: extensions = [] } = usePbxExtensions();
  const { language } = useLanguage();
  const txt = copy[language];
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Bell className="w-7 h-7" /> {txt.title}</h1>
          <p className="text-muted-foreground">{txt.subtitle}</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <RingGroupDialog mode="create" extensions={extensions as any[]} txt={txt} trigger={<Button><Plus className="w-4 h-4 mr-2" /> {txt.new}</Button>} />
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>{groups.length} {txt.count}</CardTitle><CardDescription>{txt.synced}</CardDescription></CardHeader>
        <CardContent>
          {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
            <Table>
              <TableHeader><TableRow>
                <TableHead>{txt.name}</TableHead><TableHead>{txt.extension}</TableHead><TableHead>{txt.strategy}</TableHead>
                <TableHead>{txt.members}</TableHead><TableHead>{txt.status}</TableHead><TableHead className="text-right">{txt.actions}</TableHead>
              </TableRow></TableHeader>
              <TableBody>
                {groups.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-10">{txt.empty}</TableCell></TableRow>
                ) : (groups as any[]).map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="font-mono">{g.extension || '—'}</TableCell>
                    <TableCell><Badge variant="outline">{g.strategy || g.ring_group_strategy || '—'}</Badge></TableCell>
                    <TableCell>{getDestinations(g).length || '—'}</TableCell>
                    <TableCell><Badge variant={g.enabled === false ? 'outline' : 'default'}>{g.enabled === false ? txt.disabled : txt.enabled}</Badge></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <RingGroupDialog mode="edit" group={g} extensions={extensions as any[]} txt={txt} trigger={<Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>} />
                        <DeleteRingGroup group={g} txt={txt} />
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

function getDestinations(group: any): string[] {
  const raw = group.raw_data || group;
  const csv = raw.ring_group_destinations || raw.ring_group_destination || raw.destinations || group.forwarding || '';
  if (Array.isArray(csv)) return csv.filter(Boolean).map(String);
  return String(csv).split(/[\n,|]+/).map((x) => x.trim()).filter(Boolean);
}

function RingGroupDialog({ mode, group, extensions, trigger, txt }: { mode: 'create' | 'edit'; group?: any; extensions: any[]; trigger: React.ReactNode; txt: typeof copy.en }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const initialDestinations = useMemo(() => getDestinations(group || {}).join('\n'), [group?.id]);
  const [form, setForm] = useState({
    ring_group_name: group?.name || '',
    ring_group_extension: group?.extension || '',
    ring_group_strategy: group?.strategy || 'simultaneous',
    ring_group_destinations: initialDestinations,
    ring_group_forward_destination: group?.forwarding || '',
    ring_group_description: group?.description || '',
    ring_group_enabled: group?.enabled !== false,
  });

  const addExtensionDestination = (extension: string) => {
    const current = form.ring_group_destinations.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    if (!current.includes(extension)) setForm({ ...form, ring_group_destinations: [...current, extension].join('\n') });
  };

  const submit = async () => {
    setBusy(true);
    try {
      const params: any = {
        ...form,
        ring_group_enabled: form.ring_group_enabled ? 'true' : 'false',
        ring_group_destinations: form.ring_group_destinations.split(/\n+/).map((x) => x.trim()).filter(Boolean).join(','),
      };
      if (mode === 'edit') params.ring_group_uuid = group.pbx_uuid;
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action: mode === 'create' ? 'create-ring-group' : 'update-ring-group', params },
      });
      if (error || data?.ok === false) throw new Error(data?.message || error?.message || txt.failed);
      await supabase.functions.invoke('fusionpbx-proxy', { body: { organization_id: LEMTEL_ORG, action: 'sync-all', params: { resources: ['ring_groups'] } } });
      qc.invalidateQueries({ queryKey: ['pbx'] });
      toast({ title: txt.synced });
      setOpen(false);
    } catch (e: any) {
      toast({ title: txt.failed, description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? txt.new : `${txt.save} ${group?.name}`}</DialogTitle>
          <DialogDescription>{txt.subtitle}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>{txt.name}</Label><Input value={form.ring_group_name} onChange={(e) => setForm({ ...form, ring_group_name: e.target.value })} /></div>
          <div><Label>{txt.extension}</Label><Input value={form.ring_group_extension} onChange={(e) => setForm({ ...form, ring_group_extension: e.target.value })} placeholder="6000" /></div>
          <div><Label>{txt.strategy}</Label><Select value={form.ring_group_strategy} onValueChange={(v) => setForm({ ...form, ring_group_strategy: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
          <div className="col-span-2"><Label>{txt.destinations}</Label><Textarea rows={5} value={form.ring_group_destinations} onChange={(e) => setForm({ ...form, ring_group_destinations: e.target.value })} placeholder="300&#10;301&#10;302" /></div>
          <div className="col-span-2 flex flex-wrap gap-1">{extensions.slice(0, 18).map((e) => <Button key={e.id} type="button" variant="outline" size="sm" onClick={() => addExtensionDestination(e.extension)}>{e.extension}</Button>)}</div>
          <div><Label>{txt.forwarding}</Label><Input value={form.ring_group_forward_destination} onChange={(e) => setForm({ ...form, ring_group_forward_destination: e.target.value })} placeholder="voicemail:300" /></div>
          <div className="flex items-center gap-2 pt-6"><Switch checked={form.ring_group_enabled} onCheckedChange={(v) => setForm({ ...form, ring_group_enabled: v })} /><Label>{txt.enabled}</Label></div>
          <div className="col-span-2"><Label>{txt.description}</Label><Textarea rows={2} value={form.ring_group_description} onChange={(e) => setForm({ ...form, ring_group_description: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{txt.cancel}</Button><Button disabled={busy || !form.ring_group_name || !form.ring_group_extension} onClick={submit}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{mode === 'create' ? txt.create : txt.save}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteRingGroup({ group, txt }: { group: any; txt: typeof copy.en }) {
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const onDelete = async () => {
    if (!confirm(txt.deleteConfirm)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', { body: { organization_id: LEMTEL_ORG, action: 'delete-ring-group', params: { ring_group_uuid: group.pbx_uuid } } });
      if (error || data?.ok === false) throw new Error(data?.message || error?.message || txt.failed);
      await supabase.from('pbx_ring_groups' as any).delete().eq('id', group.id);
      qc.invalidateQueries({ queryKey: ['pbx'] });
      toast({ title: txt.synced });
    } catch (e: any) { toast({ title: txt.failed, description: e.message, variant: 'destructive' }); }
    finally { setBusy(false); }
  };
  return <Button size="sm" variant="ghost" onClick={onDelete} disabled={busy}>{busy ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}</Button>;
}
