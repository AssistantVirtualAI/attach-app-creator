import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, KeyRound, Trash2, Plus, UserCog } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/context/OrganizationContext';
import { TeamMember } from '@/hooks/useTeamMembers';

type Role = 'org_admin' | 'manager' | 'agent' | 'viewer';

interface UserOrg {
  id: string;
  name: string;
  slug: string;
  role: Role;
}

interface MemberDetailDialogProps {
  member: TeamMember | null;
  isOpen: boolean;
  onClose: () => void;
}

export function MemberDetailDialog({ member, isOpen, onClose }: MemberDetailDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { selectedOrgId, organizations, isSuperAdmin } = useOrganization();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('viewer');
  const [newPassword, setNewPassword] = useState('');
  const [addOrgId, setAddOrgId] = useState<string>('');
  const [addRole, setAddRole] = useState<Role>('viewer');

  useEffect(() => {
    if (!member) return;
    setFullName(member.profile?.full_name || '');
    setEmail(member.profile?.email || '');
    setRole((member.role?.role as Role) || 'viewer');
    setNewPassword('');
    setAddOrgId('');
    setAddRole('viewer');
  }, [member]);

  // Load all orgs the target user belongs to
  const userOrgsQuery = useQuery({
    queryKey: ['member-user-orgs', member?.user_id],
    enabled: !!member?.user_id && isOpen,
    queryFn: async (): Promise<UserOrg[]> => {
      const { data, error } = await supabase.functions.invoke('manage-org-roles', {
        body: { action: 'list_user_orgs', user_id: member!.user_id },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      return data?.organizations || [];
    },
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['team-members'] });
    queryClient.invalidateQueries({ queryKey: ['member-user-orgs', member?.user_id] });
  };

  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!member || !selectedOrgId) throw new Error('Membre invalide');
      const { data, error } = await supabase.functions.invoke('manage-org-roles', {
        body: {
          action: 'update_profile',
          organization_id: selectedOrgId,
          user_id: member.user_id,
          full_name: fullName,
          email,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Profil mis à jour' });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const updateRole = useMutation({
    mutationFn: async (newRole: Role) => {
      if (!member || !selectedOrgId) throw new Error('Membre invalide');
      const { data, error } = await supabase.functions.invoke('manage-org-roles', {
        body: {
          action: 'update_role',
          organization_id: selectedOrgId,
          user_id: member.user_id,
          new_role: newRole,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Rôle mis à jour' });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const resetPassword = useMutation({
    mutationFn: async () => {
      if (!member || !selectedOrgId) throw new Error('Membre invalide');
      if (newPassword.length < 8) throw new Error('8 caractères minimum');
      const { data, error } = await supabase.functions.invoke('manage-org-roles', {
        body: {
          action: 'reset_password',
          organization_id: selectedOrgId,
          user_id: member.user_id,
          new_password: newPassword,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Mot de passe réinitialisé' });
      setNewPassword('');
    },
    onError: (e: Error) =>
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const addToOrg = useMutation({
    mutationFn: async () => {
      if (!member || !addOrgId) throw new Error('Sélectionnez une organisation');
      const { data, error } = await supabase.functions.invoke('manage-org-roles', {
        body: {
          action: 'add_to_org',
          organization_id: addOrgId,
          user_id: member.user_id,
          role: addRole,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Ajouté à l\'organisation' });
      setAddOrgId('');
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const removeFromOrg = useMutation({
    mutationFn: async (orgId: string) => {
      if (!member) throw new Error('Membre invalide');
      const { data, error } = await supabase.functions.invoke('manage-org-roles', {
        body: {
          action: 'remove_from_org',
          organization_id: orgId,
          user_id: member.user_id,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
    },
    onSuccess: () => {
      toast({ title: 'Retiré de l\'organisation' });
      invalidate();
    },
    onError: (e: Error) =>
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' }),
  });

  const currentOrgIds = new Set((userOrgsQuery.data || []).map((o) => o.id));
  const addableOrgs = organizations.filter((o) => !currentOrgIds.has(o.id));

  if (!member) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserCog className="h-5 w-5 text-primary" />
            Détails du membre
          </DialogTitle>
          <DialogDescription>
            Modifier les informations, le mot de passe et les organisations.
          </DialogDescription>
        </DialogHeader>

        {/* Profile */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label>Nom complet</Label>
            <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <Button
            onClick={() => updateProfile.mutate()}
            disabled={updateProfile.isPending}
            className="w-full"
          >
            {updateProfile.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer le profil
          </Button>
        </div>

        <Separator />

        {/* Role in current org */}
        <div className="space-y-2">
          <Label>Rôle dans l'organisation actuelle</Label>
          <div className="flex gap-2">
            <Select
              value={role}
              onValueChange={(v) => {
                setRole(v as Role);
                updateRole.mutate(v as Role);
              }}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="org_admin">Admin</SelectItem>
                <SelectItem value="manager">Manager</SelectItem>
                <SelectItem value="agent">Agent</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            {updateRole.isPending && (
              <Loader2 className="h-4 w-4 animate-spin self-center" />
            )}
          </div>
        </div>

        <Separator />

        {/* Reset password */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <KeyRound className="h-4 w-4" /> Réinitialiser le mot de passe
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              placeholder="Nouveau mot de passe (8+ caractères)"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <Button
              onClick={() => resetPassword.mutate()}
              disabled={resetPassword.isPending || newPassword.length < 8}
            >
              {resetPassword.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Définir
            </Button>
          </div>
        </div>

        <Separator />

        {/* Organizations */}
        <div className="space-y-3">
          <Label>Organisations</Label>
          {userOrgsQuery.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="space-y-2">
              {(userOrgsQuery.data || []).map((o) => (
                <div
                  key={o.id}
                  className="flex items-center justify-between rounded-md border border-border p-2"
                >
                  <div>
                    <p className="text-sm font-medium">{o.name}</p>
                    <Badge variant="secondary" className="text-xs mt-1">{o.role}</Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeFromOrg.mutate(o.id)}
                    disabled={removeFromOrg.isPending}
                    title="Retirer de cette organisation"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
              {(userOrgsQuery.data || []).length === 0 && (
                <p className="text-sm text-muted-foreground">Aucune organisation</p>
              )}
            </div>
          )}

          {addableOrgs.length > 0 && (
            <div className="space-y-2 rounded-md bg-muted/30 p-3">
              <Label className="text-xs">Ajouter à une organisation</Label>
              <div className="flex gap-2">
                <Select value={addOrgId} onValueChange={setAddOrgId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Choisir une organisation" />
                  </SelectTrigger>
                  <SelectContent>
                    {addableOrgs.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={addRole} onValueChange={(v) => setAddRole(v as Role)}>
                  <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="org_admin">Admin</SelectItem>
                    <SelectItem value="manager">Manager</SelectItem>
                    <SelectItem value="agent">Agent</SelectItem>
                    <SelectItem value="viewer">Viewer</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  size="icon"
                  onClick={() => addToOrg.mutate()}
                  disabled={!addOrgId || addToOrg.isPending}
                >
                  {addToOrg.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                </Button>
              </div>
              {!isSuperAdmin && (
                <p className="text-[11px] text-muted-foreground">
                  Vous ne pouvez ajouter ce membre qu'aux organisations où vous êtes admin.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
