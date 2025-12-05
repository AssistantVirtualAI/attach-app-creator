import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useConversation } from '@11labs/react';
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
  platform: string;
  theme_config: {
    primaryColor?: string;
    secondaryColor?: string;
    textColor?: string;
    borderRadius?: string;
  } | null;
}

interface TranscriptMessage {
  role: 'agent' | 'user';
  text: string;
  timestamp: Date;
}

const WidgetPrototype = () => {
  const { agentId } = useParams<{ agentId: string }>();
  const [agent, setAgent] = useState<AgentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  // ElevenLabs useConversation hook
  const conversation = useConversation({
    onConnect: () => {
      console.log('Connected to ElevenLabs');
      setIsConnecting(false);
    },
    onDisconnect: () => {
      console.log('Disconnected from ElevenLabs');
    },
    onMessage: (message) => {
      console.log('Message received:', message);
      if (message.message) {
        const role = message.source === 'ai' ? 'agent' : 'user';
        setTranscript(prev => [...prev, {
          role,
          text: message.message,
          timestamp: new Date(),
        }]);
      }
    },
    onError: (error) => {
      console.error('Conversation error:', error);
      const errorMessage = typeof error === 'string' ? error : (error as any)?.message || 'Inconnue';
      setError('Erreur de connexion: ' + errorMessage);
      setIsConnecting(false);
    },
  });

  useEffect(() => {
    const fetchAgent = async () => {
      if (!agentId) {
        setError('Agent ID manquant');
        setLoading(false);
        return;
      }

      const { data, error: fetchError } = await supabase
        .from('agents')
        .select('id, name, description, avatar_url, branding_url, platform_agent_id, platform, theme_config')
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

  const handleStartConversation = useCallback(async () => {
    if (!agent) return;

    if (agent.platform !== 'elevenlabs') {
      setError('Cet agent n\'est pas configuré avec ElevenLabs');
      return;
    }

    if (!agent.platform_agent_id) {
      setError('Agent ID ElevenLabs non configuré');
      return;
    }

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      setIsConnecting(true);
      setError(null);
      
      // Get signed URL from edge function
      const { data, error: urlError } = await supabase.functions.invoke('elevenlabs-signed-url', {
        body: { agentId: agent.id }
      });

      if (urlError || !data?.signedUrl) {
        throw new Error(urlError?.message || 'Impossible d\'obtenir l\'URL de connexion');
      }

      // Start conversation with signed URL
      await conversation.startSession({
        signedUrl: data.signedUrl,
      });

    } catch (err: any) {
      console.error('Error starting conversation:', err);
      setError(err.message || 'Erreur lors du démarrage de la conversation');
      setIsConnecting(false);
    }
  }, [agent, conversation]);

  const handleEndConversation = useCallback(async () => {
    try {
      await conversation.endSession();
      
      // Save transcript to database
      if (agent && transcript.length > 0) {
        const transcriptText = transcript.map(m => `${m.role === 'agent' ? agent.name : 'User'}: ${m.text}`).join('\n');
        const userMessages = transcript.filter(m => m.role === 'user').map(m => ({ text: m.text, timestamp: m.timestamp.toISOString() }));
        const agentMessages = transcript.filter(m => m.role === 'agent').map(m => ({ text: m.text, timestamp: m.timestamp.toISOString() }));
        
        const { data: userData } = await supabase.auth.getUser();
        if (userData.user) {
          const { error: saveError } = await supabase
            .from('conversations')
            .insert([{
              title: `Conversation avec ${agent.name}`,
              agent_id: agent.id,
              platform: 'elevenlabs',
              status: 'completed',
              transcript: transcriptText,
              user_messages: userMessages,
              agent_messages: agentMessages,
              duration: Math.floor((new Date().getTime() - (transcript[0]?.timestamp?.getTime() || Date.now())) / 1000),
              user_id: userData.user.id,
            }]);
          
          if (saveError) {
            console.error('Error saving conversation:', saveError);
          } else {
            console.log('Conversation saved successfully');
          }
        }
      }
      
      setTranscript(prev => [...prev, {
        role: 'agent',
        text: '--- Conversation terminée ---',
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Error ending conversation:', err);
    }
  }, [conversation, agent, transcript]);

  const themeConfig = agent?.theme_config || {};
  const primaryColor = themeConfig.primaryColor || '#8B5CF6';
  const borderRadius = themeConfig.borderRadius || '12px';

  const isConnected = conversation.status === 'connected';
  const isSpeaking = conversation.isSpeaking;

  // Determine current status
  const getStatusInfo = () => {
    if (isConnecting) return { text: 'Connexion...', color: 'bg-yellow-500' };
    if (!isConnected) return { text: 'Prêt à démarrer', color: 'bg-muted-foreground' };
    if (isSpeaking) return { text: 'En train de parler...', color: 'bg-primary' };
    return { text: 'En écoute...', color: 'bg-green-500' };
  };

  const statusInfo = getStatusInfo();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !agent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-destructive mb-2">Erreur</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  if (!agent) return null;

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
                className={cn(
                  "w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/30 object-cover transition-all",
                  isSpeaking && "ring-4 ring-white/50 animate-pulse"
                )}
              />
            ) : (
              <div className={cn(
                "w-20 h-20 rounded-full mx-auto mb-4 border-4 border-white/30 bg-white/20 flex items-center justify-center transition-all",
                isSpeaking && "ring-4 ring-white/50 animate-pulse"
              )}>
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
                "w-3 h-3 rounded-full animate-pulse",
                statusInfo.color
              )} />
              <span className="text-sm text-muted-foreground">
                {statusInfo.text}
              </span>
            </div>
          </div>

          {/* Error message */}
          {error && (
            <div className="p-3 bg-destructive/10 border-b border-destructive/20">
              <p className="text-sm text-destructive text-center">{error}</p>
            </div>
          )}

          {/* Transcript area */}
          <div className="h-48 overflow-y-auto p-4 space-y-2 bg-muted/30">
            {transcript.length === 0 ? (
              <p className="text-center text-muted-foreground text-sm">
                Cliquez sur le microphone pour démarrer la conversation
              </p>
            ) : (
              transcript.map((msg, index) => (
                <div 
                  key={index} 
                  className={cn(
                    "text-sm p-2 rounded-lg",
                    msg.role === 'agent' 
                      ? "bg-primary/10 text-foreground" 
                      : "bg-muted text-foreground ml-auto max-w-[80%]"
                  )}
                >
                  <span className="font-medium">
                    {msg.role === 'agent' ? agent.name : 'Vous'}:
                  </span>{' '}
                  {msg.text}
                </div>
              ))
            )}
          </div>

          {/* Voice visualization when speaking */}
          {isConnected && (
            <div className="h-12 flex items-center justify-center gap-1 bg-muted/20 border-t border-border">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-1 rounded-full transition-all duration-150",
                    isSpeaking 
                      ? "bg-primary animate-pulse" 
                      : "bg-muted-foreground/30"
                  )}
                  style={{
                    height: isSpeaking ? `${Math.random() * 24 + 8}px` : '8px',
                    animationDelay: `${i * 100}ms`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Controls */}
          <div className="p-6 flex justify-center">
            {!isConnected ? (
              <Button
                size="lg"
                className="w-16 h-16 rounded-full"
                style={{ backgroundColor: primaryColor }}
                onClick={handleStartConversation}
                disabled={isConnecting}
              >
                {isConnecting ? (
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
