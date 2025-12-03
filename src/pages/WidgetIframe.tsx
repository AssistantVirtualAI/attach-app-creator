import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Mic, MicOff, Volume2, Loader2, X, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface AgentData {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  platform_agent_id: string | null;
  theme_config: {
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
    borderRadius?: string;
  } | null;
}

type ConversationStatus = 'idle' | 'connecting' | 'listening' | 'speaking';

const WidgetIframe = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<ConversationStatus>('idle');
  const [transcript, setTranscript] = useState<string[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId) {
        setError('Agent ID manquant');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('id, name, description, avatar_url, platform_agent_id, theme_config')
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

  // Send status to parent window
  useEffect(() => {
    window.parent.postMessage({ type: 'widget-status', status, isConnected }, '*');
  }, [status, isConnected]);

  const handleStartConversation = async () => {
    if (!agent?.platform_agent_id) {
      setError('Configuration agent ElevenLabs manquante');
      return;
    }

    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setStatus('connecting');
      
      // Simulate connection (replace with actual ElevenLabs integration)
      setTimeout(() => {
        setIsConnected(true);
        setStatus('listening');
        setTranscript(prev => [...prev, `${agent.name}: Bonjour ! Comment puis-je vous aider ?`]);
      }, 1500);
      
    } catch (err) {
      setError('Permission microphone refusée');
      setStatus('idle');
    }
  };

  const handleEndConversation = () => {
    setIsConnected(false);
    setStatus('idle');
  };

  const handleClose = () => {
    window.parent.postMessage({ type: 'widget-close' }, '*');
  };

  const handleMinimize = () => {
    setIsMinimized(true);
    window.parent.postMessage({ type: 'widget-minimize' }, '*');
  };

  const themeConfig = agent?.theme_config || {};
  const primaryColor = themeConfig.primaryColor || '#8B5CF6';

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-card">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !agent) {
    return (
      <div className="h-screen flex items-center justify-center bg-card p-4">
        <p className="text-sm text-destructive text-center">{error || 'Agent non trouvé'}</p>
      </div>
    );
  }

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-110"
        style={{ backgroundColor: primaryColor }}
      >
        {agent.avatar_url ? (
          <img src={agent.avatar_url} alt={agent.name} className="w-full h-full rounded-full object-cover" />
        ) : (
          <Volume2 className="h-6 w-6 text-white" />
        )}
      </button>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-card overflow-hidden">
      {/* Header */}
      <div 
        className="p-3 flex items-center gap-3 text-white shrink-0"
        style={{ backgroundColor: primaryColor }}
      >
        {agent.avatar_url ? (
          <img 
            src={agent.avatar_url} 
            alt={agent.name}
            className="w-10 h-10 rounded-full border-2 border-white/30 object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-white/30 bg-white/20 flex items-center justify-center">
            <Volume2 className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{agent.name}</p>
          <div className="flex items-center gap-1">
            <div className={cn(
              "w-2 h-2 rounded-full",
              status === 'idle' && "bg-white/50",
              status === 'connecting' && "bg-yellow-400 animate-pulse",
              status === 'listening' && "bg-green-400 animate-pulse",
              status === 'speaking' && "bg-white animate-pulse"
            )} />
            <span className="text-xs opacity-80">
              {status === 'idle' && 'En ligne'}
              {status === 'connecting' && 'Connexion...'}
              {status === 'listening' && 'Écoute...'}
              {status === 'speaking' && 'Parle...'}
            </span>
          </div>
        </div>
        <button 
          onClick={handleMinimize}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <Minimize2 className="h-4 w-4" />
        </button>
        <button 
          onClick={handleClose}
          className="p-1 hover:bg-white/20 rounded transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-muted/20">
        {transcript.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <p className="text-xs text-muted-foreground text-center px-4">
              Appuyez sur le microphone pour démarrer
            </p>
          </div>
        ) : (
          transcript.map((line, index) => (
            <div 
              key={index} 
              className={cn(
                "text-xs p-2 rounded-lg max-w-[85%]",
                line.startsWith(agent.name) 
                  ? "bg-muted text-foreground" 
                  : "bg-primary/10 text-foreground ml-auto"
              )}
            >
              {line}
            </div>
          ))
        )}
      </div>

      {/* Controls */}
      <div className="p-3 border-t border-border flex justify-center shrink-0">
        {!isConnected ? (
          <Button
            size="sm"
            className="w-12 h-12 rounded-full"
            style={{ backgroundColor: primaryColor }}
            onClick={handleStartConversation}
            disabled={status === 'connecting'}
          >
            {status === 'connecting' ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            variant="destructive"
            className="w-12 h-12 rounded-full"
            onClick={handleEndConversation}
          >
            <MicOff className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default WidgetIframe;
