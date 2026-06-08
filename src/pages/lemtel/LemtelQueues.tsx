import { useEffect, useMemo, useRef, useState } from 'react';
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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Headphones, Plus, Loader2, Pencil, Trash2, Users, RefreshCw, Shield, UserPlus, Activity,
  Download, Upload, AlertTriangle, CheckCircle2, Clock, Lock,
} from 'lucide-react';
import { usePbxQueues, LEMTEL_ORG, usePbxSync, usePbxSyncJobs } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useCallCenterRole } from '@/hooks/useCallCenterRole';
import { formatDistanceToNow } from 'date-fns';
import { useLanguage } from '@/context/LanguageContext';

const STRATEGIES = ['ring-all', 'longest-idle-agent', 'round-robin', 'top-down', 'agent-with-least-talk-time', 'agent-with-fewest-calls', 'sequentially-by-agent-order', 'random'];
const qCopy = {
  en: { title: 'Call Center · Queues', subtitle: 'Manage queues, agents, supervisors and live activity — synced with FusionPBX.', empty: 'No queues yet — create one to start routing calls.', select: 'Select a queue to manage agents and supervisors.', noSup: 'No supervisors assigned — add one to monitor and manage this queue.', noAgents: 'No agents assigned — add extensions that should answer this queue.', readonly: 'Read-only view', create: 'New Queue' },
  fr: { title: 'Centre d’appel · Files', subtitle: 'Gérer les files, agents, superviseurs et activité live — synchronisé avec FusionPBX.', empty: 'Aucune file — créez-en une pour commencer le routage.', select: 'Sélectionnez une file pour gérer les agents et superviseurs.', noSup: 'Aucun superviseur assigné — ajoutez-en un pour gérer cette file.', noAgents: 'Aucun agent assigné — ajoutez les extensions qui doivent répondre.', readonly: 'Vue lecture seule', create: 'Nouvelle file' },
};

type Perms = { canManage: boolean; canAssign: boolean; reason: string };

function usePerms(): Perms {
  const { isAdmin, isSupervisor, loading } = useCallCenterRole();
  if (loading) return { canManage: false, canAssign: false, reason: 'loading' };
  return {
    canManage: isAdmin,
    canAssign: isAdmin || isSupervisor,
    reason: isAdmin ? 'admin' : isSupervisor ? 'supervisor' : 'agent',
  };
}

export default function LemtelQueues() {
  const { data: queues = [], isLoading } = usePbxQueues();
  const { language } = useLanguage();
  const txt = qCopy[language];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const perms = usePerms();
  const selected = (queues as any[]).find((q) => q.id === selectedId) || null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Headphones className="w-7 h-7" /> {txt.title}</h1>
          <p className="text-muted-foreground">{txt.subtitle}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <SyncStatusChip />
          <PbxRefreshButton kind="ivr-queues" />
          <CsvIO queues={queues as any[]} disabled={!perms.canManage} />
          {perms.canManage && <QueueDialog mode="create" trigger={<Button><Plus className="w-4 h-4 mr-2" /> {txt.create}</Button>} />}
        </div>
      </div>

      {!perms.canManage && (
        <Alert>
          <Lock className="w-4 h-4" />
          <AlertTitle>{txt.readonly} ({perms.reason})</AlertTitle>
          <AlertDescription>Only call-center admins can create or edit queues. Supervisors can assign agents.</AlertDescription>
        </Alert>
      )}

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
                            {perms.canManage && <QueueDialog mode="edit" queue={q} trigger={<Button size="sm" variant="ghost"><Pencil className="w-4 h-4" /></Button>} />}
                            {perms.canManage && <DeleteQueueBtn queue={q} />}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {queues.length === 0 && (
                      <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-10">{txt.empty}</TableCell></TableRow>
                    )}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="agents">
          {selected ? <QueueAgentsPanel queue={selected} perms={perms} txt={txt} /> : <Card><CardContent className="p-6 text-muted-foreground">{txt.select}</CardContent></Card>}
        </TabsContent>

        <TabsContent value="live"><LiveStatsPanel queues={queues as any[]} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ---------- Sync status chip ----------
function SyncStatusChip() {
  const { data: jobs = [] } = usePbxSyncJobs(5);
  const latest = jobs[0];
  if (!latest) return <Badge variant="outline"><Clock className="w-3 h-3 mr-1" /> No sync yet</Badge>;
  const when = latest.finished_at || latest.started_at;
  const ago = when ? formatDistanceToNow(new Date(when), { addSuffix: true }) : '';
  if (latest.status === 'error') {
    return (
      <Badge variant="destructive" title={latest.error || 'Sync failed'}>
        <AlertTriangle className="w-3 h-3 mr-1" /> Sync failed {ago}
      </Badge>
    );
  }
  if (latest.status === 'running') {
    return <Badge><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Syncing…</Badge>;
  }
  return <Badge variant="outline"><CheckCircle2 className="w-3 h-3 mr-1 text-green-600" /> Synced {ago}</Badge>;
}

// ---------- CSV import/export ----------
function CsvIO({ queues, disabled }: { queues: any[]; disabled: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const exportCsv = async () => {
    const { data: tiers = [] } = await supabase
      .from('pbx_queue_agents').select('queue_id, agent_id, agent_name, tier_level, tier_position')
      .in('queue_id', queues.map((q) => q.id));
    const rows: string[] = ['name,extension,strategy,max_wait_time,record_enabled,enabled,agents'];
    for (const q of queues) {
      const a = (tiers as any[]).filter((t) => t.queue_id === q.id)
        .map((t) => `${t.agent_id}:${t.tier_level === 1 ? 'sup' : 'agent'}:${t.tier_position}`).join('|');
      rows.push([q.name, q.extension || '', q.strategy, q.max_wait_time, q.record_enabled, q.enabled, a]
        .map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `queues-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const importCsv = async (file: File) => {
    setBusy(true);
    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(Boolean);
      const header = lines.shift()?.split(',').map((h) => h.replace(/"/g, '').trim()) || [];
      let created = 0, updated = 0, failed = 0;
      for (const line of lines) {
        const parts = line.match(/("([^"]|"")*"|[^,]+)/g)?.map((p) => p.replace(/^"|"$/g, '').replace(/""/g, '"')) || [];
        const row: any = {}; header.forEach((h, i) => { row[h] = parts[i]; });
        if (!row.name) continue;
        const existing = queues.find((q) => q.name === row.name);
        const action = existing ? 'update-queue' : 'create-queue';
        const params: any = {
          queue_name: row.name,
          queue_extension: row.extension || '',
          queue_strategy: row.strategy || 'ring-all',
          queue_max_wait_time: String(row.max_wait_time || 60),
          queue_enabled: row.enabled === 'true' || row.enabled === true ? 'true' : 'false',
          queue_record_template: row.record_enabled === 'true' ? '${strftime(%Y)}/${strftime(%b)}/${strftime(%d)}/${uuid}.${record_ext}' : '',
        };
        if (existing) params.call_center_queue_uuid = existing.pbx_uuid;
        try {
          const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
            body: { organization_id: LEMTEL_ORG, action, params },
          });
          if (error || data?.ok === false) throw new Error(data?.message || error?.message || 'failed');
          existing ? updated++ : created++;
        } catch { failed++; }
      }
      await supabase.functions.invoke('fusionpbx-proxy', { body: { organization_id: LEMTEL_ORG, action: 'sync-all', params: { resources: ['queues'] } } });
      qc.invalidateQueries({ queryKey: ['pbx'] });
      toast({ title: 'Import done', description: `${created} created · ${updated} updated · ${failed} failed` });
    } catch (e: any) {
      toast({ title: 'Import failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={exportCsv}><Download className="w-4 h-4 mr-1" /> Export CSV</Button>
      <Button variant="outline" size="sm" disabled={disabled || busy} onClick={() => fileRef.current?.click()}>
        {busy ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />} Import CSV
      </Button>
      <input ref={fileRef} type="file" accept=".csv" hidden onChange={(e) => e.target.files?.[0] && importCsv(e.target.files[0])} />
    </>
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
      const params: any = { ...form, queue_enabled: form.queue_enabled ? 'true' : 'false' };
      if (mode === 'edit') params.call_center_queue_uuid = queue.pbx_uuid;
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { organization_id: LEMTEL_ORG, action, params },
      });
      if (error) throw error;
      if (data?.ok === false) throw new Error(data?.message || 'FusionPBX error');
      toast({ title: mode === 'create' ? 'Queue created' : 'Queue updated' });
      await supabase.functions.invoke('fusionpbx-proxy', { body: { organization_id: LEMTEL_ORG, action: 'sync-all', params: { resources: ['queues'] } } });
      qc.invalidateQueries({ queryKey: ['pbx'] });
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
      qc.invalidateQueries({ queryKey: ['pbx'] });
    } catch (e: any) {
      toast({ title: 'Failed', description: e.message, variant: 'destructive' });
    } finally { setBusy(false); }
  };
  return <Button size="sm" variant="ghost" onClick={onClick} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4 text-destructive" />}</Button>;
}

// ---------- Agents per queue ----------
function QueueAgentsPanel({ queue, perms, txt }: { queue: any; perms: Perms; txt: typeof qCopy.en }) {
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
    if (!perms.canAssign) { toast({ title: 'Forbidden', description: 'Supervisor or admin required', variant: 'destructive' }); return; }
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
    if (!perms.canAssign) { toast({ title: 'Forbidden', variant: 'destructive' }); return; }
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
          {perms.canAssign && <AddAgentBtn extensions={availableExt} onAdd={(id) => addAgent(id, 'supervisor')} role="supervisor" />}
        </CardHeader>
        <CardContent>
          {supervisors.length === 0 ? <p className="text-sm text-muted-foreground">{txt.noSup}</p> : (
            <div className="space-y-1">{supervisors.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 border rounded">
                <div><div className="font-medium">{a.agent_name}</div><div className="text-xs text-muted-foreground font-mono">Ext {a.agent_id} · pos {a.tier_position}</div></div>
                {perms.canAssign && <Button size="sm" variant="ghost" onClick={() => removeAgent(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
              </div>
            ))}</div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle className="flex items-center gap-2"><Users className="w-4 h-4" /> Agents</CardTitle><CardDescription>Tier 2 — handle queue calls</CardDescription></div>
          {perms.canAssign && <AddAgentBtn extensions={availableExt} onAdd={(id) => addAgent(id, 'agent')} role="agent" />}
        </CardHeader>
        <CardContent>
          {regularAgents.length === 0 ? <p className="text-sm text-muted-foreground">{txt.noAgents}</p> : (
            <div className="space-y-1">{regularAgents.map((a) => (
              <div key={a.id} className="flex items-center justify-between p-2 border rounded">
                <div><div className="font-medium">{a.agent_name}</div><div className="text-xs text-muted-foreground font-mono">Ext {a.agent_id} · {a.status}</div></div>
                {perms.canAssign && <Button size="sm" variant="ghost" onClick={() => removeAgent(a)}><Trash2 className="w-4 h-4 text-destructive" /></Button>}
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
function LiveStatsPanel({ queues }: { queues: any[] }) {
  const [stats, setStats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [page, setPage] = useState(0);
  const sync = usePbxSync();
  const PAGE_SIZE = 15;

  const load = async () => {
    setLoading(true); setError(null);
    const { data, error } = await supabase.from('cc_queue_stats' as any).select('*').eq('organization_id', LEMTEL_ORG);
    if (error) setError(error.message);
    setStats((data as any[]) || []); setLoading(false);
  };
  useEffect(() => { load(); const i = setInterval(load, 30_000); return () => clearInterval(i); }, []);

  const filtered = useMemo(
    () => stats.filter((s) => !filter || (s.queue_name || '').toLowerCase().includes(filter.toLowerCase())),
    [stats, filter],
  );
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  // Aggregate KPIs
  const totals = useMemo(() => filtered.reduce((acc, s) => ({
    waiting: acc.waiting + (s.calls_waiting || 0),
    answered: acc.answered + (s.calls_answered_today || 0),
    abandoned: acc.abandoned + (s.calls_abandoned_today || 0),
    agents: acc.agents + (s.agents_total || 0),
    available: acc.available + (s.agents_available || 0),
    longest: Math.max(acc.longest, s.longest_wait_seconds || 0),
  }), { waiting: 0, answered: 0, abandoned: 0, agents: 0, available: 0, longest: 0 }), [filtered]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <Kpi label="Waiting" value={totals.waiting} highlight={totals.waiting > 0} />
        <Kpi label="Answered today" value={totals.answered} />
        <Kpi label="Abandoned" value={totals.abandoned} highlight={totals.abandoned > 0} />
        <Kpi label="Agents avail." value={`${totals.available}/${totals.agents}`} />
        <Kpi label="Longest wait" value={`${totals.longest}s`} />
        <Kpi label="Abandon rate" value={totals.answered + totals.abandoned > 0 ? `${Math.round((totals.abandoned / (totals.answered + totals.abandoned)) * 100)}%` : '—'} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 flex-wrap">
          <div><CardTitle>Live Queue Stats</CardTitle><CardDescription>Refreshes every 30s · synced from FusionPBX</CardDescription></div>
          <div className="flex gap-2 items-center">
            <Input placeholder="Filter queue…" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(0); }} className="w-48" />
            <Button size="sm" variant="outline" onClick={load}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
            <Button size="sm" onClick={() => sync.mutate({ kind: 'all', resources: ['queues', 'queue-agents'] })} disabled={sync.isPending}>
              {sync.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />} Full sync
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-3">
              <AlertTriangle className="w-4 h-4" />
              <AlertTitle>Sync error</AlertTitle>
              <AlertDescription className="font-mono text-xs">{error}</AlertDescription>
            </Alert>
          )}
          {loading ? <div className="flex justify-center py-8"><Loader2 className="animate-spin" /></div> :
            paged.length === 0 ? <p className="text-sm text-muted-foreground">No live stats yet — run a sync.</p> : (
            <>
              <Table>
                <TableHeader><TableRow>
                  <TableHead>Queue</TableHead><TableHead>Waiting</TableHead><TableHead>Longest wait</TableHead>
                  <TableHead>Answered</TableHead><TableHead>Abandoned</TableHead><TableHead>Avg handle</TableHead>
                  <TableHead>SLA</TableHead><TableHead>Agents avail/total</TableHead><TableHead>On call</TableHead><TableHead>Paused</TableHead>
                </TableRow></TableHeader>
                <TableBody>{paged.map((q) => (
                  <TableRow key={q.id}>
                    <TableCell className="font-medium">{q.queue_name}</TableCell>
                    <TableCell><Badge variant={q.calls_waiting > 0 ? 'destructive' : 'outline'}>{q.calls_waiting}</Badge></TableCell>
                    <TableCell>{q.longest_wait_seconds || 0}s</TableCell>
                    <TableCell>{q.calls_answered_today}</TableCell>
                    <TableCell>{q.calls_abandoned_today}</TableCell>
                    <TableCell>{q.avg_handle_time_seconds || 0}s</TableCell>
                    <TableCell>{q.service_level_percent}%</TableCell>
                    <TableCell>{q.agents_available}/{q.agents_total}</TableCell>
                    <TableCell>{q.agents_on_call || 0}</TableCell>
                    <TableCell>{q.agents_paused || 0}</TableCell>
                  </TableRow>
                ))}</TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-3 text-sm">
                  <span className="text-muted-foreground">Page {page + 1} of {totalPages} · {filtered.length} queues</span>
                  <div className="flex gap-1">
                    <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={page + 1 >= totalPages} onClick={() => setPage(page + 1)}>Next</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Kpi({ label, value, highlight }: { label: string; value: any; highlight?: boolean }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${highlight ? 'text-destructive' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
