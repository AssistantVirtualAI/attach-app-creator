import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Palette, Globe, Mail, Lock } from 'lucide-react';
import { ImageUploader } from '@/components/saas/ImageUploader';
import { useOrganization } from '@/context/OrganizationContext';
import { useBillingConfig } from '@/hooks/useBillingConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const colorPresets = [
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Vert', value: '#10B981' },
  { name: 'Orange', value: '#F59E0B' },
  { name: 'Rouge', value: '#EF4444' },
  { name: 'Rose', value: '#EC4899' },
];

const loadingIcons = [
  { name: 'Infinity', value: 'infinity' },
  { name: 'Spinner', value: 'spinner' },
  { name: 'Dots', value: 'dots' },
  { name: 'Pulse', value: 'pulse' },
];

interface WhiteLabelConfig {
  favicon_url: string;
  website_title: string;
  primary_color: string;
  loading_icon: string;
  loading_icon_size: string;
  domain: string;
  backend_domain: string;
  email_domain: string;
  email_sender: string;
  email_sender_name: string;
  email_logo_url: string;
}

export function WhiteLabelTab() {
  const { selectedOrgId, refreshOrganization } = useOrganization();
  const { currentPlan } = useBillingConfig();
  const navigate = useNavigate();
  const [isSaving, setIsSaving] = useState(false);
  const [config, setConfig] = useState<WhiteLabelConfig>({
    favicon_url: '',
    website_title: '',
    primary_color: '#8B5CF6',
    loading_icon: 'infinity',
    loading_icon_size: 'md',
    domain: '',
    backend_domain: '',
    email_domain: '',
    email_sender: '',
    email_sender_name: '',
    email_logo_url: '',
  });

  useEffect(() => {
    if (selectedOrgId) {
      loadOrgData();
    }
  }, [selectedOrgId]);

  const loadOrgData = async () => {
    if (!selectedOrgId) return;
    const { data, error } = await supabase
      .from('organizations')
      .select('*')
      .eq('id', selectedOrgId)
      .single();

    if (!error && data) {
      setConfig({
        favicon_url: data.favicon_url || '',
        website_title: data.website_title || '',
        primary_color: data.primary_color || '#8B5CF6',
        loading_icon: data.loading_icon || 'infinity',
        loading_icon_size: data.loading_icon_size || 'md',
        domain: data.domain || '',
        backend_domain: data.backend_domain || '',
        email_domain: data.email_domain || '',
        email_sender: data.email_sender || '',
        email_sender_name: data.email_sender_name || '',
        email_logo_url: data.email_logo_url || '',
      });
    }
  };

  const isGrowthOrHigher = ['growth', 'ultimate'].includes(currentPlan?.id || '');
  const isUltimatePlan = currentPlan?.id === 'ultimate';

  const handleSave = async () => {
    if (!selectedOrgId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update(config)
        .eq('id', selectedOrgId);

      if (error) throw error;
      toast.success('Configuration sauvegardée');
      refreshOrganization();
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Branding */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-secondary flex items-center justify-center">
              <Palette className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle>Marque Blanche</CardTitle>
              <CardDescription>Personnalisez l'apparence de votre plateforme</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Favicon */}
          <ImageUploader
            label="Favicon"
            currentUrl={config.favicon_url}
            organizationId={selectedOrgId || ''}
            folder="branding"
            onUpload={(url) => setConfig({ ...config, favicon_url: url })}
            onRemove={() => setConfig({ ...config, favicon_url: '' })}
            aspectRatio="favicon"
          />

          {/* Website Title */}
          <div className="space-y-2">
            <Label htmlFor="websiteTitle">Titre du site web</Label>
            <Input
              id="websiteTitle"
              value={config.website_title}
              onChange={(e) => setConfig({ ...config, website_title: e.target.value })}
              placeholder="Mon Application"
              className="bg-background/50"
            />
          </div>

          <Separator />

          {/* Theme Color */}
          <div className="space-y-4">
            <Label>Couleur principale</Label>
            <div className="flex items-center gap-4">
              <Input
                type="color"
                value={config.primary_color}
                onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                className="w-16 h-10 p-1 cursor-pointer"
              />
              <Input
                value={config.primary_color}
                onChange={(e) => setConfig({ ...config, primary_color: e.target.value })}
                className="w-32 font-mono"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {colorPresets.map((preset) => (
                <Button
                  key={preset.value}
                  variant="outline"
                  size="sm"
                  onClick={() => setConfig({ ...config, primary_color: preset.value })}
                  className="gap-2"
                >
                  <div
                    className="w-4 h-4 rounded-full"
                    style={{ backgroundColor: preset.value }}
                  />
                  {preset.name}
                </Button>
              ))}
            </div>
          </div>

          <Separator />

          {/* Loading Icon */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Icône de chargement</Label>
              <Select
                value={config.loading_icon}
                onValueChange={(value) => setConfig({ ...config, loading_icon: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {loadingIcons.map((icon) => (
                    <SelectItem key={icon.value} value={icon.value}>
                      {icon.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Taille de l'icône</Label>
              <Select
                value={config.loading_icon_size}
                onValueChange={(value) => setConfig({ ...config, loading_icon_size: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sm">Petit</SelectItem>
                  <SelectItem value="md">Moyen</SelectItem>
                  <SelectItem value="lg">Grand</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Domains */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Globe className="w-6 h-6 text-primary" />
            <div>
              <CardTitle>Domaines personnalisés</CardTitle>
              <CardDescription>Configurez vos domaines</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frontendDomain">Domaine Frontend</Label>
            <Input
              id="frontendDomain"
              value={config.domain}
              onChange={(e) => setConfig({ ...config, domain: e.target.value })}
              placeholder="app.votredomaine.com"
              className="bg-background/50"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label htmlFor="backendDomain">Domaine Backend</Label>
              {!isUltimatePlan && (
                <Badge variant="secondary" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  Plan Ultimate
                </Badge>
              )}
            </div>
            <Input
              id="backendDomain"
              value={config.backend_domain}
              onChange={(e) => setConfig({ ...config, backend_domain: e.target.value })}
              placeholder="api.votredomaine.com"
              disabled={!isUltimatePlan}
              className="bg-background/50"
            />
          </div>
        </CardContent>
      </Card>

      {/* Email Whitelabeling */}
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Mail className="w-6 h-6 text-primary" />
            <div className="flex items-center gap-2">
              <CardTitle>Email Whitelabeling</CardTitle>
              {!isGrowthOrHigher && (
                <Badge variant="secondary" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  Plan Growth+
                </Badge>
              )}
            </div>
          </div>
          <CardDescription>Personnalisez les emails envoyés à vos clients</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Domaine d'envoi</Label>
              <Input
                value={config.email_domain}
                onChange={(e) => setConfig({ ...config, email_domain: e.target.value })}
                placeholder="mail.votredomaine.com"
                disabled={!isGrowthOrHigher}
                className="bg-background/50"
              />
            </div>
            <div className="space-y-2">
              <Label>Adresse expéditeur</Label>
              <Input
                value={config.email_sender}
                onChange={(e) => setConfig({ ...config, email_sender: e.target.value })}
                placeholder="noreply@votredomaine.com"
                disabled={!isGrowthOrHigher}
                className="bg-background/50"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Nom de l'expéditeur</Label>
            <Input
              value={config.email_sender_name}
              onChange={(e) => setConfig({ ...config, email_sender_name: e.target.value })}
              placeholder="Votre Entreprise"
              disabled={!isGrowthOrHigher}
              className="bg-background/50"
            />
          </div>

          <ImageUploader
            label="Logo Email"
            currentUrl={config.email_logo_url}
            organizationId={selectedOrgId || ''}
            folder="email"
            onUpload={(url) => setConfig({ ...config, email_logo_url: url })}
            onRemove={() => setConfig({ ...config, email_logo_url: '' })}
            aspectRatio="wide"
          />

          {isGrowthOrHigher && (
            <Button variant="outline" onClick={() => navigate('/email-templates')}>
              Gérer les templates email
            </Button>
          )}
        </CardContent>
      </Card>

      <Button onClick={handleSave} disabled={isSaving} className="w-full">
        {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
      </Button>
    </div>
  );
}
