import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

const LEMTEL_ORG = '71755d33-ed64-4ad5-a828-61c9d2029eb7';

export function ProvisionExtensionModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [extension, setExtension] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [voicemailPin, setVoicemailPin] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const reset = () => {
    setExtension(''); setDisplayName(''); setPassword(''); setVoicemailPin('');
  };

  const submit = async () => {
    if (!extension || !password) {
      toast.error('Extension number and SIP password are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke('fusionpbx-proxy', {
        body: {
          action: 'create-extension',
          organization_id: LEMTEL_ORG,
          params: {
            extension,
            password,
            effective_caller_id_name: displayName || extension,
            effective_caller_id_number: extension,
            voicemail_password: voicemailPin || undefined,
            enabled: 'true',
          },
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).message || (data as any).error);
      toast.success(`Extension ${extension} provisioned`);
      qc.invalidateQueries({ queryKey: ['pbx'] });
      reset();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || 'Failed to provision extension');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Provision New Extension</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ext">Extension number *</Label>
            <Input id="ext" placeholder="e.g. 230" value={extension} onChange={e => setExtension(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="name">Display name</Label>
            <Input id="name" placeholder="e.g. John Doe" value={displayName} onChange={e => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pwd">SIP password *</Label>
            <Input id="pwd" type="password" value={password} onChange={e => setPassword(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="vm">Voicemail PIN (optional)</Label>
            <Input id="vm" value={voicemailPin} onChange={e => setVoicemailPin(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Cancel</Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Create on FusionPBX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
