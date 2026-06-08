import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Headphones, Plus, Loader2, Pencil, Trash2, Users, RefreshCw, Shield, UserPlus, Activity } from 'lucide-react';
import { usePbxQueues, LEMTEL_ORG } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';

const STRATEGIES = ['ring-all', 'longest-idle-agent', 'round-robin', 'top-down', 'agent-with-least-talk-time', 'agent-with-fewest-calls', 'sequentially-by-agent-order', 'random'];

export default function LemtelQueues() {
  const { data: queues = [], isLoading } = usePbxQueues();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = (queues as any[]).find((q) => q.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Headphones className="w-7 h-7" /> Call Center · Queues</h1>
          <p className="text-muted-foreground">Manage ACD queues, agents, supervisors and live activity — synced with FusionPBX</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="ivr-queues" />
          <QueueDialog mode="create" trigger={<Button><Plus className="w-4 h-4 mr-2" /> New Queue</Button>} />
        </div>
      </div>

      <Tabs defaultValue="queues" className="w-full">
        <TabsList>
          <TabsTrigger value="queues"><Headphones className="w-4 h-4 mr-1" /> Queues</TabsTrigger>
          <TabsTrigger value="agents" disabled={!selected}><Users className="w-4 h-4 mr-1" /> Agents & Supervisors</TabsTrigger>
          <TabsTrigger value="live"><Activity className="w-4 h-4 mr-1" /> Live Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="queues">
          <Card>
            <CardHeader><CardTitle>{queues.length} queues</CardTitle><CardDescription>Click a row to manage its agents</CardDescription></CardHeader>
            <CardContent>
              {isLoading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> : (
                <Table>
                  <TableHeader><TableRow>
                    <TableHead>Name</TableHead><TableHead>Ext</TableHead><TableHead>Strategy</TableHead>
                    <TableHead>Max Wait</TableHead><TableHead>Recording</TableHead><TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow></TableHeader>
                  <TableBody>
                    {(queues as any[]).map((q: any) => (
                      <TableRow key={q.id} className={selectedId === q.id ? 'bg-muted/50' : 'cursor-pointer'} onClick={() => setSelectedId(q.id)}>
                        <TableCell className="font-medium">{q.name}</TableCell>
                        <TableCell className="font-mono">{q.extension || '-'}</TableCell>
                        <TableCell><Badge variant="outline">{q.strategy}</Badge></TableCell>
                        <TableCell>{q.max_wait_time}s</TableCell>
                        <TableCell>{q.record_enabled ? <Badge>On</Badge> : <Badge variant="outline">Off</Badge>}</TableCell>
                        <TableCell>{q.enabled ? <Badge>Enabled</Badge> : <Badge variant="outline">Disabled</Badge>}</TableCell>
                        <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setSelectedId(q.id)}><Users className="w-4 h-4" /></Button>
                            <QueueDialog mode="edit" queue={q} trigger={<Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>} />
                            <DeleteQueueBtn queue={q} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {queues.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No queues yet — click <b>New Queue</b> to create one in FusionPBX.</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          {selected ? <QueueAgentsPanel queue={selected} /> : <Card><CardContent className="p-6 text-muted-foreground">Select a queue first.</CardContent></Card>}
        </TabsContent>

        <TabsContent value="live"><LiveStatsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Queue create/edit dialog ----------
function QueueDialog({ mode, queue, trigger }: { mode: 'create' | 'edit'; queue?: any; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const qc = useQueryClient();
  const [form, setForm] = useState({
    queue_name: queue?.name || '',
    queue_extension: queue?.extension || '',
    queue_strategy: queue?.strategy || 'ring-all',
    queue_max_wait_time: String(queue?.max_wait_time ?? 60),
    queue_record_template: queue?.record_enabled ? '${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}/${uuid}.${record_ext}' : '',
    queue_description: queue?.description || '',
    queue_moh_sound: queue?.music_on_hold || '$${hold_music}',
    queue_enabled: queue?.enabled ?? true,
  });

  const submit = async () => {
    setBusy(true);
    try {
      const action = mode === 'create' ? 'create-queue' : 'update-queue';
      const params: any = {
        ...form,
        queue_enabled: form.queue_enabled ? 'true' : 'false',
      };
      if (mode === 'edit') params.call_center_queue_uuid = queue.pbx_uuid;
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action, params },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.message || 'FusionPBX error');
      toast({ title: mode === 'create' ? 'Queue created' : 'Queue updated' });
      await supabase.functions.invoke('fusionpbx-proxy', { body: { organization_id: LEMTEL_ORG, action: 'sync-all', params: { resources: ['queues'] } } });
      qc.invalidateQueries({ queryKey: ['pbx_call_queues'] });
      setOpen(false);
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create Queue' : `Edit ${queue?.name}`}</DialogTitle>
          <DialogDescription>Settings push directly to FusionPBX call center module.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label>Name</Label><Input value={form.queue_name} onChange={(e) => setForm({ ...form, queue_name: e.target.value })} /></div>
          <div><Label>Extension</Label><Input value={form.queue_extension} onChange={(e) => setForm({ ...form, queue_extension: e.target.value })} placeholder="e.g. 5000" /></div>
          <div><Label>Strategy</Label>
            <Select value={form.queue_strategy} onValueChange={(v) => setForm({ ...form, queue_strategy: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{STRATEGIES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Max wait (sec)</Label><Input type="number" value={form.queue_max_wait_time} onChange={(e) => setForm({ ...form, queue_max_wait_time: e.target.value })} /></div>
          <div><Label>Music on hold</Label><Input value={form.queue_moh_sound} onChange={(e) => setForm({ ...form, queue_moh_sound: e.target.value })} /></div>
          <div className="col-span-2"><Label>Description</Label><Textarea value={form.queue_description} onChange={(e) => setForm({ ...form, queue_description: e.target.value })} rows={2} /></div>
          <div className="flex items-center gap-2"><Switch checked={!!form.queue_record_template} onCheckedChange={(v) => setForm({ ...form, queue_record_template: v ? '${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}/${uuid}.${record_ext}' : '' })} /><Label>Record calls</Label></div>
          <div className="flex items-center gap-2"><Switch checked={form.queue_enabled} onCheckedChange={(v) => setForm({ ...form, queue_enabled: v })} /><Label>Enabled</Label></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={submit} disabled={busy || !form.queue_name}>{busy && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}{mode === 'create' ? 'Create' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteQueueBtn({ queue }: { queue: any }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    if (!confirm(`Delete queue "${queue.name}"? This removes it from FusionPBX.`)) return;
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action: 'delete-queue', params: { call_center_queue_uuid: queue.pbx_uuid } },
      });
      if (error || data?.ok === false) throw new Error(data?.message || error?.message || 'Failed');
      await supabase.from('pbx_call_queues').delete().eq('id', queue.id);
      toast({ title: 'Queue deleted' });
      qc.invalidateQueries({ queryKey: ['pbx_call_queues'] });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return <Button size="sm" variant="ghost" onClick={onClick} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}</Button>;
}

// ---------- Agents per queue ----------
function QueueAgentsPanel({ queue }: { queue: any }) {
  const [agents, setAgents] = useState<any[]>([]);
  const [extensions, setExtensions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = async () => {
    setLoading(true);
    const [{ data: a }, { data: e }] = await Promise.all([
      supabase.from('pbx_queue_agents').select('*').eq('queue_id', queue.id),
      supabase.from('pbx_extensions').select('id, extension, display_name').eq('organization_id', LEMTEL_ORG).order('extension'),
    ]);
    setAgents(a || []); setExtensions(e || []); setLoading(false);
  };
  useEffect(() => { load(); }, [queue.id]);

  const addAgent = async (extensionId: string, role: 'agent' | 'supervisor') => {
    const ext = extensions.find((x) => x.id === extensionId);
    if (!ext) return;
    const tier_level = role === 'supervisor' ? 1 : 2;
    const tier_position = (agents.filter((a) => a.tier_level === tier_level).length) + 1;
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action: 'add-queue-tier', params: {
          call_center_queue_uuid: queue.pbx_uuid,
          tier_agent: ext.extension,
          tier_level, tier_position,
        }},
      });
      if (error || data?.ok === false) throw new Error(data?.message || error?.message || 'Failed');
      await supabase.from('pbx_queue_agents').insert({
        queue_id: queue.id, extension_id: ext.id, agent_id: ext.extension,
        agent_name: ext.display_name || ext.extension, tier_level, tier_position,
      });
      toast({ title: `${role === 'supervisor' ? 'Supervisor' : 'Agent'} added` });
      load();
    } catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };

  const removeAgent = async (a: any) => {
    if (!confirm(`Remove ${a.agent_name} from ${queue.name}?`)) return;
    try {
      if (a.raw_data?.call_center_tier_uuid) {
        await supabase.functions.invoke('fusionpbx-proxy', { body: { organization_id: LEMTEL_ORG, action: 'remove-queue-tier', params: { call_center_tier_uuid: a.raw_data.call_center_tier_uuid }}});
      }
      await supabase.from('pbx_queue_agents').delete().eq('id', a.id);
      toast({ title: 'Removed' });
      load();
    } catch (e: any) { toast({ title: 'Failed', description: e.message, variant: 'destructive' }); }
  };

  const supervisors = agents.filter((a) => a.tier_level === 1);
  const regularAgents = agents.filter((a) => a.tier_level !== 1);
  const availableExt = extensions.filter((e) => !agents.some((a) => a.extension_id === e.id));

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="grid md:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><Shield className="w-4 h-4" /> Supervisors</CardTitle><CardDescription>Tier 1 — receive calls first / monitor agents</CardDescription></div>
          <AddAgentBtn extensions={availableExt} onAdd={(id) => addAgent(id, 'supervisor')} role="supervisor" />
        </CardHeader>
        <CardContent>
          {supervisors.length === 0 ? <p className="text-sm text-muted-foreground">No supervisors yet.</p> : (
            <div className="space-y-1">{supervisors.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 border rounded">
                <div><div className="font-medium">{a.agent_name}</div><div className="text-xs text-muted-foreground font-mono">Ext {a.agent_id} · pos {a.tier_position}</div></div>
                <Button size="sm" variant="ghost" onClick={() => removeAgent(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Agents</CardTitle><CardDescription>Tier 2 — handle queue calls</CardDescription></div>
          <AddAgentBtn extensions={availableExt} onAdd={(id) => addAgent(id, 'agent')} role="agent" />
        </CardHeader>
        <CardContent>
          {regularAgents.length === 0 ? <p className="text-sm text-muted-foreground">No agents yet.</p> : (
            <div className="space-y-1">{regularAgents.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 border rounded">
                <div><div className="font-medium">{a.agent_name}</div><div className="text-xs text-muted-foreground font-mono">Ext {a.agent_id} · {a.status}</div></div>
                <Button size="sm" variant="ghost" onClick={() => removeAgent(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AddAgentBtn({ extensions, onAdd, role }: { extensions: any[]; onAdd: (extId: string) => void; role: string }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState('');
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm"><UserPlus className="w-4 h-4 mr-1" /> Add</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add {role}</DialogTitle><DialogDescription>Pick an extension to assign to this queue.</DialogDescription></DialogHeader>
        <Select value={sel} onValueChange={setSel}>
          <SelectTrigger><SelectValue placeholder="Choose extension" /></SelectTrigger>
          <SelectContent>{extensions.map((e) => <SelectItem key={e.id} value={e.id}>{e.extension} — {e.display_name || '—'}</SelectItem>)}</SelectContent>
        </Select>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!sel} onClick={() => { onAdd(sel); setSel(''); setOpen(false); }}>Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------- Live stats ----------
function LiveStatsPanel() {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from('cc_queue_stats' as any).select('*').eq('organization_id', LEMTEL_ORG);
    setStats((data as any[]) || []); setLoading(false);
  };
  useEffect(() => { load(); const i = setInterval(load, 30_000); return () => clearInterval(i); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div><CardTitle>Live Queue Stats</CardTitle><CardDescription>Refreshes every 30s · synced from FusionPBX</CardDescription></div>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> :
          stats.length === 0 ? <p className="text-sm text-muted-foreground">No live stats yet — run a sync.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Queue</TableHead><TableHead>Waiting</TableHead><TableHead>Answered (today)</TableHead><TableHead>Abandoned</TableHead><TableHead>SLA</TableHead><TableHead>Agents</TableHead></TableRow></TableHeader>
            <TableBody>{stats.map((q) => (
              <TableRow key={q.id}>
                <TableCell className="font-medium">{q.queue_name}</TableCell>
                <TableCell><Badge variant={q.calls_waiting > 0 ? 'destructive' : 'outline'}>{q.calls_waiting}</Badge></TableCell>
                <TableCell>{q.calls_answered_today}</TableCell>
                <TableCell>{q.calls_abandoned_today}</TableCell>
                <TableCell>{q.service_level_percent}%</TableCell>
                <TableCell>{q.agents_available}/{q.agents_total}</TableCell>
              </TableRow>
            ))}</TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
