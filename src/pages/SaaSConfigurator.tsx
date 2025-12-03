import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Palette, Mail, Globe, FileText, Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/context/OrganizationContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { ImageUploader } from '@/components/saas/ImageUploader';
import { supabase } from '@/integrations/supabase/client';

export default function SaaSConfigurator() {
  const { toast } = useToast();
  const { selectedOrg: selectedOrganization, refreshOrganizations } = useOrganization();
  const { updateOrganization, isLoading: isUpdating } = useOrganizations();
  
  const [config, setConfig] = useState({
    name: '',
    primary_color: '#8B5CF6',
    domain: '',
    backend_domain: '',
    logo_dashboard_url: '',
    logo_login_url: '',
    favicon_url: '',
    email_logo_url: '',
    website_title: '',
    email_domain: '',
    email_sender: '',
    email_sender_name: '',
    gdpr_enabled: false,
    hipaa_enabled: false,
  });

  useEffect(() => {
    if (selectedOrganization) {
      setConfig({
        name: selectedOrganization.name || '',
        primary_color: (selectedOrganization as any).primary_color || '#8B5CF6',
        domain: (selectedOrganization as any).domain || '',
        backend_domain: (selectedOrganization as any).backend_domain || '',
        logo_dashboard_url: (selectedOrganization as any).logo_dashboard_url || '',
        logo_login_url: (selectedOrganization as any).logo_login_url || '',
        favicon_url: (selectedOrganization as any).favicon_url || '',
        email_logo_url: (selectedOrganization as any).email_logo_url || '',
        website_title: (selectedOrganization as any).website_title || '',
        email_domain: (selectedOrganization as any).email_domain || '',
        email_sender: (selectedOrganization as any).email_sender || '',
        email_sender_name: (selectedOrganization as any).email_sender_name || '',
        gdpr_enabled: (selectedOrganization as any).gdpr_enabled || false,
        hipaa_enabled: (selectedOrganization as any).hipaa_enabled || false,
      });
    }
  }, [selectedOrganization]);

  const handleSave = async () => {
    if (!selectedOrganization?.id) return;

    try {
      await updateOrganization({
        organizationId: selectedOrganization.id,
        data: config,
      });
      await refreshOrganizations();
      toast({
        title: 'Configuration sauvegardée',
        description: 'Les paramètres ont été mis à jour avec succès',
      });
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const updateConfig = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (!selectedOrganization) {
    return (
      <AppLayout>
        <div className="p-8 flex items-center justify-center h-full">
          <p className="text-muted-foreground">Sélectionnez une organisation</p>
        </div>
      </AppLayout>
    );
  }

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
            <TabsTrigger value="legal">Légal</TabsTrigger>
            <TabsTrigger value="compliance">Conformité</TabsTrigger>
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
                <div className="space-y-2">
                  <Label htmlFor="orgName">Nom de l'organisation</Label>
                  <Input
                    id="orgName"
                    value={config.name}
                    onChange={(e) => updateConfig('name', e.target.value)}
                    placeholder="Mon Entreprise"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="websiteTitle">Titre du site</Label>
                  <Input
                    id="websiteTitle"
                    value={config.website_title}
                    onChange={(e) => updateConfig('website_title', e.target.value)}
                    placeholder="Mon Dashboard - Gestion des agents IA"
                  />
                </div>

                <Separator />

                <ImageUploader
                  label="Logo du tableau de bord"
                  currentUrl={config.logo_dashboard_url}
                  organizationId={selectedOrganization.id}
                  folder="logos"
                  onUpload={(url) => updateConfig('logo_dashboard_url', url)}
                  onRemove={() => updateConfig('logo_dashboard_url', '')}
                  aspectRatio="wide"
                />

                <ImageUploader
                  label="Logo de la page de connexion"
                  currentUrl={config.logo_login_url}
                  organizationId={selectedOrganization.id}
                  folder="logos"
                  onUpload={(url) => updateConfig('logo_login_url', url)}
                  onRemove={() => updateConfig('logo_login_url', '')}
                />

                <ImageUploader
                  label="Favicon"
                  currentUrl={config.favicon_url}
                  organizationId={selectedOrganization.id}
                  folder="favicons"
                  onUpload={(url) => updateConfig('favicon_url', url)}
                  onRemove={() => updateConfig('favicon_url', '')}
                  aspectRatio="favicon"
                />

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="primaryColor">Couleur primaire</Label>
                  <div className="flex gap-4">
                    <Input
                      id="primaryColor"
                      type="color"
                      value={config.primary_color}
                      onChange={(e) => updateConfig('primary_color', e.target.value)}
                      className="w-20 h-10 p-1"
                    />
                    <Input
                      value={config.primary_color}
                      onChange={(e) => updateConfig('primary_color', e.target.value)}
                      placeholder="#8B5CF6"
                      className="flex-1"
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Sauvegarde...
                    </>
                  ) : (
                    'Sauvegarder'
                  )}
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
                      Configurez vos noms de domaine
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="domain">Domaine frontend</Label>
                  <Input
                    id="domain"
                    value={config.domain}
                    onChange={(e) => updateConfig('domain', e.target.value)}
                    placeholder="app.votre-domaine.com"
                  />
                  <p className="text-xs text-muted-foreground">
                    Pointez un enregistrement CNAME vers: app.avastatistic.lovable.app
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="backendDomain">Domaine backend (API)</Label>
                  <Input
                    id="backendDomain"
                    value={config.backend_domain}
                    onChange={(e) => updateConfig('backend_domain', e.target.value)}
                    placeholder="api.votre-domaine.com"
                  />
                </div>

                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
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
                    <CardTitle>Configuration Email</CardTitle>
                    <CardDescription>
                      Paramètres d'envoi d'emails
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <ImageUploader
                  label="Logo pour les emails"
                  currentUrl={config.email_logo_url}
                  organizationId={selectedOrganization.id}
                  folder="email"
                  onUpload={(url) => updateConfig('email_logo_url', url)}
                  onRemove={() => updateConfig('email_logo_url', '')}
                  aspectRatio="wide"
                />

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="emailDomain">Domaine email</Label>
                  <Input
                    id="emailDomain"
                    value={config.email_domain}
                    onChange={(e) => updateConfig('email_domain', e.target.value)}
                    placeholder="mail.votre-domaine.com"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="emailSender">Email expéditeur</Label>
                    <Input
                      id="emailSender"
                      value={config.email_sender}
                      onChange={(e) => updateConfig('email_sender', e.target.value)}
                      placeholder="noreply@votre-domaine.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="emailSenderName">Nom expéditeur</Label>
                    <Input
                      id="emailSenderName"
                      value={config.email_sender_name}
                      onChange={(e) => updateConfig('email_sender_name', e.target.value)}
                      placeholder="Mon Entreprise"
                    />
                  </div>
                </div>

                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
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
                <div className="space-y-2">
                  <Label htmlFor="privacy">Politique de confidentialité (URL)</Label>
                  <Input
                    id="privacy"
                    placeholder="https://votre-site.com/privacy"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="terms">Conditions d'utilisation (URL)</Label>
                  <Input
                    id="terms"
                    placeholder="https://votre-site.com/terms"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="footerText">Texte du footer</Label>
                  <Textarea
                    id="footerText"
                    placeholder="© 2025 Votre Entreprise. Tous droits réservés."
                  />
                </div>

                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="compliance" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Shield className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Conformité</CardTitle>
                    <CardDescription>
                      Activez les fonctionnalités de conformité
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label>RGPD / GDPR</Label>
                    <p className="text-sm text-muted-foreground">
                      Activer les fonctionnalités de conformité RGPD (consentement, droit à l'oubli, export de données)
                    </p>
                  </div>
                  <Switch
                    checked={config.gdpr_enabled}
                    onCheckedChange={(checked) => updateConfig('gdpr_enabled', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div className="space-y-1">
                    <Label>HIPAA</Label>
                    <p className="text-sm text-muted-foreground">
                      Activer les fonctionnalités de conformité HIPAA (chiffrement renforcé, audit logs)
                    </p>
                  </div>
                  <Switch
                    checked={config.hipaa_enabled}
                    onCheckedChange={(checked) => updateConfig('hipaa_enabled', checked)}
                  />
                </div>

                <Button onClick={handleSave} disabled={isUpdating}>
                  {isUpdating ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
