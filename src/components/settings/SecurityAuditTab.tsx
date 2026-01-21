import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, RefreshCw } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useRunSecurityAudit, useSecurityAuditRuns } from '@/hooks/useSecurityAudit';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';

type CheckStatus = 'pass' | 'fail' | 'warn';

const statusVariant = (s: CheckStatus) => {
  if (s === 'pass') return 'default';
  if (s === 'fail') return 'destructive';
  return 'secondary';
};

export const SecurityAuditTab = () => {
  const { selectedOrgId } = useOrganization();
  const { can, isSuperAdmin, role } = usePermissions();
  const { toast } = useToast();
  const runsQuery = useSecurityAuditRuns(selectedOrgId || undefined);
  const runAudit = useRunSecurityAudit();

  const canView = isSuperAdmin || role === 'org_admin' || role === 'manager' || can('manage:organization');

  const latest = runsQuery.data?.[0];
  const checks: Array<{ id: string; title: string; status: CheckStatus }> = latest?.results?.checks || [];

  const onRun = async () => {
    if (!selectedOrgId) return;
    try {
      await runAudit.mutateAsync({ organizationId: selectedOrgId });
      toast({ title: 'Audit lancé', description: 'Audit terminé et enregistré.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible d’exécuter l’audit', variant: 'destructive' });
    }
  };

  if (!canView) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Security Audit</CardTitle>
          <CardDescription>Disponible uniquement pour Admin/Manager.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Security Audit
              </CardTitle>
              <CardDescription>
                Dernier audit: {latest?.created_at ? new Date(latest.created_at).toLocaleString() : 'Aucun'}
              </CardDescription>
            </div>
            <Button onClick={onRun} disabled={!selectedOrgId || runAudit.isPending} className="gap-2">
              <RefreshCw className={runAudit.isPending ? 'h-4 w-4 animate-spin' : 'h-4 w-4'} />
              Relancer
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {runsQuery.isLoading ? (
            <div className="text-sm text-muted-foreground">Chargement…</div>
          ) : !latest ? (
            <div className="text-sm text-muted-foreground">Aucun audit enregistré.</div>
          ) : checks.length === 0 ? (
            <div className="text-sm text-muted-foreground">Aucun check retourné.</div>
          ) : (
            <div className="space-y-2">
              {checks.map((c) => (
                <div key={c.id} className="flex items-center justify-between rounded-lg border border-border/50 bg-muted/30 p-3">
                  <div className="text-sm font-medium">{c.title}</div>
                  <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
