import { useState, useEffect } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { toast } from 'sonner';
import { Users, Plus, Edit, Trash2, Key, Loader2, UserPlus, Shield, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  login_id: string | null;
  status: string;
  created_at: string;
  last_login_at: string | null;
}

const PortalMembers = () => {
  const { session, hasEditAccess } = usePortal();
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Add member modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addEmail, setAddEmail] = useState('');
  const [addLoginId, setAddLoginId] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [addRole, setAddRole] = useState('member');
  const [isAdding, setIsAdding] = useState(false);
  const [showAddPassword, setShowAddPassword] = useState(false);
  
  // Edit member modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  
  // Reset password modal
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetMemberId, setResetMemberId] = useState('');
  const [resetMemberName, setResetMemberName] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  
  // Delete confirmation
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deletingMember, setDeletingMember] = useState<Member | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (session && hasEditAccess()) {
      fetchMembers();
    }
  }, [session]);

  const fetchMembers = async () => {
    if (!session) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'get-members',
          client_id: session.clientId,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      setMembers(data?.members || []);
    } catch (error) {
      console.error('Error fetching members:', error);
      toast.error('Erreur lors du chargement des membres');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!session) return;
    
    setIsAdding(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'admin-add-member',
          client_id: session.clientId,
          name: addName,
          email: addEmail,
          login_id: addLoginId,
          password: addPassword,
          role: addRole,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('Membre ajouté avec succès');
      setShowAddModal(false);
      resetAddForm();
      fetchMembers();
    } catch (error: any) {
      console.error('Error adding member:', error);
      toast.error(error.message || 'Erreur lors de l\'ajout');
    } finally {
      setIsAdding(false);
    }
  };

  const handleEditMember = async () => {
    if (!editingMember) return;
    
    setIsEditing(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'admin-update-member',
          member_id: editingMember.id,
          name: editName,
          email: editEmail,
          role: editRole,
          status: editStatus,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('Membre mis à jour');
      setShowEditModal(false);
      setEditingMember(null);
      fetchMembers();
    } catch (error: any) {
      console.error('Error updating member:', error);
      toast.error(error.message || 'Erreur lors de la mise à jour');
    } finally {
      setIsEditing(false);
    }
  };

  const handleResetPassword = async () => {
    setIsResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'admin-reset-member-password',
          member_id: resetMemberId,
          new_password: resetPassword,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('Mot de passe réinitialisé');
      setShowResetModal(false);
      setResetPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast.error(error.message || 'Erreur lors de la réinitialisation');
    } finally {
      setIsResetting(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deletingMember) return;
    
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('client-auth', {
        body: {
          action: 'admin-delete-member',
          member_id: deletingMember.id,
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      
      toast.success('Membre supprimé');
      setShowDeleteDialog(false);
      setDeletingMember(null);
      fetchMembers();
    } catch (error: any) {
      console.error('Error deleting member:', error);
      toast.error(error.message || 'Erreur lors de la suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  const resetAddForm = () => {
    setAddName('');
    setAddEmail('');
    setAddLoginId('');
    setAddPassword('');
    setAddRole('member');
  };

  const openEditModal = (member: Member) => {
    setEditingMember(member);
    setEditName(member.name);
    setEditEmail(member.email);
    setEditRole(member.role);
    setEditStatus(member.status);
    setShowEditModal(true);
  };

  const openResetModal = (member: Member) => {
    setResetMemberId(member.id);
    setResetMemberName(member.name);
    setResetPassword('');
    setShowResetModal(true);
  };

  if (!hasEditAccess()) {
    return (
      <div className="flex items-center justify-center h-64">
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-center text-destructive">
              Vous n'avez pas accès à cette fonctionnalité
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalPageHeader
        icon={Users}
        title="Gestion des membres"
        description="Gérez les utilisateurs ayant accès au portail"
        actions={
          <Button onClick={() => setShowAddModal(true)} className="gap-2">
            <UserPlus className="h-4 w-4" />
            Ajouter un membre
          </Button>
        }
      />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              Membres ({members.length})
            </CardTitle>
            <CardDescription>
              Les membres peuvent accéder au portail avec leurs propres identifiants
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Aucun membre ajouté</p>
                <Button 
                  variant="outline" 
                  className="mt-4 gap-2"
                  onClick={() => setShowAddModal(true)}
                >
                  <Plus className="h-4 w-4" />
                  Ajouter le premier membre
                </Button>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nom</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Login ID</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Dernière connexion</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">{member.name}</TableCell>
                      <TableCell>{member.email}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-2 py-1 rounded">
                          {member.login_id || '-'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <GlowBadge variant={member.role === 'admin' ? 'warning' : 'secondary'}>
                          {member.role === 'admin' ? 'Admin' : 'Membre'}
                        </GlowBadge>
                      </TableCell>
                      <TableCell>
                        {member.status === 'active' ? (
                          <span className="flex items-center gap-1 text-green-500">
                            <CheckCircle className="h-4 w-4" />
                            Actif
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-red-500">
                            <XCircle className="h-4 w-4" />
                            Inactif
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {member.last_login_at 
                          ? new Date(member.last_login_at).toLocaleDateString('fr-FR')
                          : 'Jamais'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(member)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openResetModal(member)}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            onClick={() => {
                              setDeletingMember(member);
                              setShowDeleteDialog(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Add Member Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un membre</DialogTitle>
            <DialogDescription>
              Créez un nouveau compte membre pour accéder au portail
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom *</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="Jean Dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>Email *</Label>
              <Input
                type="email"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                placeholder="jean@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label>Identifiant de connexion *</Label>
              <Input
                value={addLoginId}
                onChange={(e) => setAddLoginId(e.target.value)}
                placeholder="jean.dupont"
              />
            </div>
            <div className="space-y-2">
              <Label>Mot de passe * (min. 8 caractères)</Label>
              <div className="relative">
                <Input
                  type={showAddPassword ? 'text' : 'password'}
                  value={addPassword}
                  onChange={(e) => setAddPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowAddPassword(!showAddPassword)}
                >
                  {showAddPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={addRole} onValueChange={setAddRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre (lecture seule)</SelectItem>
                  <SelectItem value="admin">Admin (gestion complète)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleAddMember} 
              disabled={isAdding || !addName || !addEmail || !addLoginId || addPassword.length < 8}
            >
              {isAdding && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le membre</DialogTitle>
            <DialogDescription>
              Modifiez les informations de {editingMember?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nom</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Rôle</Label>
              <Select value={editRole} onValueChange={setEditRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Membre</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Statut</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Actif</SelectItem>
                  <SelectItem value="inactive">Inactif</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Annuler
            </Button>
            <Button onClick={handleEditMember} disabled={isEditing}>
              {isEditing && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Enregistrer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Password Modal */}
      <Dialog open={showResetModal} onOpenChange={setShowResetModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Réinitialiser le mot de passe</DialogTitle>
            <DialogDescription>
              Définir un nouveau mot de passe pour {resetMemberName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nouveau mot de passe (min. 8 caractères)</Label>
              <div className="relative">
                <Input
                  type={showResetPassword ? 'text' : 'password'}
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="••••••••"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowResetPassword(!showResetPassword)}
                >
                  {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowResetModal(false)}>
              Annuler
            </Button>
            <Button 
              onClick={handleResetPassword} 
              disabled={isResetting || resetPassword.length < 8}
            >
              {isResetting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Réinitialiser
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer le membre ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer {deletingMember?.name} ? 
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PortalMembers;
