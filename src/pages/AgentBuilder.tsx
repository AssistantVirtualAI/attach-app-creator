import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AgentBuilderSidebar } from '@/components/agent-builder/AgentBuilderSidebar';
import { AgentBuilderCanvas } from '@/components/agent-builder/AgentBuilderCanvas';
import { useAgentBuilder, AgentBuilderConfig } from '@/hooks/useAgentBuilder';
import { useOrganization } from '@/context/OrganizationContext';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ArrowLeft, Save, Sparkles, Eye } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentBuilder() {
  const navigate = useNavigate();
  const { agentId } = useParams<{ agentId?: string }>();
  const { selectedOrgId } = useOrganization();
  const [selectedClientId, setSelectedClientId] = useState('');
  
  const {
    config,
    agentName,
    setAgentName,
    updateConfig,
    saveAgent,
    loadAgent,
    updateAgent,
    isSaving,
  } = useAgentBuilder();

  const isEditMode = !!agentId;

  // Load agent data if editing
  useEffect(() => {
    if (agentId) {
      loadAgent(agentId);
    }
  }, [agentId, loadAgent]);

  // Fetch clients for assignment
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
    enabled: !!selectedOrgId,
  });

  const onDragStart = useCallback((event: React.DragEvent, nodeType: string) => {
    event.dataTransfer.setData('application/agentbuilder', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleConfigChange = useCallback((newConfig: AgentBuilderConfig) => {
    updateConfig(newConfig);
  }, [updateConfig]);

  const handleSave = async () => {
    if (isEditMode && agentId) {
      const success = await updateAgent(agentId);
      if (success) {
        navigate(`/agents/${agentId}/settings`);
      }
    } else {
      const newAgentId = await saveAgent(selectedClientId || undefined);
      if (newAgentId) {
        navigate(`/agents/${newAgentId}/settings`);
      }
    }
  };

  const handlePreview = () => {
    if (!config.systemPrompt) {
      toast.error('Veuillez configurer le System Prompt pour prévisualiser');
      return;
    }
    // Open preview modal or navigate to preview page
    toast.info('Prévisualisation bientôt disponible');
  };

  return (
    <AppLayout>
      <div className="flex flex-col h-[calc(100vh-4rem)]">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/agents')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                {isEditMode ? 'Modifier l\'agent' : 'Agent Builder'}
              </h1>
              <p className="text-sm text-muted-foreground">
                Créez votre agent IA sans code
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={handlePreview}>
              <Eye className="mr-2 h-4 w-4" />
              Prévisualiser
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              <Save className="mr-2 h-4 w-4" />
              {isSaving ? 'Sauvegarde...' : isEditMode ? 'Mettre à jour' : 'Créer l\'agent'}
            </Button>
          </div>
        </div>

        {/* Config Panel */}
        <div className="border-b bg-card p-4">
          <div className="flex items-end gap-4 max-w-3xl">
            <div className="flex-1">
              <Label htmlFor="agentName">Nom de l'agent *</Label>
              <Input
                id="agentName"
                placeholder="Mon Agent IA"
                value={agentName}
                onChange={(e) => setAgentName(e.target.value)}
                className="mt-1"
              />
            </div>
            {!isEditMode && (
              <div className="w-64">
                <Label>Assigner à un client</Label>
                <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Aucun client" />
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
            )}
          </div>
        </div>

        {/* Main Builder Area */}
        <div className="flex flex-1 overflow-hidden">
          <AgentBuilderSidebar onDragStart={onDragStart} />
          <AgentBuilderCanvas onConfigChange={handleConfigChange} />
          
          {/* Config Summary */}
          <div className="w-72 bg-card border-l p-4 overflow-y-auto">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Configuration actuelle</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">System Prompt</span>
                  <span className={config.systemPrompt ? 'text-green-500' : 'text-destructive'}>
                    {config.systemPrompt ? '✓' : '✗'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Premier Message</span>
                  <span className={config.firstMessage ? 'text-green-500' : 'text-muted-foreground'}>
                    {config.firstMessage ? '✓' : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Voix</span>
                  <span className={config.voiceId ? 'text-green-500' : 'text-muted-foreground'}>
                    {config.voiceId ? '✓' : '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base de connaissances</span>
                  <span>{config.knowledgeItems.length} items</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Outils activés</span>
                  <span>{config.enabledTools.length} outils</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Température</span>
                  <span>{config.temperature.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Tokens</span>
                  <span>{config.maxTokens}</span>
                </div>
              </CardContent>
            </Card>

            {config.systemPrompt && (
              <Card className="mt-4">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Aperçu du Prompt</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground line-clamp-6">
                    {config.systemPrompt}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
