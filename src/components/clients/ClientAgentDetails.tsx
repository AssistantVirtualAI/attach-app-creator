import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Bot, BookOpen, Volume2, MessageSquare, 
  ExternalLink, Copy, CheckCircle 
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface ClientAgentDetailsProps {
  agentId: string;
  onClose: () => void;
}

export const ClientAgentDetails = ({ agentId, onClose }: ClientAgentDetailsProps) => {
  const navigate = useNavigate();

  const { data: agent, isLoading } = useQuery({
    queryKey: ['agent-details', agentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('*')
        .eq('id', agentId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  // Fetch agent config from ElevenLabs
  const { data: elevenLabsConfig, isLoading: isLoadingConfig } = useQuery({
    queryKey: ['elevenlabs-agent-config', agentId],
    queryFn: async () => {
      if (!agent?.platform_agent_id) return null;

      const { data, error } = await supabase.functions.invoke('elevenlabs-convai-agent-config', {
        body: { 
          action: 'get',
          agent_id: agent.platform_agent_id,
          api_key: agent.platform_api_key
        }
      });

      if (error) throw error;
      return data;
    },
    enabled: !!agent?.platform_agent_id,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copié`);
  };

  const config = agent?.config as Record<string, any> || {};

  return (
    <Dialog open={true} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            {agent?.name || 'Agent ElevenLabs'}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh] pr-4">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-40 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Agent ID */}
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Agent ID ElevenLabs</p>
                    <p className="font-mono text-sm">
                      {agent?.platform_agent_id || config.agent_id || 'Non configuré'}
                    </p>
                  </div>
                  {(agent?.platform_agent_id || config.agent_id) && (
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => copyToClipboard(agent?.platform_agent_id || config.agent_id, 'Agent ID')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>

              {/* System Prompt */}
              <div>
                <h4 className="flex items-center gap-2 font-medium mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Prompt Système
                </h4>
                <div className="p-4 bg-muted rounded-lg">
                  {isLoadingConfig ? (
                    <Skeleton className="h-20 w-full" />
                  ) : (
                    <p className="text-sm whitespace-pre-wrap">
                      {elevenLabsConfig?.conversation_config?.agent?.prompt?.prompt || 
                       config.system_prompt || 
                       'Aucun prompt défini'}
                    </p>
                  )}
                </div>
              </div>

              {/* First Message */}
              <div>
                <h4 className="flex items-center gap-2 font-medium mb-2">
                  <MessageSquare className="h-4 w-4" />
                  Premier Message
                </h4>
                <div className="p-4 bg-muted rounded-lg">
                  {isLoadingConfig ? (
                    <Skeleton className="h-12 w-full" />
                  ) : (
                    <p className="text-sm">
                      {elevenLabsConfig?.conversation_config?.agent?.first_message || 
                       config.first_message || 
                       'Aucun message défini'}
                    </p>
                  )}
                </div>
              </div>

              {/* Voice Configuration */}
              <div>
                <h4 className="flex items-center gap-2 font-medium mb-2">
                  <Volume2 className="h-4 w-4" />
                  Configuration Vocale
                </h4>
                <div className="p-4 bg-muted rounded-lg space-y-2">
                  {isLoadingConfig ? (
                    <Skeleton className="h-16 w-full" />
                  ) : (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Voice ID</span>
                        <span className="font-mono">
                          {elevenLabsConfig?.conversation_config?.tts?.voice_id || 
                           config.voice_id || 
                           'Par défaut'}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Stabilité</span>
                        <span>
                          {(elevenLabsConfig?.conversation_config?.tts?.stability || 
                            config.voice_stability || 0.5) * 100}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Similarité</span>
                        <span>
                          {(elevenLabsConfig?.conversation_config?.tts?.similarity_boost || 
                            config.voice_similarity || 0.75) * 100}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Knowledge Base */}
              <div>
                <h4 className="flex items-center gap-2 font-medium mb-2">
                  <BookOpen className="h-4 w-4" />
                  Base de Connaissances
                </h4>
                <div className="p-4 bg-muted rounded-lg">
                  {isLoadingConfig ? (
                    <Skeleton className="h-12 w-full" />
                  ) : elevenLabsConfig?.knowledge_base?.length > 0 ? (
                    <div className="space-y-2">
                      {elevenLabsConfig.knowledge_base.map((doc: any, index: number) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <span>{doc.name || `Document ${index + 1}`}</span>
                          <Badge variant="secondary">
                            {doc.size ? `${Math.round(doc.size / 1024)} KB` : 'N/A'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      Aucun document configuré
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-4 border-t">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    onClose();
                    navigate(`/agent-settings/${agentId}`);
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Configurer l'agent
                </Button>
                <Button variant="ghost" onClick={onClose}>
                  Fermer
                </Button>
              </div>
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
