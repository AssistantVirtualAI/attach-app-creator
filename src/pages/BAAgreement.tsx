import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { FileText, Download, CheckCircle2, AlertTriangle, Shield, Loader2 } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const BAAgreement = () => {
  const { selectedOrg } = useOrganization();
  const { user } = useAuth();
  const [isAgreed, setIsAgreed] = useState(false);
  const [isSigning, setIsSigning] = useState(false);
  const [baaData, setBaaData] = useState<{ baa_signed_at: string | null; baa_signed_by: string | null; hipaa_enabled: boolean } | null>(null);

  useEffect(() => {
    if (selectedOrg) {
      fetchBaaStatus();
    }
  }, [selectedOrg]);

  const fetchBaaStatus = async () => {
    if (!selectedOrg) return;
    const { data } = await supabase
      .from('organizations')
      .select('baa_signed_at, baa_signed_by, hipaa_enabled')
      .eq('id', selectedOrg.id)
      .single();
    setBaaData(data);
  };

  const handleSignBaa = async () => {
    if (!selectedOrg || !user || !isAgreed) return;
    setIsSigning(true);

    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          baa_signed_at: new Date().toISOString(),
        baa_signed_by: user.id,
      })
      .eq('id', selectedOrg.id);

      if (error) throw error;

      toast.success('BAA signé avec succès');
      fetchBaaStatus();
    } catch (error) {
      console.error('Error signing BAA:', error);
      toast.error('Erreur lors de la signature du BAA');
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadBaa = () => {
    // Generate a simple BAA PDF (in production, use a proper PDF template)
    const baaContent = `
BUSINESS ASSOCIATE AGREEMENT (BAA)

This Business Associate Agreement ("Agreement") is entered into by and between:

Organization: ${selectedOrg?.name || 'N/A'}
Date: ${baaData?.baa_signed_at ? format(new Date(baaData.baa_signed_at), 'dd MMMM yyyy', { locale: fr }) : 'Not signed'}

HIPAA COMPLIANCE TERMS

1. DEFINITIONS
   - "Protected Health Information" or "PHI" means individually identifiable health information.
   - "Business Associate" means a person or entity that performs functions involving PHI.

2. OBLIGATIONS OF BUSINESS ASSOCIATE
   - Not use or disclose PHI other than as permitted by this Agreement
   - Use appropriate safeguards to prevent unauthorized use or disclosure of PHI
   - Report to Covered Entity any unauthorized use or disclosure of PHI
   - Ensure that any subcontractors agree to the same restrictions

3. SECURITY MEASURES
   - Encryption at rest (AES-256)
   - Encryption in transit (TLS 1.3)
   - Audit logging of all access to PHI
   - Access controls and authentication

4. TERMINATION
   - Upon termination, Business Associate shall return or destroy all PHI

This agreement is electronically signed and legally binding.
    `;

    const blob = new Blob([baaContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `BAA-${selectedOrg?.name || 'agreement'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!baaData?.hipaa_enabled) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Business Associate Agreement (BAA)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  Le BAA est disponible uniquement avec l'add-on HIPAA Compliance. 
                  Activez HIPAA dans la configuration SaaS pour accéder à cette fonctionnalité.
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Business Associate Agreement</h1>
          <p className="text-muted-foreground text-lg">
            Accord de partenariat commercial pour la conformité HIPAA
          </p>
        </div>

        {baaData?.baa_signed_at ? (
          <Card className="border-green-500/50 bg-green-500/5">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="w-5 h-5" />
                  BAA Signé
                </CardTitle>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  Conforme HIPAA
                </Badge>
              </div>
              <CardDescription>
                Signé le {format(new Date(baaData.baa_signed_at), 'dd MMMM yyyy à HH:mm', { locale: fr })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="outline" onClick={handleDownloadBaa} className="gap-2">
                <Download className="w-4 h-4" />
                Télécharger le BAA
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Signer le BAA
              </CardTitle>
              <CardDescription>
                Ce document définit les obligations de protection des données de santé (PHI)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm dark:prose-invert max-w-none bg-muted/50 p-6 rounded-lg max-h-96 overflow-y-auto">
                <h3>BUSINESS ASSOCIATE AGREEMENT</h3>
                
                <h4>1. DÉFINITIONS</h4>
                <p>
                  "Protected Health Information" ou "PHI" désigne les informations de santé 
                  individuellement identifiables transmises ou maintenues sous toute forme.
                </p>

                <h4>2. OBLIGATIONS DU BUSINESS ASSOCIATE</h4>
                <ul>
                  <li>Ne pas utiliser ou divulguer les PHI autrement que permis par cet Accord</li>
                  <li>Utiliser des mesures de protection appropriées pour prévenir l'utilisation non autorisée</li>
                  <li>Signaler toute utilisation ou divulgation non autorisée</li>
                  <li>S'assurer que les sous-traitants acceptent les mêmes restrictions</li>
                </ul>

                <h4>3. MESURES DE SÉCURITÉ</h4>
                <ul>
                  <li>Chiffrement au repos (AES-256)</li>
                  <li>Chiffrement en transit (TLS 1.3)</li>
                  <li>Journalisation d'audit de tous les accès aux PHI</li>
                  <li>Contrôles d'accès et authentification</li>
                </ul>

                <h4>4. RÉSILIATION</h4>
                <p>
                  À la résiliation, le Business Associate devra retourner ou détruire tous les PHI.
                </p>
              </div>

              <div className="flex items-start space-x-3 p-4 border rounded-lg">
                <Checkbox 
                  id="agree" 
                  checked={isAgreed}
                  onCheckedChange={(checked) => setIsAgreed(checked as boolean)}
                />
                <Label htmlFor="agree" className="text-sm leading-relaxed cursor-pointer">
                  J'ai lu et j'accepte les termes du Business Associate Agreement. Je comprends que 
                  cette signature électronique est juridiquement contraignante et engage mon organisation.
                </Label>
              </div>

              <div className="flex gap-4">
                <Button onClick={handleSignBaa} disabled={!isAgreed || isSigning} className="gap-2">
                  {isSigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                  Signer le BAA
                </Button>
                <Button variant="outline" onClick={handleDownloadBaa} className="gap-2">
                  <Download className="w-4 h-4" />
                  Télécharger (non signé)
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default BAAgreement;
