import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Upload, Palette, Mail, Globe, FileText } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function SaaSConfigurator() {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const handleSave = () => {
    setSaving(true);
    setTimeout(() => {
      setSaving(false);
      toast({
        title: 'Configuration sauvegardée',
        description: 'Les paramètres ont été mis à jour avec succès',
      });
    }, 1000);
  };

  return (
    <AppLayout>
      <div className="p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold gradient-text mb-2">
            Configurateur SaaS
          </h1>
          <p className="text-muted-foreground">
            Personnalisez votre plateforme en marque blanche
          </p>
        </div>

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="branding">Marque</TabsTrigger>
            <TabsTrigger value="domain">Domaine</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="footer">Footer</TabsTrigger>
            <TabsTrigger value="legal">Légal</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Palette className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Identité visuelle</CardTitle>
                    <CardDescription>
                      Personnalisez l'apparence de votre plateforme
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <Label>Logo du tableau de bord</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <Button variant="outline">Télécharger</Button>
                  </div>
                </div>

                <div>
                  <Label>Logo de la page de connexion</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-32 h-32 border-2 border-dashed rounded-lg flex items-center justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <Button variant="outline">Télécharger</Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="primaryColor">Couleur primaire</Label>
                  <div className="flex gap-4 mt-2">
                    <Input
                      id="primaryColor"
                      type="color"
                      defaultValue="#8B5CF6"
                      className="w-20 h-10"
                    />
                    <Input
                      defaultValue="#8B5CF6"
                      placeholder="#8B5CF6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domain" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Domaine personnalisé</CardTitle>
                    <CardDescription>
                      Configurez votre nom de domaine
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="domain">Nom de domaine</Label>
                  <Input
                    id="domain"
                    placeholder="app.votre-domaine.com"
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Pointez un enregistrement CNAME vers: app.avastatistic.lovable.app
                  </p>
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Configuration SMTP</CardTitle>
                    <CardDescription>
                      Configurez l'envoi d'emails
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="smtpHost">Serveur SMTP</Label>
                  <Input id="smtpHost" placeholder="smtp.gmail.com" className="mt-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="smtpPort">Port</Label>
                    <Input id="smtpPort" placeholder="587" className="mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="smtpUser">Utilisateur</Label>
                    <Input id="smtpUser" placeholder="user@email.com" className="mt-2" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="smtpPassword">Mot de passe</Label>
                  <Input
                    id="smtpPassword"
                    type="password"
                    placeholder="••••••••"
                    className="mt-2"
                  />
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="footer" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Footer personnalisé</CardTitle>
                <CardDescription>
                  Personnalisez le pied de page
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="footerText">Texte du footer</Label>
                  <Textarea
                    id="footerText"
                    placeholder="© 2025 Votre Entreprise. Tous droits réservés."
                    className="mt-2"
                  />
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="legal" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <FileText className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Mentions légales</CardTitle>
                    <CardDescription>
                      Configurez vos documents légaux
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="privacy">Politique de confidentialité (URL)</Label>
                  <Input
                    id="privacy"
                    placeholder="https://votre-site.com/privacy"
                    className="mt-2"
                  />
                </div>

                <div>
                  <Label htmlFor="terms">Conditions d'utilisation (URL)</Label>
                  <Input
                    id="terms"
                    placeholder="https://votre-site.com/terms"
                    className="mt-2"
                  />
                </div>

                <Button onClick={handleSave} disabled={saving}>
                  {saving ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
