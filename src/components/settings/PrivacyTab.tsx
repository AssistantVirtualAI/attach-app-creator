import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Download, Trash2, AlertTriangle, Shield, FileText, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const PrivacyTab = () => {
  const { user } = useAuth();
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const handleExportData = async () => {
    if (!user) return;
    setIsExporting(true);

    try {
      const { data, error } = await supabase.functions.invoke('export-user-data');
      
      if (error) throw error;

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mes-donnees-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Vos données ont été exportées avec succès');
    } catch (error) {
      console.error('Export error:', error);
      toast.error("Erreur lors de l'export des données");
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user || deleteConfirmation !== 'SUPPRIMER') return;
    setIsDeleting(true);

    try {
      const { error } = await supabase.functions.invoke('delete-user-data');
      
      if (error) throw error;

      toast.success('Votre demande de suppression a été enregistrée. Vous recevrez un email de confirmation.');
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Erreur lors de la demande de suppression');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5" />
            Vos droits RGPD
          </CardTitle>
          <CardDescription>
            Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez de droits sur vos données personnelles.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <h4 className="font-medium mb-2">Droit d'accès</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Vous pouvez demander une copie de toutes vos données personnelles que nous détenons.
              </p>
              <Button onClick={handleExportData} disabled={isExporting} className="gap-2">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                Exporter mes données
              </Button>
            </Card>

            <Card className="p-4">
              <h4 className="font-medium mb-2">Droit à l'effacement</h4>
              <p className="text-sm text-muted-foreground mb-4">
                Vous pouvez demander la suppression de votre compte et de toutes vos données.
              </p>
              <Button variant="destructive" onClick={() => setShowDeleteDialog(true)} className="gap-2">
                <Trash2 className="w-4 h-4" />
                Supprimer mon compte
              </Button>
            </Card>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Documents légaux
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <Button variant="outline" asChild>
              <a href="/privacy" target="_blank">Politique de confidentialité</a>
            </Button>
            <Button variant="outline" asChild>
              <a href="/terms" target="_blank">Conditions d'utilisation</a>
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="w-5 h-5" />
              Supprimer votre compte
            </DialogTitle>
            <DialogDescription>
              Cette action est irréversible. Toutes vos données seront supprimées après une période de grâce de 30 jours.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Vous perdrez l'accès à toutes vos conversations, agents, et configurations. Les données liées à votre organisation seront anonymisées.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <Label>Tapez SUPPRIMER pour confirmer</Label>
            <Input 
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="SUPPRIMER"
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Annuler
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDeleteAccount}
              disabled={deleteConfirmation !== 'SUPPRIMER' || isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Confirmer la suppression
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
