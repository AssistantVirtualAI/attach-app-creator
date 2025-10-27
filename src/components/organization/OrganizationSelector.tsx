import { useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOrganization } from '@/context/OrganizationContext';
import { cn } from '@/lib/utils';

export const OrganizationSelector = () => {
  const { organizations, selectedOrg, selectOrganization, createOrganization, isLoading } = useOrganization();
  const [open, setOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateOrganization = async () => {
    if (!newOrgName.trim()) return;

    setIsCreating(true);
    const org = await createOrganization({ name: newOrgName });
    setIsCreating(false);

    if (org) {
      setNewOrgName('');
      setDialogOpen(false);
      selectOrganization(org.id);
    }
  };

  if (isLoading) {
    return (
      <div className="px-4 py-2">
        <div className="h-10 bg-card/50 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="px-4 py-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-card/50 border-border/50 hover:bg-card/70"
          >
            <span className="truncate">
              {selectedOrg?.name || 'Sélectionner une organisation'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[240px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Rechercher..." />
            <CommandList>
              <CommandEmpty>Aucune organisation trouvée.</CommandEmpty>
              <CommandGroup>
                {organizations.map((org) => (
                  <CommandItem
                    key={org.id}
                    value={org.name}
                    onSelect={() => {
                      selectOrganization(org.id);
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        selectedOrg?.id === org.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {org.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setDialogOpen(true);
                      }}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Créer une organisation
                    </CommandItem>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Créer une nouvelle organisation</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div className="space-y-2">
                        <Label htmlFor="org-name">Nom de l'organisation</Label>
                        <Input
                          id="org-name"
                          placeholder="Mon entreprise"
                          value={newOrgName}
                          onChange={(e) => setNewOrgName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleCreateOrganization();
                            }
                          }}
                        />
                      </div>
                      <Button
                        onClick={handleCreateOrganization}
                        disabled={!newOrgName.trim() || isCreating}
                        className="w-full"
                      >
                        {isCreating ? 'Création...' : 'Créer'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
};
