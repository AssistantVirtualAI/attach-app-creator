import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { User, Key, Bell, Shield, HelpCircle } from 'lucide-react';

const Settings = () => {
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
                    <CardTitle>Clés API</CardTitle>
                    <CardDescription>Gérez vos intégrations API</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">ElevenLabs API</h4>
                      <p className="text-sm text-muted-foreground">
                        Clé API pour l'intégration ElevenLabs ConvAI
                      </p>
                    </div>
                    <Button variant="outline">Configurer</Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">Vapi API</h4>
                      <p className="text-sm text-muted-foreground">
                        Clé API pour l'intégration Vapi
                      </p>
                    </div>
                    <Button variant="outline">Configurer</Button>
                  </div>

                  <div className="flex items-center justify-between p-4 border border-border/50 rounded-lg">
                    <div>
                      <h4 className="font-semibold">Retell AI</h4>
                      <p className="text-sm text-muted-foreground">
                        Clé API pour l'intégration Retell AI
                      </p>
                    </div>
                    <Button variant="outline">Configurer</Button>
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