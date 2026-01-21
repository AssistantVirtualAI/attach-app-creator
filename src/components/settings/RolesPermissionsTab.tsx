import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Shield } from 'lucide-react';
import { usePermissions } from '@/hooks/usePermissions';
import { MembersList } from '@/components/team/MembersList';
import { useTeamMembers } from '@/hooks/useTeamMembers';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/context/OrganizationContext';
import { Switch } from '@/components/ui/switch';
import { ALL_PERMISSIONS, DEFAULT_PERMISSIONS_MATRIX, type Permission, type Role } from '@/lib/permissions';
import { useOrgRolePermissions, useUpsertOrgRolePermission } from '@/hooks/useRolePermissionsManagement';

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
  const { selectedOrgId } = useOrganization();
  const { members, isLoading, updateMemberRole, removeMember } = useTeamMembers();
  const { user } = useAuth();

  const canManagePermissions = isSuperAdmin || can('manage:permissions');
  const matrix = useOrgRolePermissions(selectedOrgId || undefined);
  const upsert = useUpsertOrgRolePermission();

  const rolesForMatrix: Role[] = ['org_admin', 'manager', 'agent', 'viewer'];
  const overridesByKey = new Map<string, boolean>(
    (matrix.data || []).map((o) => [`${o.role}:${o.permission}`, o.allowed] as const),
  );

  const effectiveAllowed = (r: Role, p: Permission) => {
    const k = `${r}:${p}`;
    if (overridesByKey.has(k)) return Boolean(overridesByKey.get(k));
    return (DEFAULT_PERMISSIONS_MATRIX[r] || []).includes(p);
  };

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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Permissions (matrice)</CardTitle>
          <CardDescription>
            Personnalisez les permissions par rôle (enforced côté serveur). Seuls les admins peuvent modifier.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {matrix.isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : !selectedOrgId ? (
            <div className="text-sm text-muted-foreground">Aucune organisation sélectionnée.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permission</TableHead>
                    {rolesForMatrix.map((r) => (
                      <TableHead key={r} className="text-center">
                        <Badge variant="outline">{r}</Badge>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(ALL_PERMISSIONS as Permission[]).map((perm) => (
                    <TableRow key={perm}>
                      <TableCell className="font-mono text-xs">{perm}</TableCell>
                      {rolesForMatrix.map((r) => {
                        const checked = effectiveAllowed(r, perm);
                        return (
                          <TableCell key={`${r}:${perm}`} className="text-center">
                            <Switch
                              checked={checked}
                              disabled={!canManagePermissions || upsert.isPending}
                              onCheckedChange={(next) => {
                                if (!selectedOrgId) return;
                                upsert.mutate({
                                  organizationId: selectedOrgId,
                                  role: r,
                                  permission: perm,
                                  allowed: Boolean(next),
                                });
                              }}
                            />
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
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

