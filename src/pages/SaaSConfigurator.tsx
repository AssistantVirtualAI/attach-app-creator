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
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Palette, Mail, Globe, FileText, Shield, Loader2, CreditCard, AlertCircle, DollarSign, Check, X, Bot, Phone, MessageSquare, Headphones, ShoppingCart, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useOrganization } from '@/context/OrganizationContext';
import { useOrganizations } from '@/hooks/useOrganizations';
import { useBillingConfig } from '@/hooks/useBillingConfig';
import { ImageUploader } from '@/components/saas/ImageUploader';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  interval: 'month' | 'year';
  features: string[];
  clientLimit: number;
  isPopular?: boolean;
}

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  systemPrompt: string;
  features: string[];
  isActive: boolean;
}

export default function SaaSConfigurator() {
  const { toast } = useToast();
  const { selectedOrg: selectedOrganization, refreshOrganization } = useOrganization();
  const { updateOrganization, isLoading: isUpdating } = useOrganizations();
  const { billingConfig, isLoading: billingLoading } = useBillingConfig();
  
  const isStripeConnected = !!billingConfig?.stripe_customer_id;

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

  const [pricingPlans, setPricingPlans] = useState<PricingPlan[]>([
    {
      id: 'starter',
      name: 'Starter',
      price: 19,
      interval: 'month',
      features: ['3 clients', 'Support email', 'Analytics de base'],
      clientLimit: 3,
    },
    {
      id: 'growth',
      name: 'Growth',
      price: 49,
      interval: 'month',
      features: ['10 clients', 'Support prioritaire', 'Analytics avancés', 'White-label email'],
      clientLimit: 10,
      isPopular: true,
    },
    {
      id: 'ultimate',
      name: 'Ultimate',
      price: 149,
      interval: 'month',
      features: ['Clients illimités', 'Support dédié', 'API accès', 'Domaine personnalisé', 'HIPAA'],
      clientLimit: -1,
    },
  ]);

  const [editingPlan, setEditingPlan] = useState<string | null>(null);

  const [agentTemplates, setAgentTemplates] = useState<AgentTemplate[]>([
    {
      id: 'customer-support',
      name: 'Support Client',
      description: 'Agent spécialisé dans le support client et la résolution de problèmes',
      icon: <Headphones className="w-6 h-6" />,
      category: 'Support',
      systemPrompt: 'Tu es un agent de support client professionnel et empathique. Aide les utilisateurs à résoudre leurs problèmes de manière efficace et courtoise.',
      features: ['FAQ automatique', 'Escalade tickets', 'Historique client'],
      isActive: true,
    },
    {
      id: 'sales-assistant',
      name: 'Assistant Commercial',
      description: 'Agent conçu pour qualifier les leads et accompagner le processus de vente',
      icon: <ShoppingCart className="w-6 h-6" />,
      category: 'Ventes',
      systemPrompt: 'Tu es un assistant commercial expert. Qualifie les prospects, présente les produits et guide vers l\'achat.',
      features: ['Qualification leads', 'Présentation produits', 'Suivi devis'],
      isActive: true,
    },
    {
      id: 'appointment-scheduler',
      name: 'Planificateur RDV',
      description: 'Agent spécialisé dans la prise et gestion de rendez-vous',
      icon: <Calendar className="w-6 h-6" />,
      category: 'Planification',
      systemPrompt: 'Tu es un assistant de planification. Aide les utilisateurs à trouver et réserver des créneaux de rendez-vous disponibles.',
      features: ['Calendrier intégré', 'Rappels automatiques', 'Gestion conflits'],
      isActive: false,
    },
    {
      id: 'general-assistant',
      name: 'Assistant Général',
      description: 'Agent polyvalent pour répondre aux questions générales',
      icon: <MessageSquare className="w-6 h-6" />,
      category: 'Général',
      systemPrompt: 'Tu es un assistant virtuel polyvalent. Réponds aux questions des utilisateurs de manière claire et utile.',
      features: ['Multi-langues', 'Base de connaissances', 'Personnalisable'],
      isActive: true,
    },
    {
      id: 'phone-receptionist',
      name: 'Réceptionniste Téléphonique',
      description: 'Agent vocal pour gérer les appels entrants',
      icon: <Phone className="w-6 h-6" />,
      category: 'Téléphonie',
      systemPrompt: 'Tu es un réceptionniste téléphonique professionnel. Accueille les appelants, dirige les appels et prends les messages.',
      features: ['Transfert d\'appels', 'Prise de messages', 'IVR intelligent'],
      isActive: false,
    },
  ]);

  const toggleTemplate = (templateId: string) => {
    setAgentTemplates(templates =>
      templates.map(t => t.id === templateId ? { ...t, isActive: !t.isActive } : t)
    );
  };

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
      await refreshOrganization();
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

  const updatePlan = (planId: string, field: keyof PricingPlan, value: any) => {
    setPricingPlans(plans => 
      plans.map(p => p.id === planId ? { ...p, [field]: value } : p)
    );
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

        {/* Stripe Prerequisite Check */}
        {!billingLoading && !isStripeConnected && (
          <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
            <AlertCircle className="h-4 w-4 text-yellow-500" />
            <AlertTitle className="text-yellow-500">Prérequis : Stripe requis</AlertTitle>
            <AlertDescription className="text-yellow-500/80">
              Connectez-vous à Stripe pour débloquer toutes les fonctionnalités de configuration SaaS, 
              notamment la gestion des plans tarifaires personnalisés.
              <Link to="/stripe-billing" className="ml-2 underline hover:no-underline">
                Connecter Stripe →
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="branding" className="space-y-6">
          <TabsList className="grid w-full grid-cols-7">
            <TabsTrigger value="branding">Marque</TabsTrigger>
            <TabsTrigger value="domain">Domaine</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="pricing" disabled={!isStripeConnected}>
              Plans
            </TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
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

          <TabsContent value="pricing" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <DollarSign className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Plans tarifaires</CardTitle>
                    <CardDescription>
                      Configurez les plans proposés à vos clients
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {pricingPlans.map((plan) => (
                    <Card 
                      key={plan.id} 
                      className={`relative ${plan.isPopular ? 'border-primary ring-2 ring-primary/20' : ''}`}
                    >
                      {plan.isPopular && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                          Populaire
                        </Badge>
                      )}
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between">
                          <Input
                            value={plan.name}
                            onChange={(e) => updatePlan(plan.id, 'name', e.target.value)}
                            className="font-bold text-lg h-auto py-1 px-2"
                          />
                        </CardTitle>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-bold">€</span>
                          <Input
                            type="number"
                            value={plan.price}
                            onChange={(e) => updatePlan(plan.id, 'price', Number(e.target.value))}
                            className="w-20 text-3xl font-bold h-auto py-1 px-2"
                          />
                          <span className="text-muted-foreground">/mois</span>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="space-y-2">
                          <Label className="text-xs">Limite de clients</Label>
                          <Input
                            type="number"
                            value={plan.clientLimit === -1 ? '' : plan.clientLimit}
                            placeholder="Illimité"
                            onChange={(e) => updatePlan(plan.id, 'clientLimit', e.target.value ? Number(e.target.value) : -1)}
                          />
                        </div>
                        
                        <div className="space-y-2">
                          <Label className="text-xs">Fonctionnalités (une par ligne)</Label>
                          <Textarea
                            value={plan.features.join('\n')}
                            onChange={(e) => updatePlan(plan.id, 'features', e.target.value.split('\n').filter(f => f.trim()))}
                            rows={4}
                            className="text-sm"
                          />
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch
                            checked={plan.isPopular || false}
                            onCheckedChange={(checked) => {
                              // Only one can be popular
                              setPricingPlans(plans => 
                                plans.map(p => ({ ...p, isPopular: p.id === plan.id ? checked : false }))
                              );
                            }}
                          />
                          <Label className="text-sm">Plan populaire</Label>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <Button onClick={() => {
                    toast({
                      title: 'Plans sauvegardés',
                      description: 'La configuration des plans a été enregistrée',
                    });
                  }}>
                    Sauvegarder les plans
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6">
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <Bot className="w-6 h-6 text-primary" />
                  <div>
                    <CardTitle>Templates d'agents</CardTitle>
                    <CardDescription>
                      Activez les templates prédéfinis pour vos clients
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {agentTemplates.map((template) => (
                    <Card 
                      key={template.id}
                      className={`relative transition-all duration-200 ${
                        template.isActive 
                          ? 'border-primary/50 bg-primary/5' 
                          : 'border-border/50 opacity-60'
                      }`}
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                            template.isActive 
                              ? 'bg-primary/20 text-primary' 
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {template.icon}
                          </div>
                          <Switch
                            checked={template.isActive}
                            onCheckedChange={() => toggleTemplate(template.id)}
                          />
                        </div>
                        <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                        <Badge variant="outline" className="w-fit text-xs">
                          {template.category}
                        </Badge>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">
                          {template.description}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {template.features.map((feature, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {feature}
                            </Badge>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Separator className="my-6" />

                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {agentTemplates.filter(t => t.isActive).length} template(s) actif(s)
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Les clients pourront utiliser ces templates pour créer leurs agents
                    </p>
                  </div>
                  <Button onClick={() => {
                    toast({
                      title: 'Templates sauvegardés',
                      description: 'La configuration des templates a été enregistrée',
                    });
                  }}>
                    Sauvegarder les templates
                  </Button>
                </div>
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