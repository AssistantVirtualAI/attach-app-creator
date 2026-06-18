import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Trash2, Loader2, Pencil, X, Check } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type DestType = 'extension' | 'ringgroup' | 'queue' | 'voicemail' | 'menu-top';

export function IvrOptionsDialog({
  open, onOpenChange, ivr, domainUuid, domainName, extensions, ringGroups, queues,
}: {
  open: boolean; onOpenChange: (o: boolean) => void;
  ivr: any | null; domainUuid: string; domainName: string;
  extensions: any[]; ringGroups: any[]; queues: any[];
}) {
  const qc = useQueryClient();
  const menuUuid = ivr?.ivr_menu_uuid;
  const queryKey = ['fpbx', 'ivr-options', menuUuid];

  const { data: options = [], isLoading, refetch } = useQuery({
    queryKey,
    enabled: open && !!menuUuid,
    queryFn: async () => {
      const { data } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'list-ivr-options-for-menu', ivr_menu_uuid: menuUuid, domain_uuid: domainUuid },
      });
      return (data as any)?.data || [];
    },
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ digit: string; label: string; destType: DestType; destValue: string }>({ digit: '', label: '', destType: 'extension', destValue: '' });
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);

  const paramFor = (t: DestType, v: string) => {
    if (t === 'voicemail') return `transfer *99${v} XML ${domainName}`;
    if (t === 'menu-top') return 'menu-top';
    return `transfer ${v} XML ${domainName}`;
  };
  const actionFor = (t: DestType) => (t === 'menu-top' ? 'menu-top' : 'menu-exec-app');

  // Reverse parse existing option (action + param) into destType/destValue
  const parseOption = (o: any): { destType: DestType; destValue: string } => {
    const a = o.ivr_menu_option_action || '';
    const p = String(o.ivr_menu_option_param || '');
    if (a === 'menu-top') return { destType: 'menu-top', destValue: '' };
    const m = p.match(/transfer\s+(\*?\d+)/);
    const n = m?.[1] || '';
    if (n.startsWith('*99')) return { destType: 'voicemail', destValue: n.slice(3) };
    if (ringGroups.find((r: any) => r.ring_group_extension === n)) return { destType: 'ringgroup', destValue: n };
    if (queues.find((q: any) => q.queue_extension === n)) return { destType: 'queue', destValue: n };
    return { destType: 'extension', destValue: n };
  };

  const startEdit = (o: any) => {
    const { destType, destValue } = parseOption(o);
    setEditId(o.ivr_menu_option_uuid);
    setDraft({ digit: o.ivr_menu_option_digits || '', label: o.ivr_menu_option_description || '', destType, destValue });
    setAdding(false);
  };

  const startAdd = () => {
    setEditId(null); setAdding(true);
    setDraft({ digit: String(options.length + 1), label: '', destType: 'extension', destValue: '' });
  };

  const cancel = () => { setEditId(null); setAdding(false); };

  const save = async () => {
    if (!draft.digit || (draft.destType !== 'menu-top' && !draft.destValue)) {
      toast.error('Digit + destination required'); return;
    }
    setBusy(true);
    try {
      const body: any = {
        action: editId ? 'update-ivr-option' : 'create-ivr-option',
        domain_uuid: domainUuid,
        ivr_menu_uuid: menuUuid,
        ivr_menu_option_digits: draft.digit,
        ivr_menu_option_action: actionFor(draft.destType),
        ivr_menu_option_param: paramFor(draft.destType, draft.destValue),
        ivr_menu_option_description: draft.label,
        ivr_menu_option_enabled: 'true',
      };
      if (editId) body.ivr_menu_option_uuid = editId;
      const { error } = await supabase.functions.invoke('fusionpbx-proxy', { body });
      if (error) throw error;
      toast.success(editId ? 'Option updated' : 'Option added');
      cancel();
      await refetch();
      qc.invalidateQueries({ queryKey: ['fpbx', 'ivrs'] });
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const del = async (o: any) => {
    if (!confirm(`Delete option "${o.ivr_menu_option_digits}"?`)) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: { action: 'delete-ivr-option', domain_uuid: domainUuid, ivr_menu_option_uuid: o.ivr_menu_option_uuid },
      });
      if (error) throw error;
      toast.success('Option deleted');
      await refetch();
    } catch (e: any) { toast.error(e?.message || 'Failed'); }
    finally { setBusy(false); }
  };

  const DestSelect = ({ t, v, onT, onV }: any) => (
    <div className="grid grid-cols-2 gap-1">
      <Select value={t} onValueChange={onT}>
        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="extension">Extension</SelectItem>
          <SelectItem value="ringgroup">Ring Group</SelectItem>
          <SelectItem value="queue">Queue</SelectItem>
          <SelectItem value="voicemail">Voicemail</SelectItem>
          <SelectItem value="menu-top">Repeat menu</SelectItem>
        </SelectContent>
      </Select>
      {t === 'extension' ? (
        <Select value={v} onValueChange={onV}>
          <SelectTrigger className="h-8"><SelectValue placeholder="…" /></SelectTrigger>
          <SelectContent>{extensions.map((e: any) => (
            <SelectItem key={e.extension_uuid || e.extension} value={e.extension}>{e.extension}{e.effective_caller_id_name ? ` · ${e.effective_caller_id_name}` : ''}</SelectItem>
          ))}</SelectContent>
        </Select>
      ) : t === 'ringgroup' ? (
        <Select value={v} onValueChange={onV}>
          <SelectTrigger className="h-8"><SelectValue placeholder="…" /></SelectTrigger>
          <SelectContent>{ringGroups.map((r: any) => (
            <SelectItem key={r.ring_group_uuid} value={r.ring_group_extension}>{r.ring_group_extension} · {r.ring_group_name}</SelectItem>
          ))}</SelectContent>
        </Select>
      ) : t === 'queue' ? (
        <Select value={v} onValueChange={onV}>
          <SelectTrigger className="h-8"><SelectValue placeholder="…" /></SelectTrigger>
          <SelectContent>{queues.map((q: any) => (
            <SelectItem key={q.call_center_queue_uuid || q.queue_uuid} value={q.queue_extension}>{q.queue_extension} · {q.queue_name}</SelectItem>
          ))}</SelectContent>
        </Select>
      ) : t === 'voicemail' ? (
        <Input className="h-8" placeholder="ext #" value={v} onChange={e => onV(e.target.value)} />
      ) : <Input className="h-8" disabled value="—" />}
    </div>
  );

  const renderRow = (o: any) => {
    const isEdit = editId === o.ivr_menu_option_uuid;
    const { destType, destValue } = parseOption(o);
    if (isEdit) {
      return (
        <div key={o.ivr_menu_option_uuid} className="border rounded p-2 space-y-2 bg-muted/30">
          <div className="grid grid-cols-[60px_1fr_auto] gap-2 items-end">
            <div><Label className="text-xs">Digit</Label><Input className="h-8" value={draft.digit} onChange={e => setDraft({ ...draft, digit: e.target.value })} /></div>
            <div><Label className="text-xs">Label</Label><Input className="h-8" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} /></div>
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" onClick={cancel} disabled={busy}><X className="w-4 h-4" /></Button>
              <Button size="icon" onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</Button>
            </div>
          </div>
          <DestSelect t={draft.destType} v={draft.destValue}
            onT={(t: DestType) => setDraft({ ...draft, destType: t, destValue: '' })}
            onV={(v: string) => setDraft({ ...draft, destValue: v })} />
        </div>
      );
    }
    return (
      <div key={o.ivr_menu_option_uuid} className="flex items-center gap-3 border rounded p-2">
        <Badge variant="outline" className="font-mono text-base px-3">{o.ivr_menu_option_digits}</Badge>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{o.ivr_menu_option_description || <span className="text-muted-foreground italic">No label</span>}</div>
          <div className="text-xs text-muted-foreground capitalize">{destType}{destValue ? ` · ${destValue}` : ''}</div>
        </div>
        <Button size="icon" variant="ghost" onClick={() => startEdit(o)} disabled={busy}><Pencil className="w-3 h-3" /></Button>
        <Button size="icon" variant="ghost" onClick={() => del(o)} disabled={busy}><Trash2 className="w-3 h-3" /></Button>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Options · {ivr?.ivr_menu_name || ''} <span className="text-muted-foreground font-normal text-sm">(ext {ivr?.ivr_menu_extension})</span></DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
          ) : (
            <>
              {options.length === 0 && !adding && (
                <p className="text-sm text-muted-foreground text-center py-4">No options yet.</p>
              )}
              {options.map(renderRow)}
              {adding && (
                <div className="border rounded p-2 space-y-2 bg-muted/30 border-primary/40">
                  <div className="grid grid-cols-[60px_1fr_auto] gap-2 items-end">
                    <div><Label className="text-xs">Digit</Label><Input className="h-8" value={draft.digit} onChange={e => setDraft({ ...draft, digit: e.target.value })} /></div>
                    <div><Label className="text-xs">Label</Label><Input className="h-8" value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} /></div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" onClick={cancel} disabled={busy}><X className="w-4 h-4" /></Button>
                      <Button size="icon" onClick={save} disabled={busy}>{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}</Button>
                    </div>
                  </div>
                  <DestSelect t={draft.destType} v={draft.destValue}
                    onT={(t: DestType) => setDraft({ ...draft, destType: t, destValue: '' })}
                    onV={(v: string) => setDraft({ ...draft, destValue: v })} />
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="flex items-center justify-between sm:justify-between">
          <Button size="sm" variant="outline" onClick={startAdd} disabled={adding || !!editId}>
            <Plus className="w-3 h-3 mr-1" /> Add option
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
