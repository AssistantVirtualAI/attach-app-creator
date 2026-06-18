import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type FieldKind = 'text' | 'textarea' | 'bool' | 'number';

const HIDDEN = new Set([
  'insert_date', 'insert_user', 'update_date', 'update_user',
  'domain_uuid', 'domain_name',
]);

function inferKind(key: string, value: any): FieldKind {
  if (value === true || value === false || value === 'true' || value === 'false') return 'bool';
  if (typeof value === 'number') return 'number';
  if (key.includes('description') || key.includes('greet') || key.includes('xml')) return 'textarea';
  return 'text';
}

function normalize(v: any): string {
  if (v === null || v === undefined) return '';
  if (v === true || v === 'true') return 'true';
  if (v === false || v === 'false') return 'false';
  return String(v);
}

export function PbxRowEditDialog({
  open, onOpenChange, title, row, idKey, idValue, updateAction, organizationId, domainUuid, onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  row: any | null;
  idKey: string;            // e.g. 'queue_uuid'
  idValue: string | undefined;
  updateAction: string;     // e.g. 'update-queue'
  organizationId?: string;
  domainUuid: string;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const keys = useMemo(() => {
    if (!row) return [];
    return Object.keys(row).filter((k) => !HIDDEN.has(k) && k !== idKey && typeof row[k] !== 'object');
  }, [row, idKey]);

  useEffect(() => {
    if (!open || !row) return;
    const init: Record<string, string> = {};
    keys.forEach((k) => { init[k] = normalize(row[k]); });
    setDraft(init);
  }, [open, row, keys.join(',')]);

  if (!row) return null;

  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!idValue) { toast.error('Missing record id'); return; }
    setSaving(true);
    try {
      const patch: Record<string, string> = {};
      keys.forEach((k) => {
        const next = draft[k] ?? '';
        const prev = normalize(row[k]);
        if (next !== prev) patch[k] = next;
      });
      if (Object.keys(patch).length === 0) { toast.message('No changes'); onOpenChange(false); return; }
      const { error } = await supabase.functions.invoke('pbx-write', {
        body: {
          organizationId,
          action: updateAction,
          params: { [idKey]: idValue, domain_uuid: domainUuid, ...patch },
        },
      });
      if (error) throw error;
      toast.success('Saved & synced to FusionPBX');
      onSaved();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">All FusionPBX fields for this record. Empty fields are sent as blank to clear them.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
          {keys.map((k) => {
            const kind = inferKind(k, row[k]);
            const label = k.replace(/_/g, ' ');
            const v = draft[k] ?? '';
            if (kind === 'bool') {
              return (
                <div key={k} className="flex items-center justify-between border rounded p-2 col-span-1">
                  <Label className="text-xs">{label}</Label>
                  <Switch checked={v === 'true'} onCheckedChange={(b) => set(k, b ? 'true' : 'false')} />
                </div>
              );
            }
            if (kind === 'textarea') {
              return (
                <div key={k} className="col-span-2">
                  <Label className="text-xs">{label}</Label>
                  <Textarea value={v} onChange={(e) => set(k, e.target.value)} rows={3} className="text-xs" />
                </div>
              );
            }
            return (
              <div key={k}>
                <Label className="text-xs">{label}</Label>
                <Input value={v} onChange={(e) => set(k, e.target.value)} className="h-8 text-xs"
                  type={kind === 'number' ? 'number' : 'text'} />
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
