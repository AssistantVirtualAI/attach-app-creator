import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { 
  Palette, 
  Upload, 
  Users, 
  Bot, 
  CheckCircle2, 
  ArrowRight, 
  ArrowLeft,
  Sparkles,
  X
} from 'lucide-react';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useOrganization } from '@/context/OrganizationContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';

const STEPS = [
  { id: 1, title: 'Bienvenue', icon: Sparkles },
  { id: 2, title: 'Apparence', icon: Palette },
  { id: 3, title: 'Premier Client', icon: Users },
  { id: 4, title: 'Premier Agent', icon: Bot },
];

const COLOR_PRESETS = [
  { name: 'Violet', value: '#8B5CF6' },
  { name: 'Bleu', value: '#3B82F6' },
  { name: 'Cyan', value: '#06B6D4' },
  { name: 'Vert', value: '#10B981' },
  { name: 'Rose', value: '#EC4899' },
  { name: 'Orange', value: '#F97316' },
];

export function WelcomeModal() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showWelcomeModal, currentStep, setCurrentStep, completeOnboarding, skipOnboarding } = useOnboarding();
  const { selectedOrg, selectedOrgId, refreshOrganization } = useOrganization();
  
  const [primaryColor, setPrimaryColor] = useState('#8B5CF6');
  const [logoUrl, setLogoUrl] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Client form
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientLanguage, setClientLanguage] = useState('fr');
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [createdClientId, setCreatedClientId] = useState<string | null>(null);
  
  // Agent form
  const [agentPlatform, setAgentPlatform] = useState('elevenlabs');
  const [agentName, setAgentName] = useState('');
  const [isCreatingAgent, setIsCreatingAgent] = useState(false);

  const progress = (currentStep / STEPS.length) * 100;

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedOrgId) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${selectedOrgId}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('organization-assets')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('organization-assets')
        .getPublicUrl(fileName);

      setLogoUrl(publicUrl);
      toast.success('Logo téléchargé !');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors du téléchargement');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveAppearance = async () => {
    if (!selectedOrgId) return;

    try {
      const updates: Record<string, any> = { primary_color: primaryColor };
      if (logoUrl) updates.logo_dashboard_url = logoUrl;

      const { error } = await supabase
        .from('organizations')
        .update(updates)
        .eq('id', selectedOrgId);

      if (error) throw error;
      
      await refreshOrganization();
      toast.success('Apparence sauvegardée !');
      setCurrentStep(3);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la sauvegarde');
    }
  };

  const handleCreateClient = async () => {
    if (!clientName.trim() || !clientEmail.trim() || !selectedOrgId) {
      toast.error('Nom et email requis');
      return;
    }

    setIsCreatingClient(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Non authentifié');

      const username = clientName.toLowerCase().replace(/[^a-z0-9]/g, '');

      const { data, error } = await supabase
        .from('clients')
        .insert({
          organization_id: selectedOrgId,
          name: clientName,
          email: clientEmail,
          username,
          login_id: username,
          language: clientLanguage,
          status: 'active',
          created_by: user.id,
        })
        .select('id')
        .single();

      if (error) throw error;

      setCreatedClientId(data.id);
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast.success('Client créé !');
      setCurrentStep(4);
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsCreatingClient(false);
    }
  };

  const handleCreateAgent = async () => {
    if (!agentName.trim() || !selectedOrgId) {
      toast.error('Nom de l\'agent requis');
      return;
    }

    setIsCreatingAgent(true);
    try {
      const { error } = await supabase
        .from('agents')
        .insert({
          organization_id: selectedOrgId,
          name: agentName,
          platform: agentPlatform,
          is_external: true,
          client_id: createdClientId,
        });

      if (error) throw error;

      queryClient.invalidateQueries({ queryKey: ['agents'] });
      toast.success('Agent créé !');
      await completeOnboarding();
      navigate('/agents');
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création');
    } finally {
      setIsCreatingAgent(false);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="text-center space-y-6 py-8">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-accent mx-auto flex items-center justify-center">
              <Sparkles className="w-10 h-10 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-bold mb-2">
                Bienvenue sur AVA Statistics !
              </h3>
              <p className="text-muted-foreground max-w-md mx-auto">
                Configurons votre agence en quelques étapes simples. 
                Vous pourrez personnaliser votre plateforme, créer votre premier client et configurer votre premier agent IA.
              </p>
            </div>
            <div className="bg-accent/10 rounded-lg p-4 text-sm text-muted-foreground">
              <p>🎉 Votre essai gratuit de <strong>7 jours</strong> est activé !</p>
            </div>
            <Button onClick={() => setCurrentStep(2)} className="gap-2">
              Commencer
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label>Logo de l'agence</Label>
                <div className="mt-2 flex items-center gap-4">
                  {logoUrl ? (
                    <img src={logoUrl} alt="Logo" className="w-16 h-16 rounded-lg object-cover" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                      <Upload className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <label className="cursor-pointer">
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleLogoUpload}
                      disabled={isUploading}
                    />
                    <Button variant="outline" size="sm" asChild disabled={isUploading}>
                      <span>{isUploading ? 'Téléchargement...' : 'Choisir un fichier'}</span>
                    </Button>
                  </label>
                </div>
              </div>

              <div>
                <Label>Couleur principale</Label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {COLOR_PRESETS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setPrimaryColor(color.value)}
                      className={`w-10 h-10 rounded-lg transition-all ${
                        primaryColor === color.value 
                          ? 'ring-2 ring-offset-2 ring-primary scale-110' 
                          : 'hover:scale-105'
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.name}
                    />
                  ))}
                  <input
                    type="color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(1)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button onClick={handleSaveAppearance} className="flex-1">
                Continuer
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Créez votre premier client. Il aura accès à un portail dédié pour voir ses conversations et analytics.
            </p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="clientName">Nom du client *</Label>
                <Input
                  id="clientName"
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ex: Entreprise ABC"
                />
              </div>

              <div>
                <Label htmlFor="clientEmail">Email *</Label>
                <Input
                  id="clientEmail"
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="contact@entreprise.com"
                />
              </div>

              <div>
                <Label htmlFor="clientLanguage">Langue</Label>
                <Select value={clientLanguage} onValueChange={setClientLanguage}>
                  <SelectTrigger id="clientLanguage">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Español</SelectItem>
                    <SelectItem value="de">Deutsch</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(2)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button 
                onClick={handleCreateClient} 
                disabled={isCreatingClient || !clientName.trim() || !clientEmail.trim()}
                className="flex-1"
              >
                {isCreatingClient ? 'Création...' : 'Créer le client'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <p className="text-sm text-muted-foreground">
              Dernière étape ! Créez votre premier agent IA. Vous pourrez le configurer en détail ensuite.
            </p>
            
            <div className="space-y-4">
              <div>
                <Label htmlFor="agentPlatform">Plateforme</Label>
                <Select value={agentPlatform} onValueChange={setAgentPlatform}>
                  <SelectTrigger id="agentPlatform">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
                    <SelectItem value="vapi">Vapi</SelectItem>
                    <SelectItem value="retell">Retell AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="agentName">Nom de l'agent *</Label>
                <Input
                  id="agentName"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Ex: Assistant Vocal ABC"
                />
              </div>

              {createdClientId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-accent/10 p-3 rounded-lg">
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                  <span>Sera assigné au client: <strong>{clientName}</strong></span>
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setCurrentStep(3)} className="flex-1">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Retour
              </Button>
              <Button 
                onClick={handleCreateAgent} 
                disabled={isCreatingAgent || !agentName.trim()}
                className="flex-1"
              >
                {isCreatingAgent ? 'Création...' : 'Terminer'}
                <CheckCircle2 className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (!showWelcomeModal) return null;

  return (
    <Dialog open={showWelcomeModal} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              {STEPS[currentStep - 1]?.icon && (
                <span className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  {(() => {
                    const Icon = STEPS[currentStep - 1].icon;
                    return <Icon className="w-4 h-4 text-primary" />;
                  })()}
                </span>
              )}
              {STEPS[currentStep - 1]?.title}
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={skipOnboarding}>
              <X className="w-4 h-4" />
            </Button>
          </div>
          <DialogDescription className="sr-only">
            Étape {currentStep} sur {STEPS.length}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Étape {currentStep}/{STEPS.length}</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <div className="py-4">
          {renderStep()}
        </div>

        <div className="flex items-center justify-center gap-1.5">
          {STEPS.map((step) => (
            <div
              key={step.id}
              className={`w-2 h-2 rounded-full transition-colors ${
                step.id === currentStep
                  ? 'bg-primary'
                  : step.id < currentStep
                  ? 'bg-primary/50'
                  : 'bg-muted'
              }`}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}