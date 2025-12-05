import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ChevronLeft, ChevronRight, Info, ExternalLink } from 'lucide-react';
import { useOrganization } from '@/context/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { PlatformBadge } from './PlatformBadge';

const PLATFORMS = [
  { value: 'voiceflow', label: 'Voiceflow' },
  { value: 'openai', label: 'OpenAI' },
  { value: 'botpress', label: 'Botpress' },
  { value: 'vectorshift', label: 'VectorShift' },
  { value: 'flowise', label: 'Flowise' },
  { value: 'vapi', label: 'Vapi' },
  { value: 'retell', label: 'Retell AI' },
  { value: 'elevenlabs', label: 'ElevenLabs' },
  { value: 'n8n', label: 'n8n' },
  { value: 'custom', label: 'Custom' },
];

interface AddAgentModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function AddAgentModal({ open, onOpenChange, onSuccess }: AddAgentModalProps) {
  const navigate = useNavigate();
  const { selectedOrgId } = useOrganization();
  const [step, setStep] = useState(1);
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [selectedIntegration, setSelectedIntegration] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentId, setAgentId] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const { data: integrations } = useQuery({
    queryKey: ['integrations', selectedOrgId, selectedPlatform],
    queryFn: async () => {
      if (!selectedOrgId || !selectedPlatform) return [];
      
      const { data, error } = await supabase
        .from('organization_integrations')
        .select('*')
        .eq('organization_id', selectedOrgId)
        .eq('platform', selectedPlatform)
        .eq('is_active', true);

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId && !!selectedPlatform && step === 2,
  });

  const { data: clients } = useQuery({
    queryKey: ['clients', selectedOrgId],
    queryFn: async () => {
      if (!selectedOrgId) return [];
      
      const { data, error } = await supabase
        .from('clients')
        .select('id, name')
        .eq('organization_id', selectedOrgId)
        .eq('status', 'active')
        .order('name');

      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedOrgId && step === 3,
  });

  const resetModal = () => {
    setStep(1);
    setSelectedPlatform('');
    setSelectedIntegration('');
    setSelectedClientId('');
    setAgentName('');
    setAgentId('');
    setIsCreating(false);
  };

  const handleClose = () => {
    resetModal();
    onOpenChange(false);
  };

  const handleCreateAgent = async () => {
    if (!selectedOrgId || !selectedIntegration || !agentId.trim()) {
      toast.error('Veuillez remplir tous les champs requis');
      return;
    }

    setIsCreating(true);
    try {
      const finalName = agentName.trim() || `Agent ${selectedPlatform} ${Date.now()}`;

      const { data: newAgent, error } = await supabase
        .from('agents')
        .insert({
          organization_id: selectedOrgId,
          name: finalName,
          platform: selectedPlatform,
          is_external: true,
          client_id: selectedClientId || null,
          config: {
            integration_id: selectedIntegration,
            agent_id: agentId.trim(),
          },
        })
        .select('id')
        .single();

      if (error) throw error;

      toast.success('Agent créé avec succès !');
      handleClose();
      onSuccess();
      
      // Redirect to agent settings page
      if (newAgent?.id) {
        navigate(`/agents/${newAgent.id}/settings`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Erreur lors de la création de l\'agent');
    } finally {
      setIsCreating(false);
    }
  };

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="platform">Sélectionnez une plateforme</Label>
        <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
          <SelectTrigger id="platform">
            <SelectValue placeholder="Choisir une plateforme..." />
          </SelectTrigger>
          <SelectContent>
            {PLATFORMS.map((platform) => (
              <SelectItem key={platform.value} value={platform.value}>
                {platform.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <Button
        onClick={() => setStep(2)}
        disabled={!selectedPlatform}
        className="w-full"
      >
        Suivant
        <ChevronRight className="ml-2 h-4 w-4" />
      </Button>
    </div>
  );

  const renderStep2 = () => {
    const hasIntegrations = integrations && integrations.length > 0;

    return (
      <div className="space-y-4">
        {!hasIntegrations ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p>Aucune intégration {PLATFORMS.find(p => p.value === selectedPlatform)?.label} configurée.</p>
                <p className="text-sm">Veuillez d'abord ajouter une intégration dans la page Intégrations.</p>
                <Link to="/integrations?from=agents">
                  <Button variant="outline" size="sm" className="mt-2">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Aller aux Intégrations
                  </Button>
                </Link>
              </div>
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="integration">Sélectionnez une intégration</Label>
            <Select value={selectedIntegration} onValueChange={setSelectedIntegration}>
              <SelectTrigger id="integration">
                <SelectValue placeholder="Choisir une intégration..." />
              </SelectTrigger>
                  <SelectContent>
                    {integrations.map((integration) => (
                      <SelectItem key={integration.id} value={integration.id}>
                        {integration.platform.toUpperCase()} - {new Date(integration.created_at).toLocaleDateString('fr-FR')}
                      </SelectItem>
                    ))}
                  </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setStep(1)}
            className="flex-1"
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>
          {hasIntegrations && (
            <Button
              onClick={() => setStep(3)}
              disabled={!selectedIntegration}
              className="flex-1"
            >
              Suivant
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    );
  };

  const renderStep3 = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="agentName">Nom de l'agent (optionnel)</Label>
        <Input
          id="agentName"
          placeholder="Ex: AVA Assistant Client"
          value={agentName}
          onChange={(e) => setAgentName(e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="agentId">
          Agent ID <span className="text-destructive">*</span>
        </Label>
        <Input
          id="agentId"
          placeholder="Ex: ag_123abc ou agent_xyz"
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
          required
        />
        <p className="text-xs text-muted-foreground">
          Trouvez cet ID dans le dashboard de {PLATFORMS.find(p => p.value === selectedPlatform)?.label}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="clientId">Assigner à un client (optionnel)</Label>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger id="clientId">
            <SelectValue placeholder="Aucun client assigné" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Aucun</SelectItem>
            {clients?.map((client) => (
              <SelectItem key={client.id} value={client.id}>
                {client.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        <Button
          variant="outline"
          onClick={() => setStep(2)}
          className="flex-1"
          disabled={isCreating}
        >
          <ChevronLeft className="mr-2 h-4 w-4" />
          Retour
        </Button>
        <Button
          onClick={handleCreateAgent}
          disabled={!agentId.trim() || isCreating}
          className="flex-1"
        >
          {isCreating ? 'Création...' : 'Créer l\'agent'}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            Nouvel Agent - Étape {step}/3
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
          {step === 3 && renderStep3()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
