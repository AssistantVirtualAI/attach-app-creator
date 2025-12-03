import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Link, Copy, ExternalLink, QrCode, Check } from 'lucide-react';
import { toast } from 'sonner';
import { ClientDetail } from '@/hooks/useClientDetail';

interface ClientUrlTabProps {
  client: ClientDetail;
}

export const ClientUrlTab = ({ client }: ClientUrlTabProps) => {
  const [copied, setCopied] = useState(false);
  
  const baseUrl = window.location.origin;
  const clientPortalUrl = `${baseUrl}/client/login`;
  const directAccessUrl = client.login_id ? `${baseUrl}/client/${client.login_id}` : null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Lien du portail client
          </CardTitle>
          <CardDescription>
            Partagez ce lien avec votre client pour qu'il accède à son dashboard
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>URL de connexion</Label>
            <div className="flex gap-2">
              <Input value={clientPortalUrl} readOnly className="font-mono text-sm" />
              <Button
                variant="outline"
                onClick={() => copyToClipboard(clientPortalUrl)}
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                onClick={() => window.open(clientPortalUrl, '_blank')}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {directAccessUrl && (
            <div className="space-y-2">
              <Label>Accès direct (avec login_id)</Label>
              <div className="flex gap-2">
                <Input value={directAccessUrl} readOnly className="font-mono text-sm" />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(directAccessUrl)}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Identifiant de connexion</Label>
            <Input value={client.login_id || 'Non défini'} readOnly className="font-mono" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5" />
            QR Code
          </CardTitle>
          <CardDescription>
            Scannez ce code pour accéder au portail client
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center gap-4">
            <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
              <div className="text-center">
                <QrCode className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  QR Code disponible<br />prochainement
                </p>
              </div>
            </div>
            <Button variant="outline" disabled>
              Télécharger le QR Code
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructions de connexion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <p className="flex items-start gap-2">
              <span className="font-bold text-primary">1.</span>
              Partagez le lien de connexion ci-dessus avec votre client
            </p>
            <p className="flex items-start gap-2">
              <span className="font-bold text-primary">2.</span>
              Le client utilise son identifiant : <code className="bg-muted px-2 py-0.5 rounded">{client.login_id || 'non défini'}</code>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-bold text-primary">3.</span>
              Le client accède à son dashboard personnalisé
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
