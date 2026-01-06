import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface QuickPromptModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agentId: string;
  agentName: string;
  platform: string;
  platformAgentId: string | null;
}

const getPlatformDisplayName = (platform: string): string => {
  switch (platform) {
    case 'elevenlabs': return 'ElevenLabs';
    case 'retell': return 'Retell AI';
    case 'vapi': return 'Vapi';
    default: return platform;
  }
};

export function QuickPromptModal({ 
  open, 
  onOpenChange, 
  agentId, 
  agentName, 
  platform, 
  platformAgentId 
}: QuickPromptModalProps) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const supportedPlatforms = ['elevenlabs', 'retell', 'vapi'];
  const isSupported = supportedPlatforms.includes(platform);

  // Fetch agent config from platform
  const { data: agentConfig, isLoading, error } = useQuery({
    queryKey: ['quick-prompt-config', agentId, platformAgentId, platform],
    queryFn: async () => {
      if (!platformAgentId) return null;

      // ElevenLabs
      if (platform === 'elevenlabs') {
        const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
          body: { action: 'get', agentId: platformAgentId }
        });
        if (error) throw error;
        return { platform: 'elevenlabs', data };
      }

      // Retell AI
      if (platform === 'retell') {
        const { data, error } = await supabase.functions.invoke('retell-proxy', {
          body: { action: 'getAgent', retellAgentId: platformAgentId }
        });
        if (error) throw error;
        return { platform: 'retell', data };
      }

      // Vapi
      if (platform === 'vapi') {
        const { data, error } = await supabase.functions.invoke('vapi-proxy', {
          body: { action: 'getAssistant', assistantId: platformAgentId }
        });
        if (error) throw error;
        return { platform: 'vapi', data };
      }

      return null;
    },
    enabled: open && !!platformAgentId && isSupported,
  });

  // Initialize form with fetched data based on platform
  useEffect(() => {
    if (!agentConfig) return;

    if (agentConfig.platform === 'elevenlabs') {
      const agentData = agentConfig.data?.agent;
      const conversationConfig = agentData?.conversation_config || {};
      const agentConf = conversationConfig.agent || {};
      setPrompt(agentConf.prompt?.prompt || '');
      setFirstMessage(agentConf.first_message || '');
    }

    if (agentConfig.platform === 'retell') {
      const agent = agentConfig.data?.data || agentConfig.data;
      // Retell stocke le prompt dans agent_prompt ou general_prompt
      setPrompt(agent?.agent_prompt || agent?.general_prompt || agent?.llm?.general_prompt || '');
      setFirstMessage(agent?.begin_message || agent?.llm?.begin_message || '');
    }

    if (agentConfig.platform === 'vapi') {
      const assistant = agentConfig.data?.data || agentConfig.data;
      // Vapi stocke le prompt dans model.messages
      const systemMessage = assistant?.model?.messages?.find((m: any) => m.role === 'system');
      setPrompt(systemMessage?.content || '');
      setFirstMessage(assistant?.firstMessage || '');
    }

    setHasChanges(false);
  }, [agentConfig]);

  // Update mutation - multi-platform
  const updateMutation = useMutation({
    mutationFn: async () => {
      // ElevenLabs
      if (platform === 'elevenlabs') {
        const { error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
          body: { action: 'update_prompt', agentId: platformAgentId, prompt, firstMessage }
        });
        if (error) throw error;
      }

      // Retell AI
      if (platform === 'retell') {
        const { error } = await supabase.functions.invoke('retell-proxy', {
          body: { 
            action: 'updateAgent', 
            retellAgentId: platformAgentId,
            config: { 
              agent_prompt: prompt, 
              begin_message: firstMessage || undefined 
            }
          }
        });
        if (error) throw error;
      }

      // Vapi
      if (platform === 'vapi') {
        const { error } = await supabase.functions.invoke('vapi-proxy', {
          body: { 
            action: 'updateAssistant', 
            assistantId: platformAgentId,
            config: { 
              model: { 
                messages: [{ role: 'system', content: prompt }] 
              },
              firstMessage: firstMessage || undefined 
            }
          }
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(`Prompt synchronisé avec ${getPlatformDisplayName(platform)}`);
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['quick-prompt-config', agentId] });
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agentId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  });

  // Plateforme non supportée
  if (!isSupported) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Modifier le Prompt - {agentName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              La modification du prompt n'est pas disponible pour la plateforme "{platform}".
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Plateformes supportées : ElevenLabs, Retell AI, Vapi
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier le Prompt - {agentName}
            <Badge variant="outline" className="ml-2 text-primary border-primary/50">
              {getPlatformDisplayName(platform)}
            </Badge>
            {hasChanges && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                Non sauvegardé
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Modifiez le prompt et le premier message. Les modifications sont synchronisées avec {getPlatformDisplayName(platform)}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement depuis {getPlatformDisplayName(platform)}...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive">Erreur de connexion à {getPlatformDisplayName(platform)}</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vérifiez la configuration de l'agent et la clé API.
            </p>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="quick-prompt">Prompt Système</Label>
              <Textarea
                id="quick-prompt"
                value={prompt}
                onChange={(e) => {
                  setPrompt(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Instructions pour l'agent..."
                className="min-h-[200px] font-mono text-sm bg-muted/30 border-border"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="quick-first-message">Premier Message</Label>
              <Textarea
                id="quick-first-message"
                value={firstMessage}
                onChange={(e) => {
                  setFirstMessage(e.target.value);
                  setHasChanges(true);
                }}
                placeholder="Bonjour ! Comment puis-je vous aider ?"
                className="min-h-[80px] bg-muted/30 border-border"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-border">
              <Button
                variant="outline"
                onClick={() => queryClient.invalidateQueries({ queryKey: ['quick-prompt-config', agentId] })}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Rafraîchir
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Annuler
                </Button>
                <Button
                  onClick={() => updateMutation.mutate()}
                  disabled={updateMutation.isPending || !hasChanges}
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Sauvegarder & Sync
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
