import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ClientAvatar } from "./ClientAvatar";
import { toast } from "sonner";

interface ClientMembersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: string;
  clientName: string;
}

export const ClientMembersModal = ({
  open,
  onOpenChange,
  clientId,
  clientName,
}: ClientMembersModalProps) => {
  const queryClient = useQueryClient();
  const [newMember, setNewMember] = useState({ email: "", name: "", role: "member" });

  const { data: members, isLoading } = useQuery({
    queryKey: ["client-members", clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_members")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: open && !!clientId,
  });

  const addMemberMutation = useMutation({
    mutationFn: async (member: { email: string; name: string; role: string }) => {
      const { error } = await supabase.from("client_members").insert({
        client_id: clientId,
        email: member.email,
        name: member.name,
        role: member.role,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-members", clientId] });
      setNewMember({ email: "", name: "", role: "member" });
      toast.success("Membre ajouté avec succès");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de l'ajout du membre");
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await supabase
        .from("client_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["client-members", clientId] });
      toast.success("Membre supprimé");
    },
    onError: (error: any) => {
      toast.error(error.message || "Erreur lors de la suppression");
    },
  });

  const handleAddMember = () => {
    if (!newMember.email || !newMember.name) {
      toast.error("Email et nom requis");
      return;
    }
    addMemberMutation.mutate(newMember);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="w-5 h-5" />
            Membres de {clientName}
          </DialogTitle>
          <DialogDescription>
            Gérez les membres qui ont accès à ce compte client
          </DialogDescription>
        </DialogHeader>

        {/* Add new member form */}
        <div className="border rounded-lg p-4 bg-muted/30 space-y-4">
          <h4 className="font-medium text-sm">Ajouter un membre</h4>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label htmlFor="memberName" className="text-xs">Nom</Label>
              <Input
                id="memberName"
                placeholder="Jean Dupont"
                value={newMember.name}
                onChange={(e) => setNewMember({ ...newMember, name: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="memberEmail" className="text-xs">Email</Label>
              <Input
                id="memberEmail"
                type="email"
                placeholder="jean@example.com"
                value={newMember.email}
                onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="memberRole" className="text-xs">Rôle</Label>
              <Select
                value={newMember.role}
                onValueChange={(value) => setNewMember({ ...newMember, role: value })}
              >
                <SelectTrigger id="memberRole">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="member">Membre</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button
            size="sm"
            onClick={handleAddMember}
            disabled={addMemberMutation.isPending}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Ajouter
          </Button>
        </div>

        {/* Members list */}
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Membre</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Rôle</TableHead>
                <TableHead>Ajouté le</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Chargement...
                  </TableCell>
                </TableRow>
              ) : members?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    Aucun membre pour l'instant
                  </TableCell>
                </TableRow>
              ) : (
                members?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <ClientAvatar name={member.name || member.email} size="sm" />
                        <span className="font-medium">{member.name || "-"}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{member.email}</TableCell>
                    <TableCell>
                      <Badge variant={member.role === "admin" ? "default" : "secondary"}>
                        {member.role === "admin" ? "Admin" : "Membre"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(member.created_at).toLocaleDateString("fr-FR")}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeMemberMutation.mutate(member.id)}
                        disabled={removeMemberMutation.isPending}
                      >
                        <Trash2 className="w-4 h-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};
