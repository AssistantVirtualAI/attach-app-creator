import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MoreHorizontal, Shield, UserMinus, Mail } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { TeamMember } from '@/hooks/useTeamMembers';

interface MembersListProps {
  members: TeamMember[];
  onUpdateRole: (userId: string, newRole: 'org_admin' | 'manager' | 'agent' | 'viewer') => void;
  onRemoveMember: (userId: string) => void;
  onSelectMember?: (member: TeamMember) => void;
  currentUserId?: string;
}


const roleLabels: Record<string, { label: string; color: string }> = {
  super_admin: { label: 'Super Admin', color: 'bg-red-500/10 text-red-500' },
  org_admin: { label: 'Admin', color: 'bg-purple-500/10 text-purple-500' },
  manager: { label: 'Manager', color: 'bg-blue-500/10 text-blue-500' },
  agent: { label: 'Agent', color: 'bg-green-500/10 text-green-500' },
  viewer: { label: 'Viewer', color: 'bg-gray-500/10 text-gray-500' },
};

export const MembersList = ({ members, onUpdateRole, onRemoveMember, currentUserId }: MembersListProps) => {
  const getInitials = (name: string | null, email: string) => {
    if (name) {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return email.substring(0, 2).toUpperCase();
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Membre</TableHead>
          <TableHead>Rôle</TableHead>
          <TableHead>Rejoint le</TableHead>
          <TableHead className="w-[50px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => {
          const role = member.role?.role || 'viewer';
          const roleInfo = roleLabels[role] || roleLabels.viewer;
          const isCurrentUser = member.user_id === currentUserId;

          return (
            <TableRow key={member.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={member.profile?.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {getInitials(member.profile?.full_name || null, member.profile?.email || '')}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium text-foreground">
                      {member.profile?.full_name || 'Sans nom'}
                      {isCurrentUser && <span className="text-muted-foreground ml-2">(vous)</span>}
                    </p>
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {member.profile?.email}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <Badge className={roleInfo.color} variant="secondary">
                  {roleInfo.label}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground">
                {member.accepted_at
                  ? format(new Date(member.accepted_at), 'dd MMM yyyy', { locale: fr })
                  : 'En attente'}
              </TableCell>
              <TableCell>
                {!isCurrentUser && role !== 'super_admin' && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onUpdateRole(member.user_id, 'org_admin')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Définir comme Admin
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onUpdateRole(member.user_id, 'manager')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Définir comme Manager
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onUpdateRole(member.user_id, 'agent')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Définir comme Agent
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => onUpdateRole(member.user_id, 'viewer')}>
                        <Shield className="h-4 w-4 mr-2" />
                        Définir comme Viewer
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => onRemoveMember(member.user_id)}
                        className="text-destructive"
                      >
                        <UserMinus className="h-4 w-4 mr-2" />
                        Retirer de l'équipe
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
};
