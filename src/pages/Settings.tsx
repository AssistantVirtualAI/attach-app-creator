import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Key, Bell, Shield, HelpCircle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

const Settings = () => {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [agentId, setAgentId] = useState('');
  const [platform, setPlatform] = useState('elevenlabs');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasIntegration, setHasIntegration] = useState(false);

  useEffect(() => {
    loadIntegration();
  }, []);

  const loadIntegration = async () => {
    if (!user) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('platform', platform)
        .single();

      if (!error && data) {
        setApiKey('••••••••••••••••'); // Mask API key for security
        setAgentId(data.agent_id || '');
        setHasIntegration(true);
      }
    } catch (error) {
      console.error('Error loading integration:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const saveIntegration = async () => {
    if (!user) return;
    if (!apiKey || apiKey === '••••••••••••••••') {
      toast.error('Veuillez saisir une API Key valide');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organization_integrations')
        .upsert({
          user_id: user.id,
          platform,
          api_key: apiKey,
          agent_id: agentId || null,
          is_active: true,
        }, {
          onConflict: 'user_id,platform'
        });

      if (error) throw error;

      toast.success('Intégration configurée avec succès');
      setHasIntegration(true);
      loadIntegration(); // Reload to mask the API key
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const testConnection = async () => {
    if (!apiKey || apiKey === '••••••••••••••••') {
      toast.error('Veuillez sauvegarder l\'intégration d\'abord');
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-analytics', {
        body: { timeframe: '24h' }
      });

      if (error) throw error;
      
      if (data?.requiresSetup) {
        toast.error(data.message || 'Configuration invalide');
      } else {
        toast.success('Connexion réussie !');
      }
    } catch (error: any) {
      toast.error('Erreur de connexion : ' + error.message);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Paramètres</h1>
          <p className="text-muted-foreground text-lg">
            Gérez votre compte et vos préférences
          </p>
        </div>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="glass-card">
            <TabsTrigger value="profile">Profil</TabsTrigger>
            <TabsTrigger value="integrations">Intégrations</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="security">Sécurité</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Informations du Profil</CardTitle>
                    <CardDescription>Gérez vos informations personnelles</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nom Complet</Label>
                  <Input
                    id="fullName"
                    defaultValue="John Doe"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="john.doe@example.com"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="avatar">Avatar URL</Label>
                  <Input
                    id="avatar"
                    placeholder="https://example.com/avatar.jpg"
                    className="bg-background/50"
                  />
                </div>

                <Separator />

                <Button className="bg-gradient-to-r from-primary to-accent">
                  Enregistrer les Modifications
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="integrations" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-secondary to-primary flex items-center justify-center">
                    <Key className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Configuration ElevenLabs ConvAI</CardTitle>
                    <CardDescription>Configurez votre intégration ElevenLabs pour accéder aux analytics et conversations</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {hasIntegration && (
                  <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/30 rounded-lg">
                    <CheckCircle className="h-5 w-5 text-success" />
                    <p className="text-sm text-success">Intégration active</p>
                  </div>
                )}

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="apiKey">API Key ElevenLabs *</Label>
                    <Input
                      id="apiKey"
                      type="password"
                      placeholder="sk_..."
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      className="bg-background/50"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      Vous pouvez trouver votre API Key dans votre{' '}
                      <a 
                        href="https://elevenlabs.io/app/settings/api-keys" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        compte ElevenLabs
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="agentId">Agent ID (optionnel)</Label>
                    <Input
                      id="agentId"
                      placeholder="agent_..."
                      value={agentId}
                      onChange={(e) => setAgentId(e.target.value)}
                      className="bg-background/50"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      L'ID de votre agent ConvAI. Laissez vide pour utiliser l'agent par défaut.
                    </p>
                  </div>
                </div>

                <Separator />

                <div className="flex gap-3">
                  <Button 
                    onClick={saveIntegration}
                    disabled={isSaving || isLoading}
                    className="flex-1 bg-gradient-to-r from-primary to-accent"
                  >
                    {isSaving ? 'Enregistrement...' : 'Enregistrer la Configuration'}
                  </Button>
                  {hasIntegration && (
                    <Button 
                      onClick={testConnection}
                      variant="outline"
                      disabled={isLoading}
                    >
                      Tester la Connexion
                    </Button>
                  )}
                </div>

                <div className="mt-6 p-4 bg-muted/30 rounded-lg">
                  <h4 className="font-semibold mb-2">Autres Intégrations (Bientôt disponibles)</h4>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between">
                      <span>• Vapi</span>
                      <span className="text-xs">Prochainement</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>• Retell AI</span>
                      <span className="text-xs">Prochainement</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center">
                    <Bell className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Notifications</CardTitle>
                    <CardDescription>Configurez vos préférences de notification</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Notifications Email</Label>
                    <p className="text-sm text-muted-foreground">
                      Recevoir des mises à jour par email
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Alertes Temps Réel</Label>
                    <p className="text-sm text-muted-foreground">
                      Notifications pour les événements importants
                    </p>
                  </div>
                  <Switch defaultChecked />
                </div>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Rapports Hebdomadaires</Label>
                    <p className="text-sm text-muted-foreground">
                      Résumé hebdomadaire des statistiques
                    </p>
                  </div>
                  <Switch />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="security" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Shield className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <CardTitle>Sécurité</CardTitle>
                    <CardDescription>Paramètres de sécurité du compte</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Mot de Passe Actuel</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">Nouveau Mot de Passe</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-background/50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmer le Mot de Passe</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="bg-background/50"
                  />
                </div>

                <Separator />

                <Button className="bg-gradient-to-r from-primary to-accent">
                  Changer le Mot de Passe
                </Button>

                <Separator />

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Authentification à Deux Facteurs</Label>
                    <p className="text-sm text-muted-foreground">
                      Ajouter une couche de sécurité supplémentaire
                    </p>
                  </div>
                  <Button variant="outline">Activer</Button>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card border-destructive/50">
              <CardHeader>
                <CardTitle className="text-destructive">Zone de Danger</CardTitle>
                <CardDescription>Actions irréversibles</CardDescription>
              </CardHeader>
              <CardContent>
                <Button variant="destructive" className="w-full">
                  Supprimer le Compte
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Help Section */}
        <Card className="glass-card mt-8">
          <CardHeader>
            <div className="flex items-center gap-3">
              <HelpCircle className="w-6 h-6 text-primary" />
              <div>
                <CardTitle>Besoin d'Aide ?</CardTitle>
                <CardDescription>Consultez notre documentation ou contactez le support</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex gap-4">
            <Button variant="outline" className="flex-1">
              Documentation
            </Button>
            <Button variant="outline" className="flex-1">
              Support
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Settings;