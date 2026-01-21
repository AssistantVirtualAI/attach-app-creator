import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { MembersList } from '@/components/team/MembersList';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/hooks/useAuth';

const ROLE_DESCRIPTIONS: Record<string, string> = {
  org_admin: 'Accès complet (gestion rôles, intégrations, facturation).',
  manager: 'Gestion opérationnelle (agents, conversations, analytics).',
  agent: 'Accès aux conversations et knowledge base.',
  viewer: 'Lecture seule.',
};

const PERMISSIONS: Array<{ permission: string; roles: string[] }> = [
  { permission: 'manage:organization', roles: ['org_admin'] },
  { permission: 'manage:roles', roles: ['org_admin'] },
  { permission: 'manage:members', roles: ['org_admin', 'manager'] },
  { permission: 'manage:api_keys', roles: ['org_admin'] },
  { permission: 'edit:integrations', roles: ['org_admin'] },
  { permission: 'read:analytics', roles: ['org_admin', 'manager', 'agent', 'viewer'] },
];

export const RolesPermissionsTab = () => {
  const { role, isSuperAdmin, can } = usePermissions();
  const { members, isLoading, updateMemberRole, removeMember } = useTeamMembers();
  const { user } = useAuth();

  const canManageRoles = can('manage:roles');
  const canSee = isSuperAdmin || role === 'org_admin' || role === 'manager' || canManageRoles;

  if (!canSee) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Rôles & permissions</CardTitle>
          <CardDescription>Disponible uniquement pour Admin/Manager.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Rôles & permissions
          </CardTitle>
          <CardDescription>Gestion des rôles avec trail d’audit automatique.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Description</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(ROLE_DESCRIPTIONS).map(([r, d]) => (
                <TableRow key={r}>
                  <TableCell className="font-medium">
                    <Badge variant="outline">{r}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{d}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-sm">Membres & rôles</CardTitle>
          <CardDescription>
            Seuls les admins peuvent modifier les rôles. Les changements sont journalisés.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <MembersList
              members={members}
              onUpdateRole={(userId, newRole) => updateMemberRole.mutate({ userId, newRole })}
              onRemoveMember={(userId) => removeMember.mutate(userId)}
              currentUserId={user?.id}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permissions (résumé)</CardTitle>
          <CardDescription>Vue rapide des permissions clés par rôle.</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Permission</TableHead>
                <TableHead>Rôles</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {PERMISSIONS.map((p) => (
                <TableRow key={p.permission}>
                  <TableCell className="font-mono text-xs">{p.permission}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {p.roles.map((r) => (
                        <Badge key={r} variant="secondary">{r}</Badge>
                      ))}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};
