import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Key, Copy, Check, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface CreateKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (data: { name: string; scopes: string[]; expiresAt?: Date }) => Promise<{ key: string }>;
  availableScopes: string[];
  isLoading: boolean;
}

export const CreateKeyModal = ({ isOpen, onClose, onCreate, availableScopes, isLoading }: CreateKeyModalProps) => {
  const [name, setName] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<string[]>(['read:analytics', 'read:conversations']);
  const [expiresInDays, setExpiresInDays] = useState<string>('');
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const expiresAt = expiresInDays ? new Date(Date.now() + parseInt(expiresInDays) * 24 * 60 * 60 * 1000) : undefined;
    const result = await onCreate({ name, scopes: selectedScopes, expiresAt });
    setCreatedKey(result.key);
  };

  const handleCopy = async () => {
    if (createdKey) {
      await navigator.clipboard.writeText(createdKey);
      setCopied(true);
      toast({ title: 'Clé copiée dans le presse-papier' });
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedScopes(['read:analytics', 'read:conversations']);
    setExpiresInDays('');
    setCreatedKey(null);
    setCopied(false);
    onClose();
  };

  const toggleScope = (scope: string) => {
    setSelectedScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]
    );
  };

  if (createdKey) {
    return (
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-500">
              <Check className="h-5 w-5" />
              Clé API créée
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Copiez cette clé maintenant. Vous ne pourrez plus la voir après avoir fermé cette fenêtre.
              </AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <code className="flex-1 p-3 bg-muted rounded-lg text-sm font-mono break-all">
                {createdKey}
              </code>
              <Button onClick={handleCopy} variant="outline" size="icon">
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleClose}>Fermer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            Créer une clé API
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nom de la clé</Label>
            <Input
              id="name"
              placeholder="Ex: Production API"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Permissions</Label>
            <div className="grid grid-cols-2 gap-2 p-3 border rounded-lg">
              {availableScopes.map((scope) => (
                <div key={scope} className="flex items-center space-x-2">
                  <Checkbox
                    id={scope}
                    checked={selectedScopes.includes(scope)}
                    onCheckedChange={() => toggleScope(scope)}
                  />
                  <label
                    htmlFor={scope}
                    className="text-sm cursor-pointer"
                  >
                    {scope}
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="expires">Expiration (jours)</Label>
            <Input
              id="expires"
              type="number"
              placeholder="Laisser vide pour jamais"
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(e.target.value)}
              min="1"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose}>
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || !name || selectedScopes.length === 0}>
              {isLoading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Créer
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
