import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, UserPlus } from 'lucide-react';

interface InviteMemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  onInvite: (email: string, role: 'org_admin' | 'manager' | 'agent' | 'viewer') => Promise<void>;
  isLoading: boolean;
}

export const InviteMemberModal = ({ isOpen, onClose, onInvite, isLoading }: InviteMemberModalProps) => {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'org_admin' | 'manager' | 'agent' | 'viewer'>('agent');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onInvite(email, role);
    setEmail('');
    setRole('agent');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" />
            Inviter un membre
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Adresse email</Label>
            <Input
              id="email"
              type="email"
              placeholder="membre@exemple.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <p className="text-xs text-muted-foreground">
              L'utilisateur doit avoir un compte existant
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="role">Rôle</Label>
            <Select value={role} onValueChange={(v) => setRole(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org_admin">
                  <div>
                    <p className="font-medium">Admin</p>
                    <p className="text-xs text-muted-foreground">Accès complet à l'organisation</p>
                  </div>
                </SelectItem>
                <SelectItem value="manager">
                  <div>
                    <p className="font-medium">Manager</p>
                    <p className="text-xs text-muted-foreground">Gestion des agents et conversations</p>
                  </div>
                </SelectItem>
                <SelectItem value="agent">
                  <div>
                    <p className="font-medium">Agent</p>
                    <p className="text-xs text-muted-foreground">Voir et gérer les conversations</p>
                  </div>
                </SelectItem>
                <SelectItem value="viewer">
                  <div>
                    <p className="font-medium">Viewer</p>
                    <p className="text-xs text-muted-foreground">Lecture seule</p>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !email}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Inviter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
