import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, CheckCircle, XCircle, Loader2, TestTube, Clock } from 'lucide-react';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Info, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useOrganization } from '@/context/OrganizationContext';
import { useToast } from '@/hooks/use-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const location = useLocation();
  const navigate = useNavigate();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('');
  const [saving, setSaving] = useState(false);
  const [testingPlatform, setTestingPlatform] = useState<string | null>(null);

  const searchParams = new URLSearchParams(location.search);
  const fromAgents = searchParams.get('from') === 'agents';

  // Fetch integrations - works with or without organization
  const { data: integrations = [], refetch } = useQuery({
    queryKey: ['integrations', selectedOrgId],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('organization_integrations')
        .select('*')
        .eq('user_id', user.id);

      if (selectedOrgId) {
        query = query.eq('organization_id', selectedOrgId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const testIntegration = async (platform: string) => {
    setTestingPlatform(platform);
    try {
      const { data, error } = await supabase.functions.invoke('test-integration', {
        body: { platform },
      });

      if (error) throw error;

      await refetch();

      if (data?.success) {
        toast({
          title: 'Connexion réussie',
          description: `L'intégration ${platform} fonctionne correctement`,
        });
      } else {
        toast({
          title: 'Échec de la connexion',
          description: data?.error || 'La connexion a échoué',
          variant: 'destructive',
        });
      }
    } catch (error: any) {
      console.error('Test integration error:', error);
      toast({
        title: 'Erreur de test',
        description: error.message || 'Impossible de tester la connexion',
        variant: 'destructive',
      });
    } finally {
      setTestingPlatform(null);
    }
  };

  const handleSave = async () => {
    if (!selectedPlatform || !apiKey) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs requis',
        variant: 'destructive',
      });
      return;
    }

    try {
      setSaving(true);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: 'Erreur',
          description: 'Vous devez être connecté pour ajouter une intégration',
          variant: 'destructive',
        });
        return;
      }

      const existingIntegration = integrations.find(
        (int) => int.platform === selectedPlatform
      );

      let integrationId: string;

      if (existingIntegration) {
        const { error } = await supabase
          .from('organization_integrations')
          .update({
            api_key: apiKey,
            agent_id: agentId || null,
            updated_at: new Date().toISOString(),
            test_status: 'pending',
          })
          .eq('id', existingIntegration.id);

        if (error) throw error;
        integrationId = existingIntegration.id;
      } else {
        const { data, error } = await supabase
          .from('organization_integrations')
          .insert({
            organization_id: selectedOrgId || null,
            user_id: user.id,
            platform: selectedPlatform,
            api_key: apiKey,
            agent_id: agentId || null,
            is_active: true,
            test_status: 'pending',
          })
          .select('id')
          .single();

        if (error) throw error;
        integrationId = data.id;
      }

      toast({
        title: 'Intégration sauvegardée',
        description: 'Test de connexion en cours...',
      });

      setSelectedPlatform(null);
      setApiKey('');
      setAgentId('');
      await refetch();

      // Auto-test the integration
      await testIntegration(selectedPlatform);

    } catch (error: any) {
      console.error('Integration save error:', error);
      toast({
        title: 'Erreur',
        description: error.message || 'Impossible de sauvegarder l\'intégration',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const getIntegrationStatus = (platform: string) => {
    return integrations.find((int) => int.platform === platform);
  };

  const getTestStatusBadge = (status: string | null) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Connecté</Badge>;
      case 'failed':
        return <Badge variant="destructive">Échec</Badge>;
      case 'pending':
        return <Badge variant="secondary">En attente</Badge>;
      default:
        return <Badge variant="outline">Non testé</Badge>;
    }
  };

  const maskAgentId = (id: string | null) => {
    if (!id) return null;
    if (id.length <= 8) return id;
    return `${id.slice(0, 4)}...${id.slice(-4)}`;
  };

  return (
    <AppLayout>
      <div className="p-8 space-y-6">
        {fromAgents && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <span>Configurez une intégration pour pouvoir créer un agent</span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate('/agents')}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Retour aux agents
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <div>
          <h1 className="text-3xl font-bold gradient-text mb-2">Intégrations</h1>
          <p className="text-muted-foreground">
            Connectez vos plateformes d'IA préférées
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {platforms.map((platform) => {
            const integration = getIntegrationStatus(platform.value);
            const isConfigured = !!integration;
            const isTesting = testingPlatform === platform.value;

            return (
              <Card key={platform.value} className="glass-card">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{platform.icon}</span>
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          {platform.name}
                          {isConfigured && getTestStatusBadge(integration.test_status)}
                        </CardTitle>
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
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground space-y-1">
                        {integration.agent_id && (
                          <p className="flex items-center gap-1">
                            <span>Agent ID:</span>
                            <code className="bg-muted px-1 rounded text-xs">
                              {maskAgentId(integration.agent_id)}
                            </code>
                          </p>
                        )}
                        <p className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>
                            Configuré le {format(new Date(integration.updated_at || integration.created_at), 'dd MMM yyyy à HH:mm', { locale: fr })}
                          </span>
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => testIntegration(platform.value)}
                          disabled={isTesting}
                        >
                          {isTesting ? (
                            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4 mr-1" />
                          )}
                          Tester
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedPlatform(platform.value);
                            setAgentId(integration.agent_id || '');
                          }}
                        >
                          Reconfigurer
                        </Button>
                      </div>
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
                  disabled={saving || !apiKey}
                  className="flex-1"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    'Sauvegarder et tester'
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
