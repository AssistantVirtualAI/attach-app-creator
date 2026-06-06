import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export function OrderDIDModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [areaCode, setAreaCode] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [notes, setNotes] = useState('');

  const submit = () => {
    const subject = encodeURIComponent(`DID Order — Area code ${areaCode || 'any'} (${quantity})`);
    const body = encodeURIComponent(
      `Hello,\n\nPlease provision ${quantity} new DID(s) in area code ${areaCode || 'any'}.\n\nNotes:\n${notes || '(none)'}\n\nThanks.`
    );
    window.open(`mailto:support@avastatistic.ca?subject=${subject}&body=${body}`, '_blank');
    toast.success('Order request opened in your email client');
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Order a new DID</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            DID provisioning is performed by our telecom team. Submit your request and we'll provision it on FusionPBX within 1 business day.
          </p>
          <div className="space-y-2">
            <Label htmlFor="ac">Preferred area code</Label>
            <Input id="ac" placeholder="e.g. 514, 438, 450" value={areaCode} onChange={e => setAreaCode(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qty">Quantity</Label>
            <Input id="qty" type="number" min={1} value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" placeholder="Routing, SMS needed, customer name, etc." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={submit}>Send Order Request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
