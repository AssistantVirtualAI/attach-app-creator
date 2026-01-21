import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useOrgDataExport } from '@/hooks/useOrgDataExport';
import { useToast } from '@/hooks/use-toast';
import { usePermissions } from '@/hooks/usePermissions';

export const DataExportTab = () => {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const { isRole, isSuperAdmin } = usePermissions();
  const exporter = useOrgDataExport();

  const canExport = isSuperAdmin || isRole('org_admin');

  const runExport = async (exportType: 'topics' | 'prompt_templates' | 'both', format: 'json' | 'csv') => {
    if (!selectedOrgId) return;
    try {
      await exporter.mutateAsync({ organizationId: selectedOrgId, exportType, format });
      toast({ title: 'Export généré', description: 'Le téléchargement a démarré.' });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Impossible de générer l’export', variant: 'destructive' });
    }
  };

  if (!canExport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Export des données</CardTitle>
          <CardDescription>Disponible uniquement pour les administrateurs.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-5 w-5" />
            Export des données
          </CardTitle>
          <CardDescription>
            Export sécurisé des sujets et des templates (contrôles côté serveur, journalisation incluse).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            disabled={!selectedOrgId || exporter.isPending}
            onClick={() => runExport('topics', 'json')}
          >
            Export Topics (JSON)
          </Button>
          <Button
            variant="outline"
            disabled={!selectedOrgId || exporter.isPending}
            onClick={() => runExport('prompt_templates', 'json')}
          >
            Export Prompts (JSON)
          </Button>
          <Button disabled={!selectedOrgId || exporter.isPending} onClick={() => runExport('both', 'json')}>
            Export Tout (JSON)
          </Button>
          <Button
            variant="secondary"
            disabled={!selectedOrgId || exporter.isPending}
            onClick={() => runExport('both', 'csv')}
          >
            Export Tout (CSV)
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};
