import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Building, Copy, Shield, Trash2, Lock, Eye, EyeOff, Brain, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { ImageUploader } from '@/components/saas/ImageUploader';
import { useOrganization } from '@/context/OrganizationContext';
import { useBillingConfig } from '@/hooks/useBillingConfig';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface OrgConfig {
  name: string;
  logo_dashboard_url: string;
  logo_login_url: string;
  gdpr_enabled: boolean;
  hipaa_enabled: boolean;
  api_key: string;
  openai_api_key: string;
}

export function AgencyTab() {
  const { selectedOrg, selectedOrgId, refreshOrganization } = useOrganization();
  const { currentPlan } = useBillingConfig();
  const [isSaving, setIsSaving] = useState(false);
  const [showOpenAIKey, setShowOpenAIKey] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [keyValidation, setKeyValidation] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [config, setConfig] = useState<OrgConfig>({
    name: '',
    logo_dashboard_url: '',
    logo_login_url: '',
    gdpr_enabled: false,
    hipaa_enabled: false,
    api_key: '',
    openai_api_key: '',
  });

  // Load full organization data
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
        name: data.name || '',
        logo_dashboard_url: data.logo_dashboard_url || '',
        logo_login_url: data.logo_login_url || '',
        gdpr_enabled: data.gdpr_enabled || false,
        hipaa_enabled: data.hipaa_enabled || false,
        api_key: data.api_key || '',
        openai_api_key: (data as any).openai_api_key || '',
      });
    }
  };

  const isUltimatePlan = currentPlan?.id === 'ultimate';

  const validateOpenAIKeyFormat = (key: string): boolean => {
    if (!key) return true;
    return key.startsWith('sk-') && key.length >= 20;
  };

  const testOpenAIConnection = async () => {
    if (!config.openai_api_key) {
      toast.error('Veuillez entrer une clé API');
      return;
    }

    if (!validateOpenAIKeyFormat(config.openai_api_key)) {
      toast.error('Format de clé invalide. La clé doit commencer par "sk-"');
      setKeyValidation('invalid');
      return;
    }

    setIsTestingKey(true);
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${config.openai_api_key}`,
        },
      });

      if (response.ok) {
        setKeyValidation('valid');
        toast.success('Connexion OpenAI réussie !');
      } else {
        setKeyValidation('invalid');
        const errorData = await response.json().catch(() => ({}));
        toast.error(errorData.error?.message || 'Clé API invalide');
      }
    } catch (error) {
      setKeyValidation('invalid');
      toast.error('Erreur de connexion à OpenAI');
    } finally {
      setIsTestingKey(false);
    }
  };

  const handleSave = async () => {
    if (!selectedOrgId) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('organizations')
        .update({
          name: config.name,
          logo_dashboard_url: config.logo_dashboard_url,
          logo_login_url: config.logo_login_url,
          gdpr_enabled: config.gdpr_enabled,
          hipaa_enabled: config.hipaa_enabled,
        })
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copié !');
  };

  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Building className="w-6 h-6 text-white" />
            </div>
            <div>
              <CardTitle>Configuration de l'Agence</CardTitle>
              <CardDescription>Paramètres généraux de votre organisation</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Logos */}
          <div className="grid md:grid-cols-2 gap-6">
            <ImageUploader
              label="Logo Dashboard"
              currentUrl={config.logo_dashboard_url}
              organizationId={selectedOrgId || ''}
              folder="logos"
              onUpload={(url) => setConfig({ ...config, logo_dashboard_url: url })}
              onRemove={() => setConfig({ ...config, logo_dashboard_url: '' })}
              aspectRatio="wide"
            />
            <ImageUploader
              label="Logo Page de Connexion"
              currentUrl={config.logo_login_url}
              organizationId={selectedOrgId || ''}
              folder="logos"
              onUpload={(url) => setConfig({ ...config, logo_login_url: url })}
              onRemove={() => setConfig({ ...config, logo_login_url: '' })}
              aspectRatio="wide"
            />
          </div>

          <Separator />

          {/* Nom agence */}
          <div className="space-y-2">
            <Label htmlFor="agencyName">Nom de l'agence</Label>
            <Input
              id="agencyName"
              value={config.name}
              onChange={(e) => setConfig({ ...config, name: e.target.value })}
              className="bg-background/50"
            />
          </div>

          {/* Workspace ID */}
          <div className="space-y-2">
            <Label>Workspace ID</Label>
            <div className="flex gap-2">
              <Input
                value={selectedOrgId || ''}
                disabled
                className="bg-muted font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => copyToClipboard(selectedOrgId || '')}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ChatDash API Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label>ChatDash API Key</Label>
              {!isUltimatePlan && (
                <Badge variant="secondary" className="text-xs">
                  <Lock className="w-3 h-3 mr-1" />
                  Plan Ultimate
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={config.api_key || '••••••••••••••••'}
                disabled
                className="bg-muted font-mono text-sm"
              />
              {isUltimatePlan && config.api_key && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(config.api_key)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>

          <Separator />

          {/* OpenAI API Key */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Brain className="w-4 h-4 text-green-500" />
              <Label>Clé API OpenAI</Label>
              <Badge variant="outline" className="text-xs bg-green-500/10 text-green-500 border-green-500/30">
                Optionnel
              </Badge>
              {keyValidation === 'valid' && (
                <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Validée
                </Badge>
              )}
              {keyValidation === 'invalid' && (
                <Badge variant="destructive">
                  <XCircle className="w-3 h-3 mr-1" />
                  Invalide
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mb-2">
              Utilisez votre propre clé OpenAI pour des fonctionnalités IA avancées
            </p>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showOpenAIKey ? 'text' : 'password'}
                  value={config.openai_api_key}
                  onChange={(e) => {
                    setConfig({ ...config, openai_api_key: e.target.value });
                    setKeyValidation('idle');
                  }}
                  placeholder="sk-..."
                  className={`bg-background/50 pr-10 font-mono text-sm ${
                    config.openai_api_key && !validateOpenAIKeyFormat(config.openai_api_key)
                      ? 'border-destructive'
                      : ''
                  }`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowOpenAIKey(!showOpenAIKey)}
                >
                  {showOpenAIKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              <Button
                variant="outline"
                onClick={testOpenAIConnection}
                disabled={isTestingKey || !config.openai_api_key}
              >
                {isTestingKey ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  'Tester'
                )}
              </Button>
              {config.openai_api_key && (
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => copyToClipboard(config.openai_api_key)}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              )}
            </div>
            {config.openai_api_key && !validateOpenAIKeyFormat(config.openai_api_key) && (
              <p className="text-xs text-destructive">
                La clé doit commencer par "sk-" et contenir au moins 20 caractères
              </p>
            )}
          </div>

          <Separator />

          {/* GDPR Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <Label>Conformité GDPR</Label>
              <p className="text-sm text-muted-foreground">
                Activer les fonctionnalités de conformité GDPR
              </p>
            </div>
            <Switch
              checked={config.gdpr_enabled}
              onCheckedChange={(checked) => setConfig({ ...config, gdpr_enabled: checked })}
            />
          </div>

          {/* HIPAA Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label>Conformité HIPAA</Label>
                <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-500 border-blue-500/30">
                  <Shield className="w-3 h-3 mr-1" />
                  Get HIPAA Compliance
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Activer les fonctionnalités de conformité HIPAA pour les données de santé
              </p>
            </div>
            <Switch
              checked={config.hipaa_enabled}
              onCheckedChange={(checked) => setConfig({ ...config, hipaa_enabled: checked })}
            />
          </div>

          <Button onClick={handleSave} disabled={isSaving} className="w-full">
            {isSaving ? 'Enregistrement...' : 'Enregistrer les modifications'}
          </Button>
        </CardContent>
      </Card>

      {/* Zone Danger */}
      <Card className="glass-card border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Zone de Danger
          </CardTitle>
          <CardDescription>Actions irréversibles</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" className="w-full">
            Supprimer l'agence
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
