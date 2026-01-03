import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save, RefreshCw, ExternalLink, AlertCircle } from 'lucide-react';
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

  // Fetch agent config from ElevenLabs
  const { data: agentConfig, isLoading, error } = useQuery({
    queryKey: ['quick-prompt-config', agentId, platformAgentId],
    queryFn: async () => {
      if (!platformAgentId || platform !== 'elevenlabs') return null;

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get',
          agentId: platformAgentId
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: open && !!platformAgentId && platform === 'elevenlabs',
  });

  // Initialize form with fetched data
  useEffect(() => {
    if (agentConfig?.agent) {
      const agentData = agentConfig.agent;
      const conversationConfig = agentData.conversation_config || {};
      const agentConf = conversationConfig.agent || {};
      
      setPrompt(agentConf.prompt?.prompt || '');
      setFirstMessage(agentConf.first_message || '');
      setHasChanges(false);
    }
  }, [agentConfig]);

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'update_prompt',
          agentId: platformAgentId,
          prompt,
          firstMessage
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Prompt synchronisé avec ElevenLabs');
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ['quick-prompt-config', agentId] });
      queryClient.invalidateQueries({ queryKey: ['elevenlabs-agent-config', agentId] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Erreur lors de la mise à jour');
    }
  });

  if (platform !== 'elevenlabs') {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier le Prompt - {agentName}</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              La modification du prompt est disponible uniquement pour les agents ElevenLabs.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Modifier le Prompt - {agentName}
            {hasChanges && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">
                Non sauvegardé
              </Badge>
            )}
          </DialogTitle>
          <DialogDescription>
            Modifiez le prompt et le premier message. Les modifications sont synchronisées avec ElevenLabs.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement...</span>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mb-4" />
            <p className="text-destructive">Erreur de connexion à ElevenLabs</p>
            <p className="text-sm text-muted-foreground mt-2">
              Vérifiez la configuration de l'agent.
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
                className="min-h-[200px] font-mono text-sm"
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
                className="min-h-[80px]"
              />
            </div>

            <div className="flex justify-between items-center pt-4 border-t">
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