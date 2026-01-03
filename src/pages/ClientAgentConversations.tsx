import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { useClientElevenLabsConversations, useClientElevenLabsConversationDetails, useClientElevenLabsAudio } from '@/hooks/useClientElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  MessageSquare, 
  Play, 
  Clock, 
  User,
  Bot,
  ChevronLeft,
  ChevronRight,
  Volume2,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const ClientAgentConversations = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName } = useClientAgentAccess(clientId, agentId);
  
  const [page, setPage] = useState(1);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const { data: conversationsData, isLoading } = useClientElevenLabsConversations({
    apiKey,
    agentId: elevenlabsAgentId,
  }, page, 20);

  const { data: conversationDetails, isLoading: detailsLoading } = useClientElevenLabsConversationDetails({
    apiKey,
    agentId: elevenlabsAgentId,
  }, selectedConversation || undefined);

  const audioMutation = useClientElevenLabsAudio();

  const conversations = conversationsData?.conversations || [];
  const totalPages = Math.ceil((conversationsData?.total || 0) / 20);

  const handlePlayAudio = async (conversationId: string) => {
    if (!apiKey || !elevenlabsAgentId) return;
    
    try {
      const result = await audioMutation.mutateAsync({
        apiKey,
        agentId: elevenlabsAgentId,
        conversationId,
        format: 'mp3'
      });
      
      if (result?.audio_url) {
        setAudioUrl(result.audio_url);
      }
    } catch (error) {
      console.error('Error fetching audio:', error);
    }
  };

  const transcript = conversationDetails?.transcript || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conversations</h1>
        <p className="text-muted-foreground">Historique des appels de {agentName}</p>
      </div>

      {/* Conversations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Toutes les conversations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune conversation trouvée
            </p>
          ) : (
            <>
              <div className="space-y-3">
                {conversations.map((conv: any) => (
                  <div
                    key={conv.conversation_id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => setSelectedConversation(conv.conversation_id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">
                          {conv.metadata?.caller_id || 'Appelant inconnu'}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(conv.start_time_unix_secs * 1000), 'PPp', { locale: fr })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-4 w-4" />
                          {conv.call_duration_secs 
                            ? `${Math.floor(conv.call_duration_secs / 60)}:${(conv.call_duration_secs % 60).toString().padStart(2, '0')}`
                            : 'N/A'
                          }
                        </div>
                        <Badge variant={conv.status === 'done' ? 'default' : 'secondary'}>
                          {conv.status === 'done' ? 'Terminé' : conv.status}
                        </Badge>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlayAudio(conv.conversation_id);
                        }}
                        disabled={audioMutation.isPending}
                      >
                        {audioMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {page} sur {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Conversation Detail Modal */}
      <Dialog open={!!selectedConversation} onOpenChange={() => setSelectedConversation(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Détails de la conversation
            </DialogTitle>
          </DialogHeader>
          
          {detailsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-6 w-1/2" />
            </div>
          ) : (
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-4 pr-4">
                {/* Audio Player */}
                {audioUrl && (
                  <div className="p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Volume2 className="h-4 w-4" />
                      <span className="text-sm font-medium">Audio de l'appel</span>
                    </div>
                    <audio controls className="w-full" src={audioUrl}>
                      Votre navigateur ne supporte pas l'audio.
                    </audio>
                  </div>
                )}

                {/* Transcript */}
                <div className="space-y-3">
                  <h4 className="font-medium">Transcription</h4>
                  {transcript.length === 0 ? (
                    <p className="text-muted-foreground text-sm">
                      Aucune transcription disponible
                    </p>
                  ) : (
                    transcript.map((msg: any, index: number) => (
                      <div
                        key={index}
                        className={`flex gap-3 ${msg.role === 'agent' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.role === 'agent'
                              ? 'bg-primary/10 text-foreground'
                              : 'bg-muted text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            {msg.role === 'agent' ? (
                              <Bot className="h-4 w-4" />
                            ) : (
                              <User className="h-4 w-4" />
                            )}
                            <span className="text-xs font-medium">
                              {msg.role === 'agent' ? 'Agent' : 'Utilisateur'}
                            </span>
                          </div>
                          <p className="text-sm">{msg.message}</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ClientAgentConversations;
