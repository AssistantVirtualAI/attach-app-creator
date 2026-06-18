import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Loader2, Pencil, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { LEMTEL_ORG_ID } from '@/hooks/useLemtelAccess';

export type LiveExt = {
  extension_uuid?: string;
  extension: string;
  effective_caller_id_name?: string;
  enabled?: string | boolean;
  description?: string;
  voicemail_enabled?: string | boolean;
};
export type LiveState = { exts: LiveExt[]; error?: string };

export function ExtensionsPanel({
  domainUuid,
  domainName,
  organizationId,
  live,
  loading,
  onChanged,
}: {
  domainUuid: string;
  domainName: string;
  organizationId?: string;
  live: LiveState | undefined;
  loading: boolean;
  onChanged: () => void;
}) {
  const orgId = organizationId || LEMTEL_ORG_ID;
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<LiveExt | null>(null);
  const [editDesc, setEditDesc] = useState('');
  const [editCid, setEditCid] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState<null | 'enable' | 'disable' | 'reset-vm' | 'delete'>(null);
  const [retrying, setRetrying] = useState(false);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const [syncingNow, setSyncingNow] = useState(false);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!live?.error || retryAttempt >= 3) return;
    const delay = Math.min(2000 * Math.pow(2, retryAttempt), 15000);
    setRetrying(true);
    retryRef.current = setTimeout(() => {
      setRetryAttempt(a => a + 1);
      onChanged();
      setRetrying(false);
    }, delay);
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [live?.error, retryAttempt]);

  useEffect(() => { if (live && !live.error) setRetryAttempt(0); }, [live]);

  const syncNow = async () => {
    setSyncingNow(true);
    try {
      const { error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'sync-all', resources: ['extensions'], organization_id: orgId, domain_uuid: domainUuid },
      });
      if (error) throw error;
      toast.success(`Synced ${domainName}`);
      setRetryAttempt(0);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Sync failed');
    } finally {
      setSyncingNow(false);
    }
  };

  if (loading) {
    return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="w-3 h-3 animate-spin" /> Loading extensions from PBX…</div>;
  }
  if (live?.error) {
    return (
      <div className="text-xs text-destructive flex items-center gap-2 flex-wrap">
        <span>⚠ Could not fetch extensions: {live.error}</span>
        {retrying && <span className="text-muted-foreground">retrying… (attempt {retryAttempt + 1}/3)</span>}
        <Button size="sm" variant="outline" onClick={() => { setRetryAttempt(0); onChanged(); }}>Retry now</Button>
        <Button size="sm" variant="default" onClick={syncNow} disabled={syncingNow}>
          {syncingNow ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Sync now
        </Button>
      </div>
    );
  }
  const exts = live?.exts || [];
  if (!exts.length) {
    return (
      <div className="text-xs text-muted-foreground flex items-center gap-2">
        No extensions on this domain.
        <Button size="sm" variant="outline" onClick={syncNow} disabled={syncingNow}>
          {syncingNow ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />} Sync now
        </Button>
      </div>
    );
  }

  const callUpdate = async (ext: LiveExt, params: any) => {
    const { error } = await supabase.functions.invoke('pbx-write', {
      body: {
        organizationId: orgId,
        action: 'update-extension',
        params: { extension_uuid: ext.extension_uuid, domain_uuid: domainUuid, ...params },
      },
    });
    if (error) throw error;
  };

  const callDelete = async (ext: LiveExt) => {
    const { error } = await supabase.functions.invoke('pbx-write', {
      body: {
        organizationId: orgId,
        action: 'delete-extension',
        params: { extension_uuid: ext.extension_uuid, domain_uuid: domainUuid },
      },
    });
    if (error) throw error;
  };

  const doAction = async (ext: LiveExt, action: 'toggle' | 'reset-vm' | 'delete') => {
    if (!ext.extension_uuid) { toast.error('Missing extension UUID'); return; }
    if (action === 'delete' && !confirm(`Delete extension ${ext.extension}? This is permanent on the PBX.`)) return;
    setBusyId(ext.extension_uuid);
    try {
      if (action === 'toggle') {
        const isEn = ext.enabled === true || ext.enabled === 'true';
        await callUpdate(ext, { enabled: isEn ? 'false' : 'true' });
        toast.success('Extension updated');
      } else if (action === 'reset-vm') {
        await callUpdate(ext, { voicemail_password: String(ext.extension), voicemail_enabled: 'true' });
        toast.success(`Voicemail reset (PIN = ${ext.extension})`);
      } else {
        await callDelete(ext);
        toast.success(`Extension ${ext.extension} deleted`);
      }
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const runBulk = async (action: 'enable' | 'disable' | 'reset-vm' | 'delete') => {
    const targets = exts.filter(e => e.extension_uuid && selected.has(e.extension_uuid));
    if (!targets.length) return;
    if (action === 'reset-vm' && !confirm(`Reset voicemail PIN to extension number for ${targets.length} extension(s)?`)) return;
    if (action === 'delete' && !confirm(`Delete ${targets.length} extension(s)? This is permanent on the PBX.`)) return;
    setBulkBusy(action);
    let ok = 0, fail = 0;
    for (const ext of targets) {
      try {
        if (action === 'reset-vm') await callUpdate(ext, { voicemail_password: String(ext.extension), voicemail_enabled: 'true' });
        else if (action === 'delete') await callDelete(ext);
        else await callUpdate(ext, { enabled: action === 'enable' ? 'true' : 'false' });
        ok++;
      } catch { fail++; }
    }
    setBulkBusy(null);
    if (ok) toast.success(`${ok} extension(s) updated`);
    if (fail) toast.error(`${fail} extension(s) failed`);
    setSelected(new Set());
    onChanged();
  };

  const saveEdit = async () => {
    if (!editing?.extension_uuid) return;
    setEditSaving(true);
    try {
      await callUpdate(editing, { description: editDesc, effective_caller_id_name: editCid });
      toast.success('Extension saved');
      setEditing(null);
      onChanged();
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally {
      setEditSaving(false);
    }
  };

  const allIds = exts.map(e => e.extension_uuid).filter(Boolean) as string[];
  const allSelected = allIds.length > 0 && allIds.every(id => selected.has(id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(allIds));
  const toggleOne = (id?: string) => { if (!id) return; setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; }); };

  return (
    <>
      <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Select all" />
          <span>{exts.length} extension{exts.length === 1 ? '' : 's'} on <code>{domainName}</code>{selected.size > 0 ? ` — ${selected.size} selected` : ''}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" disabled={selected.size === 0 || !!bulkBusy} onClick={() => runBulk('enable')}>
            {bulkBusy === 'enable' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Enable
          </Button>
          <Button size="sm" variant="outline" disabled={selected.size === 0 || !!bulkBusy} onClick={() => runBulk('disable')}>
            {bulkBusy === 'disable' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Disable
          </Button>
          <Button size="sm" variant="outline" disabled={selected.size === 0 || !!bulkBusy} onClick={() => runBulk('reset-vm')}>
            {bulkBusy === 'reset-vm' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Reset VM
          </Button>
          <Button size="sm" variant="destructive" disabled={selected.size === 0 || !!bulkBusy} onClick={() => runBulk('delete')}>
            {bulkBusy === 'delete' && <Loader2 className="w-3 h-3 mr-1 animate-spin" />} Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={syncNow} disabled={syncingNow} title="Force PBX sync">
            {syncingNow ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
        {exts.map((e) => {
          const isEn = e.enabled === true || e.enabled === 'true';
          const busy = busyId === e.extension_uuid;
          const isSel = e.extension_uuid ? selected.has(e.extension_uuid) : false;
          return (
            <div key={e.extension_uuid || e.extension} className={`flex items-center justify-between gap-2 rounded-md border bg-background px-2 py-1.5 ${isSel ? 'ring-1 ring-primary' : ''}`}>
              <div className="flex items-center gap-2 min-w-0">
                <Checkbox checked={isSel} onCheckedChange={() => toggleOne(e.extension_uuid)} aria-label={`Select ${e.extension}`} />
                <div className="min-w-0">
                  <div className="font-mono text-sm">{e.extension}</div>
                  <div className="text-xs text-muted-foreground truncate">{e.effective_caller_id_name || e.description || '—'}</div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Badge variant={isEn ? 'default' : 'secondary'} className="text-[10px]">{isEn ? 'on' : 'off'}</Badge>
                <Button size="sm" variant="ghost" title="Edit" onClick={() => { setEditing(e); setEditDesc(e.description || ''); setEditCid(e.effective_caller_id_name || ''); }}>
                  <Pencil className="w-3 h-3" />
                </Button>
                <Button size="sm" variant="ghost" title={isEn ? 'Disable' : 'Enable'} disabled={busy} onClick={() => doAction(e, 'toggle')}>
                  {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : isEn ? '⏻' : '✓'}
                </Button>
                <Button size="sm" variant="ghost" title="Reset voicemail PIN to extension number" disabled={busy} onClick={() => doAction(e, 'reset-vm')}>
                  VM
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit extension {editing?.extension}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Caller ID name</Label><Input value={editCid} onChange={(e) => setEditCid(e.target.value)} /></div>
            <div><Label>Description</Label><Input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editSaving}>
              {editSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
