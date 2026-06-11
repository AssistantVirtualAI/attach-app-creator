import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Clock, Plus, Trash2, Loader2, Save, Pencil } from 'lucide-react';
import { LEMTEL_ORG } from '@/hooks/usePbxData';
import { usePbxWrite } from '@/hooks/usePbxWrite';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface Slot { day: number; start: string; end: string }
interface TimeCondition {
  id: string;
  organization_id: string;
  fusionpbx_dialplan_uuid: string | null;
  name: string;
  timezone: string | null;
  enabled: boolean;
  schedule: Slot[];
  open_destination: string | null;
  closed_destination: string | null;
  description: string | null;
  updated_at: string;
}

function useTimeConditions(orgId: string) {
  return useQuery({
    queryKey: ['pbx', 'time_conditions', orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pbx_time_conditions' as any)
        .select('*')
        .eq('organization_id', orgId)
        .order('name', { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as TimeCondition[];
    },
  });
}

export default function LemtelTimeConditions() {
  const orgId = LEMTEL_ORG;
  const { data: items = [], isLoading } = useTimeConditions(orgId);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<TimeCondition | null>(null);
  const [creating, setCreating] = useState(false);
  const write = usePbxWrite({
    invalidate: [['pbx', 'time_conditions', orgId]],
    successMessage: 'Time condition saved & deployed',
  });

  useEffect(() => {
    const ch = supabase
      .channel('pbx_time_conditions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pbx_time_conditions' }, () => {
        qc.invalidateQueries({ queryKey: ['pbx', 'time_conditions', orgId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc, orgId]);

  const remove = async (tc: TimeCondition) => {
    if (!confirm(`Delete "${tc.name}"?`)) return;
    await write.mutateAsync({
      organizationId: orgId,
      action: 'delete-time-condition',
      params: { dialplan_uuid: tc.fusionpbx_dialplan_uuid },
      objectType: 'time_condition',
      objectPbxUuid: tc.fusionpbx_dialplan_uuid || undefined,
    });
    await supabase.from('pbx_time_conditions' as any).delete().eq('id', tc.id);
    qc.invalidateQueries({ queryKey: ['pbx', 'time_conditions', orgId] });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Clock className="w-7 h-7" /> Time Conditions
          </h1>
          <p className="text-muted-foreground">
            Route inbound calls differently based on day-of-week / time-of-day. Synced to FusionPBX dialplans.
          </p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="config" />
          <Button onClick={() => { setEditing(null); setCreating(true); }}>
            <Plus className="w-4 h-4 mr-2" /> New time condition
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{items.length} time conditions</CardTitle>
          <CardDescription>Each rule generates a FusionPBX dialplan entry on save.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>
          ) : items.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              No time conditions yet — create one to start routing by schedule.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schedule</TableHead>
                  <TableHead>Open → Closed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((tc) => (
                  <TableRow key={tc.id}>
                    <TableCell className="font-medium">{tc.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(tc.schedule || []).length} slot{(tc.schedule || []).length !== 1 ? 's' : ''}
                      {tc.timezone ? ` · ${tc.timezone}` : ''}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {tc.open_destination || '—'} → {tc.closed_destination || '—'}
                    </TableCell>
                    <TableCell>
                      {tc.enabled ? <Badge>Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => { setEditing(tc); setCreating(true); }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => remove(tc)}>
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <TimeConditionDialog
        open={creating}
        onOpenChange={(o) => { setCreating(o); if (!o) setEditing(null); }}
        orgId={orgId}
        initial={editing}
        write={write}
      />
    </div>
  );
}

function TimeConditionDialog({
  open, onOpenChange, orgId, initial, write,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  orgId: string;
  initial: TimeCondition | null;
  write: ReturnType<typeof usePbxWrite>;
}) {
  const [name, setName] = useState('');
  const [tz, setTz] = useState('America/Toronto');
  const [enabled, setEnabled] = useState(true);
  const [slots, setSlots] = useState<Slot[]>([{ day: 1, start: '09:00', end: '17:00' }]);
  const [openDest, setOpenDest] = useState('');
  const [closedDest, setClosedDest] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (open) {
      setName(initial?.name || '');
      setTz(initial?.timezone || 'America/Toronto');
      setEnabled(initial?.enabled ?? true);
      setSlots(initial?.schedule?.length ? initial.schedule : [{ day: 1, start: '09:00', end: '17:00' }]);
      setOpenDest(initial?.open_destination || '');
      setClosedDest(initial?.closed_destination || '');
      setDescription(initial?.description || '');
    }
  }, [open, initial]);

  const updateSlot = (i: number, patch: Partial<Slot>) =>
    setSlots((s) => s.map((x, k) => (k === i ? { ...x, ...patch } : x)));

  const save = async () => {
    if (!name.trim()) return;
    const result = await write.mutateAsync({
      organizationId: orgId,
      action: 'upsert-time-condition',
      params: {
        dialplan_uuid: initial?.fusionpbx_dialplan_uuid || undefined,
        name,
        schedule: slots,
        open_destination: openDest,
        closed_destination: closedDest,
        timezone: tz,
        description,
        enabled,
      },
      objectType: 'time_condition',
      objectPbxUuid: initial?.fusionpbx_dialplan_uuid || undefined,
    });
    const dpUuid = (result?.proxy as any)?.dialplan_uuid || initial?.fusionpbx_dialplan_uuid;
    const row = {
      organization_id: orgId,
      name,
      timezone: tz,
      enabled,
      schedule: slots,
      open_destination: openDest,
      closed_destination: closedDest,
      description,
      fusionpbx_dialplan_uuid: dpUuid,
      last_synced_at: new Date().toISOString(),
    } as any;
    if (initial?.id) {
      await supabase.from('pbx_time_conditions' as any).update(row).eq('id', initial.id);
    } else {
      await supabase.from('pbx_time_conditions' as any).insert(row);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? 'Edit' : 'New'} time condition</DialogTitle>
          <DialogDescription>Defines when calls follow the open vs. closed destination.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Office hours" /></div>
            <div><Label>Timezone</Label><Input value={tz} onChange={(e) => setTz(e.target.value)} /></div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={enabled} onCheckedChange={setEnabled} />
            <Label>Enabled</Label>
          </div>

          <div className="space-y-2">
            <Label>Schedule slots</Label>
            {slots.map((s, i) => (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1">
                  <select
                    className="w-full h-10 px-3 rounded-md border bg-background text-sm"
                    value={s.day}
                    onChange={(e) => updateSlot(i, { day: Number(e.target.value) })}
                  >
                    {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
                  </select>
                </div>
                <div className="flex-1">
                  <Input type="time" value={s.start} onChange={(e) => updateSlot(i, { start: e.target.value })} />
                </div>
                <div className="flex-1">
                  <Input type="time" value={s.end} onChange={(e) => updateSlot(i, { end: e.target.value })} />
                </div>
                <Button size="icon" variant="ghost" onClick={() => setSlots(slots.filter((_, k) => k !== i))}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={() => setSlots([...slots, { day: 1, start: '09:00', end: '17:00' }])}>
              <Plus className="w-4 h-4 mr-1" /> Add slot
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div>
              <Label>Open destination</Label>
              <Input value={openDest} onChange={(e) => setOpenDest(e.target.value)} placeholder="100 XML public" />
            </div>
            <div>
              <Label>Closed destination</Label>
              <Input value={closedDest} onChange={(e) => setClosedDest(e.target.value)} placeholder="*99100 XML public" />
            </div>
          </div>

          <div>
            <Label>Description</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={save} disabled={write.isPending || !name.trim()}>
            {write.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save & deploy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
