import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, CheckCircle, XCircle } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';

const platforms = [
  {
    name: 'OpenAI',
    value: 'openai',
    description: 'Connectez vos modèles GPT',
    icon: '🤖',
  },
  {
    name: 'Vapi',
    value: 'vapi',
    description: 'Agent vocal intelligent',
    icon: '🎙️',
  },
  {
    name: 'Retell',
    value: 'retell',
    description: 'Conversations téléphoniques IA',
    icon: '📞',
  },
  {
    name: 'ElevenLabs',
    value: 'elevenlabs',
    description: 'Synthèse vocale avancée',
    icon: '🔊',
  },
];

export default function Integrations() {
  const { selectedOrgId } = useOrganization();
  const { toast } = useToast();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('');
  const [testing, setTesting] = useState(false);

  const { data: integrations = [], refetch } = useQuery({
    queryKey: ['integrations', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];

      const { data, error } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('organization_id', selectedOrgId);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId,
  });

  const handleSave = async () => {
    if (!selectedOrgId || !selectedPlatform || !apiKey) return;

    try {
      setTesting(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('organization_integrations')
        .insert({
          organization_id: selectedOrgId,
          user_id: user.id,
          platform: selectedPlatform,
          api_key: apiKey,
          agent_id: agentId || null,
          is_active: true,
        });

      if (error) throw error;

      toast({
        title: 'Intégration ajoutée',
        description: 'La configuration a été sauvegardée avec succès',
      });

      setSelectedPlatform(null);
      setApiKey('');
      setAgentId('');
      refetch();
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setTesting(false);
    }
  };

  const getIntegrationStatus = (platform: string) => {
    return integrations.find((int) => int.platform === platform);
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">Intégrations</h1>
          <p className="text-muted-foreground">
            Connectez vos plateformes d'IA préférées
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {platforms.map((platform) => {
            const integration = getIntegrationStatus(platform.value);
            const isConfigured = !!integration;

            return (
              <Card key={platform.value} className="glass-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{platform.icon}</span>
                      <div>
                        <CardTitle>{platform.name}</CardTitle>
                        <CardDescription>{platform.description}</CardDescription>
                      </div>
                    </div>
                    {isConfigured ? (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    ) : (
                      <XCircle className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {isConfigured ? (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">
                        Configurée ✓
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedPlatform(platform.value)}
                      >
                        Reconfigurer
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => setSelectedPlatform(platform.value)}
                      className="w-full gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Ajouter une intégration
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Dialog
          open={!!selectedPlatform}
          onOpenChange={(open) => !open && setSelectedPlatform(null)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>
                Configurer {platforms.find((p) => p.value === selectedPlatform)?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label htmlFor="apiKey">Clé API *</Label>
                <Input
                  id="apiKey"
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <Label htmlFor="agentId">Agent ID (optionnel)</Label>
                <Input
                  id="agentId"
                  value={agentId}
                  onChange={(e) => setAgentId(e.target.value)}
                  placeholder="agent_xxx"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSave}
                  disabled={testing || !apiKey}
                  className="flex-1"
                >
                  {testing ? 'Test en cours...' : 'Sauvegarder'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
