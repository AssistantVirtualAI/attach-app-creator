import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Volume2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  branding_url: string | null;
  platform_agent_id: string | null;
  theme_config: {
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
    borderRadius?: string;
  } | null;
}

type ConversationStatus = 'idle' | 'connecting' | 'listening' | 'speaking';

const WidgetPrototype = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId) {
        setError('Agent ID manquant');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('id, name, description, avatar_url, branding_url, platform_agent_id, theme_config')
        .eq('id', agentId)
        .single();

      if (fetchError || !data) {
        setError('Agent non trouvé');
        setLoading(false);
        return;
      }

      setAgent({
        ...data,
        theme_config: data.theme_config as AgentData['theme_config']
      });
      setLoading(false);
    };

    fetchAgent();
  }, [agentId]);

  const handleStartConversation = async () => {
    if (!agent?.platform_agent_id) {
      setError('Configuration agent ElevenLabs manquante');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setStatus('connecting');
      
      // Simulate connection for demo (replace with actual ElevenLabs integration)
      setTimeout(() => {
        setIsConnected(true);
        setStatus('listening');
        setTranscript(prev => [...prev, `${agent.name}: Bonjour ! Comment puis-je vous aider aujourd'hui ?`]);
      }, 1500);
      
    } catch (err) {
      setError('Permission microphone refusée');
      setStatus('idle');
    }
  };

  const handleEndConversation = () => {
    setIsConnected(false);
    setStatus('idle');
    setTranscript(prev => [...prev, '--- Conversation terminée ---']);
  };

  const themeConfig = agent?.theme_config || {};
  const primaryColor = themeConfig.primaryColor || '#8B5CF6';
  const borderRadius = themeConfig.borderRadius || '12px';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Erreur</h1>
          <p className="text-muted-foreground">{error || 'Agent non trouvé'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted flex flex-col">
      {/* Header with branding */}
      {agent.branding_url && (
        <header className="p-4 flex justify-center border-b border-border/50">
          <img 
            src={agent.branding_url} 
            alt="Logo" 
            className="h-8 object-contain"
          />
        </header>
      )}

      {/* Main content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6">
        <div 
          className="w-full max-w-md bg-card border border-border shadow-2xl overflow-hidden"
          style={{ borderRadius }}
        >
          {/* Agent header */}
          <div 
            className="p-6 text-white text-center"
            style={{ backgroundColor: primaryColor }}
          >
            {agent.avatar_url ? (
              <img 
                src={agent.avatar_url} 
                alt={agent.name}
                className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/30 object-cover"
              />
            ) : (
              <div className="w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/30 bg-white/20 flex items-center justify-center">
                <Volume2 className="h-10 w-10" />
              </div>
            )}
            <h1 className="text-xl font-bold">{agent.name}</h1>
            {agent.description && (
              <p className="text-sm opacity-80 mt-1">{agent.description}</p>
            )}
          </div>

          {/* Status indicator */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-center gap-2">
              <div className={cn(
                "w-3 h-3 rounded-full",
                status === 'idle' && "bg-muted-foreground",
                status === 'connecting' && "bg-yellow-500 animate-pulse",
                status === 'listening' && "bg-green-500 animate-pulse",
                status === 'speaking' && "bg-primary animate-pulse"
              )} />
              <span className="text-sm text-muted-foreground">
                {status === 'idle' && 'Prêt à démarrer'}
                {status === 'connecting' && 'Connexion...'}
                {status === 'listening' && 'En écoute...'}
                {status === 'speaking' && 'En train de parler...'}
              </span>
            </div>
          </div>

          {/* Transcript area */}
          <div className="h-48 overflow-y-auto p-4 space-y-2 bg-muted/30">
            {transcript.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">
                Cliquez sur le microphone pour démarrer la conversation
              </p>
            ) : (
              transcript.map((line, index) => (
                <p 
                  key={index} 
                  className={cn(
                    "text-sm p-2 rounded-lg",
                    line.startsWith(agent.name) 
                      ? "bg-primary/10 text-foreground" 
                      : line.startsWith('Vous:')
                      ? "bg-muted text-foreground ml-auto max-w-[80%]"
                      : "text-center text-muted-foreground text-xs"
                  )}
                >
                  {line}
                </p>
              ))
            )}
          </div>

          {/* Controls */}
          <div className="p-6 flex justify-center">
            {!isConnected ? (
              <Button
                size="lg"
                className="w-16 h-16 rounded-full"
                style={{ backgroundColor: primaryColor }}
                onClick={handleStartConversation}
                disabled={status === 'connecting'}
              >
                {status === 'connecting' ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : (
                  <Mic className="h-8 w-8" />
                )}
              </Button>
            ) : (
              <Button
                size="lg"
                variant="destructive"
                className="w-16 h-16 rounded-full"
                onClick={handleEndConversation}
              >
                <MicOff className="h-8 w-8" />
              </Button>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-xs text-muted-foreground">
          Propulsé par AVA Statistics
        </p>
      </main>
    </div>
  );
};

export default WidgetPrototype;
