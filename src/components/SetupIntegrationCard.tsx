import { Link } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, Settings } from 'lucide-react';

interface SetupIntegrationCardProps {
  title: string;
  message?: string;
}

export const SetupIntegrationCard = ({ title, message }: SetupIntegrationCardProps) => {
  return (
    <Card className="glass-card border-primary/30">
      <CardHeader>
        <div className="flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-primary" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>
              {message || 'Configuration ElevenLabs requise pour afficher les données'}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground">
          Pour commencer à utiliser cette fonctionnalité, vous devez configurer votre intégration ElevenLabs
          dans les paramètres. Vous aurez besoin de :
        </p>
        <ul className="list-disc list-inside space-y-2 text-muted-foreground ml-4">
          <li>Votre API Key ElevenLabs</li>
          <li>L'ID de votre Agent ConvAI (optionnel)</li>
        </ul>
        <Link to="/settings">
          <Button className="w-full" size="lg">
            <Settings className="mr-2 h-4 w-4" />
            Configurer maintenant
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
};