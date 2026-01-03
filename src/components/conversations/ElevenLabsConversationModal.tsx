import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AdvancedAudioPlayer } from '@/components/audio/AdvancedAudioPlayer';
import { SatisfactionScore, SatisfactionBadge } from './SatisfactionScore';
import { SentimentTimeline } from './SentimentTimeline';
import { ImprovementsList } from './ImprovementCard';
import { SmartTagsList } from './SmartTags';
import { 
  Brain, Sparkles, TrendingUp, TrendingDown, Minus, Target, 
  Lightbulb, Tag, Bot, User, Volume2, AlertCircle, RefreshCw, Clock
} from 'lucide-react';
import { motion } from 'framer-motion';
import { useConversationDetails, useConversationAudio } from '@/hooks/useAllAgentsConversations';
import { useEnhancedConversationAnalysis } from '@/hooks/useEnhancedConversationAnalysis';
import { 
  normalizeTranscript, 
  transcriptToAudioPlayerFormat,
  transcriptToText 
} from '@/lib/transcript/normalizeElevenLabsTranscript';

// Analysis content component with timeout handling
function AnalysisContent({
  analysis,
  isAnalyzing,
  analysisError,
  transcriptMessages,
  platformAgentId,
  generateAnalysis,
  transcriptToText
}: {
  analysis: any;
  isAnalyzing: boolean;
  analysisError: any;
  transcriptMessages: any[];
  platformAgentId?: string;
  generateAnalysis: (params: any) => void;
  transcriptToText: (msgs: any[]) => string;
}) {
  const [analysisStartTime, setAnalysisStartTime] = useState<number | null>(null);
  const [showTimeout, setShowTimeout] = useState(false);

  useEffect(() => {
    if (isAnalyzing && !analysisStartTime) {
      setAnalysisStartTime(Date.now());
      setShowTimeout(false);
    } else if (!isAnalyzing) {
      setAnalysisStartTime(null);
      setShowTimeout(false);
    }
  }, [isAnalyzing, analysisStartTime]);

  useEffect(() => {
    if (!analysisStartTime) return;
    
    const timeout = setTimeout(() => {
      setShowTimeout(true);
    }, 15000); // Show timeout message after 15s
    
    return () => clearTimeout(timeout);
  }, [analysisStartTime]);

  const handleRetry = useCallback(() => {
    const transcriptText = transcriptToText(transcriptMessages);
    generateAnalysis({ transcript: transcriptText, platformAgentId, forceRegenerate: true });
  }, [transcriptMessages, platformAgentId, generateAnalysis, transcriptToText]);

  // Error state
  if (analysisError) {
    const errorMessage = analysisError.message || String(analysisError);
    const isAuthError = errorMessage.includes('401') || errorMessage.includes('Session') || errorMessage.includes('Unauthorized');
    const isRateLimit = errorMessage.includes('429');
    const isCredits = errorMessage.includes('402');

    return (
      <Card className="p-8 text-center glass-card border-destructive/50">
        <AlertCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
        <p className="text-destructive font-medium mb-2">
          {isAuthError ? 'Session expirée' : 
           isRateLimit ? 'Limite de requêtes atteinte' :
           isCredits ? 'Crédits IA épuisés' : 
           'Erreur lors de l\'analyse'}
        </p>
        <p className="text-muted-foreground text-sm mb-4">
          {isAuthError ? 'Veuillez vous reconnecter pour continuer.' :
           isRateLimit ? 'Veuillez patienter quelques minutes.' :
           isCredits ? 'Contactez votre administrateur.' :
           errorMessage}
        </p>
        {!isAuthError && !isCredits && (
          <Button onClick={handleRetry} variant="outline" className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Réessayer
          </Button>
        )}
      </Card>
    );
  }

  // Analyzing state with timeout
  if (isAnalyzing) {
    return (
      <Card className="p-8 text-center glass-card">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Analyse IA en cours...</p>
        <p className="text-xs text-muted-foreground mt-2">
          Génération du score de satisfaction et des recommandations
        </p>
        
        {showTimeout && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4 p-3 bg-warning/10 rounded-lg border border-warning/30"
          >
            <div className="flex items-center justify-center gap-2 text-warning mb-2">
              <Clock className="w-4 h-4" />
              <span className="text-sm font-medium">L'analyse prend plus de temps que prévu</span>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              Cela peut arriver pour les longues conversations. Patientez ou réessayez.
            </p>
            <Button 
              onClick={handleRetry} 
              variant="outline" 
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="w-3 h-3" />
              Relancer l'analyse
            </Button>
          </motion.div>
        )}
      </Card>
    );
  }

  // No analysis state
  if (!analysis) {
    return (
      <Card className="p-8 text-center glass-card">
        <Brain className="w-12 h-12 mx-auto mb-4 text-primary" />
        <p className="text-muted-foreground mb-4">
          Générez une analyse IA complète de cette conversation
        </p>
        <Button 
          onClick={() => {
            const transcriptText = transcriptToText(transcriptMessages);
            generateAnalysis({ transcript: transcriptText, platformAgentId });
          }} 
          className="gap-2"
          disabled={transcriptMessages.length === 0}
        >
          <Sparkles className="w-4 h-4" />
          Générer l'Analyse
        </Button>
        {transcriptMessages.length === 0 && (
          <p className="text-xs text-muted-foreground mt-2">
            Aucune transcription disponible
          </p>
        )}
      </Card>
    );
  }

  // Analysis available - return null to let parent render the full analysis
  return null;
}

interface ElevenLabsConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string | null;
  agentName?: string;
  platformAgentId?: string;
}

export function ElevenLabsConversationModal({ 
  isOpen, 
  onClose, 
  conversationId,
  agentName,
  platformAgentId
}: ElevenLabsConversationModalProps) {
  const [activeTab, setActiveTab] = useState('overview');
  
  const { data: conversationDetails, isLoading: isLoadingDetails } = useConversationDetails(conversationId);
  const { data: audioData, isLoading: isLoadingAudio } = useConversationAudio(conversationId);
  
  // Use the enhanced analysis hook with external conversation support
  const {
    analysis,
    isAnalyzing,
    generateAnalysis,
    existingInsight,
    error: analysisError,
  } = useEnhancedConversationAnalysis(conversationId || '', {
    isExternal: true,
    platformAgentId,
  });

  const autoAnalyzeAttemptedRef = useRef(false);

  // Normalize transcript using the shared utility
  const transcriptMessages = useMemo(() => {
    if (!conversationDetails) return [];
    return normalizeTranscript({
      metadata: conversationDetails.metadata,
      user_messages: conversationDetails.user_messages,
      agent_messages: conversationDetails.agent_messages,
      transcript: conversationDetails.transcript
    });
  }, [conversationDetails]);

  // Auto-generate analysis if not available (no infinite retry on auth errors)
  useEffect(() => {
    if (!isOpen) {
      autoAnalyzeAttemptedRef.current = false;
      return;
    }

    if (analysisError) return;

    if (
      isOpen &&
      conversationId &&
      conversationDetails &&
      !analysis &&
      !isAnalyzing &&
      !existingInsight &&
      !autoAnalyzeAttemptedRef.current
    ) {
      autoAnalyzeAttemptedRef.current = true;
      // Generate transcript text for analysis
      const transcriptText = transcriptToText(transcriptMessages);
      if (transcriptText) {
        generateAnalysis({
          transcript: transcriptText,
          platformAgentId,
        });
      }
    }
  }, [
    isOpen,
    conversationId,
    conversationDetails,
    analysis,
    isAnalyzing,
    existingInsight,
    transcriptMessages,
    platformAgentId,
    analysisError,
    generateAnalysis,
  ]);

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getSentimentEmoji = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return '😊';
      case 'negative': return '😞';
      default: return '😐';
    }
  };

  const getSentimentLabel = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'Positif';
      case 'negative': return 'Négatif';
      default: return 'Neutre';
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-400';
      case 'negative': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  // Display score from AI analysis or ElevenLabs data
  const displayScore = analysis?.satisfaction_score ?? conversationDetails?.analysis?.satisfaction_score;
  const displaySentiment = analysis?.sentiment ?? conversationDetails?.analysis?.sentiment;

  if (!conversationId) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden glass-card">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-bold gradient-text flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-primary" />
              {agentName ? `Conversation - ${agentName}` : 'Détails de la conversation'}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {displayScore !== null && displayScore !== undefined && (
                <SatisfactionBadge score={displayScore} />
              )}
              {displaySentiment && (
                <Badge variant="outline" className={getSentimentColor(displaySentiment)}>
                  {getSentimentEmoji(displaySentiment)} {getSentimentLabel(displaySentiment)}
                </Badge>
              )}
            </div>
          </div>
        </DialogHeader>

        {isLoadingDetails ? (
          <div className="space-y-4 p-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-60 w-full" />
          </div>
        ) : conversationDetails ? (
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden">
            <TabsList className="grid w-full grid-cols-4 glass-card">
              <TabsTrigger value="overview">Aperçu</TabsTrigger>
              <TabsTrigger value="audio">Audio</TabsTrigger>
              <TabsTrigger value="transcript">Transcript</TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-1">
                <Sparkles className="w-4 h-4" />
                Analyse IA
              </TabsTrigger>
            </TabsList>

            <div className="mt-4 overflow-y-auto max-h-[calc(90vh-200px)]">
              <TabsContent value="overview" className="space-y-4">
                {/* Metadata cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Agent</p>
                      <p className="font-semibold">{agentName || 'N/A'}</p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Durée</p>
                      <p className="font-semibold">
                        {formatDuration(conversationDetails.call_duration_secs || conversationDetails.metadata?.call_duration_secs)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Satisfaction</p>
                      <p className="font-semibold">
                        {displayScore !== undefined && displayScore !== null
                          ? typeof displayScore === 'number' && displayScore <= 1
                            ? `${(displayScore * 100).toFixed(0)}%`
                            : `${Number(displayScore).toFixed(1)}/10`
                          : isAnalyzing ? '...' : 'N/A'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="glass-card">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Sentiment</p>
                      <div className="flex items-center gap-2">
                        {displaySentiment ? (
                          <>
                            {getSentimentIcon(displaySentiment)}
                            <span className="font-semibold capitalize">
                              {getSentimentLabel(displaySentiment)}
                            </span>
                          </>
                        ) : isAnalyzing ? (
                          <span className="text-muted-foreground">Analyse...</span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Summary */}
                {(analysis?.summary || conversationDetails.analysis?.summary) && (
                  <Card className="glass-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-sm">
                        <Brain className="w-4 h-4 text-primary" />
                        Résumé IA
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">
                        {analysis?.summary || conversationDetails.analysis?.summary}
                      </p>
                    </CardContent>
                  </Card>
                )}

                {/* Quick transcript preview */}
                {transcriptMessages.length > 0 && (
                  <Card className="glass-card">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Aperçu de la conversation</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 max-h-40 overflow-hidden">
                        {transcriptMessages.slice(0, 4).map((msg, idx) => (
                          <div key={idx} className={`flex gap-2 text-sm ${msg.role === 'agent' ? '' : 'justify-end'}`}>
                            <span className={`px-2 py-1 rounded ${
                              msg.role === 'agent' ? 'bg-primary/10' : 'bg-muted'
                            }`}>
                              {msg.role === 'agent' ? '🤖' : '👤'} {msg.message.substring(0, 80)}...
                            </span>
                          </div>
                        ))}
                        {transcriptMessages.length > 4 && (
                          <p className="text-xs text-muted-foreground text-center">
                            +{transcriptMessages.length - 4} messages...
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="audio">
                {isLoadingAudio ? (
                  <Card className="p-8 text-center glass-card">
                    <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4" />
                    <p className="text-muted-foreground">Chargement de l'audio...</p>
                  </Card>
                ) : audioData?.audio_url ? (
                  <AdvancedAudioPlayer
                    audioUrl={audioData.audio_url}
                    conversation={{
                      conversation_id: conversationId,
                      duration_seconds: conversationDetails.call_duration_secs || conversationDetails.metadata?.call_duration_secs,
                      satisfaction_score: displayScore,
                    }}
                    transcript={transcriptToAudioPlayerFormat(transcriptMessages)}
                  />
                ) : (
                  <Card className="p-8 text-center glass-card">
                    <Volume2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">Audio non disponible pour cette conversation</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="transcript" className="space-y-4">
                {transcriptMessages.length > 0 ? (
                  <ScrollArea className="h-[500px] pr-4">
                    <div className="space-y-3">
                      {transcriptMessages.map((msg, index) => {
                        const isAgent = msg.role === 'agent';
                        return (
                          <motion.div
                            key={index}
                            initial={{ opacity: 0, x: isAgent ? -20 : 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.3, delay: index * 0.02 }}
                            className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}
                          >
                            <div className={`max-w-[80%] ${isAgent ? 'mr-auto' : 'ml-auto'}`}>
                              <div className={`flex items-center gap-2 mb-1 ${isAgent ? '' : 'flex-row-reverse'}`}>
                                <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                  isAgent ? 'bg-primary/20' : 'bg-secondary/20'
                                }`}>
                                  {isAgent ? <Bot className="w-3 h-3 text-primary" /> : <User className="w-3 h-3" />}
                                </div>
                                <span className={`text-xs font-medium ${isAgent ? 'text-primary' : ''}`}>
                                  {isAgent ? 'Agent IA' : 'Client'}
                                </span>
                                {msg.time_in_call_secs !== undefined && (
                                  <span className="text-xs text-muted-foreground">
                                    {Math.floor(msg.time_in_call_secs / 60)}:{String(Math.floor(msg.time_in_call_secs % 60)).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                              <div className={`p-3 rounded-lg ${
                                isAgent 
                                  ? 'bg-primary/10 border border-primary/20 rounded-tl-none' 
                                  : 'bg-secondary/10 border border-secondary/20 rounded-tr-none'
                              }`}>
                                <p className="text-sm">{msg.message}</p>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  <Card className="p-8 text-center glass-card">
                    <p className="text-muted-foreground">Aucune transcription disponible</p>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="analysis" className="space-y-4">
                <AnalysisContent
                  analysis={analysis}
                  isAnalyzing={isAnalyzing}
                  analysisError={analysisError}
                  transcriptMessages={transcriptMessages}
                  platformAgentId={platformAgentId}
                  generateAnalysis={generateAnalysis}
                  transcriptToText={transcriptToText}
                />

                {analysis && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-4"
                  >
                    {/* Score + Sentiment */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Card className="glass-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-primary text-sm">
                            <Target className="w-4 h-4" />
                            Score de Satisfaction
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex justify-center py-4">
                          <SatisfactionScore score={analysis.satisfaction_score} size="lg" />
                        </CardContent>
                      </Card>

                      <Card className="glass-card">
                        <CardHeader className="pb-2">
                          <CardTitle className="flex items-center gap-2 text-sm">
                            {getSentimentIcon(analysis.sentiment)}
                            Sentiment Global
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="flex items-center justify-center py-4">
                          <div className="flex items-center gap-3">
                            <span className="text-3xl">{getSentimentEmoji(analysis.sentiment)}</span>
                            <div>
                              <p className={`font-medium text-lg ${getSentimentColor(analysis.sentiment)}`}>
                                {getSentimentLabel(analysis.sentiment)}
                              </p>
                              {analysis.confidence && (
                                <p className="text-xs text-muted-foreground">
                                  Confiance: {(analysis.confidence * 100).toFixed(0)}%
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Sentiment Timeline */}
                    {analysis.sentiment_timeline && analysis.sentiment_timeline.length > 0 && (
                      <Card className="glass-card">
                        <CardHeader>
                          <CardTitle className="text-sm">Évolution du Sentiment</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <SentimentTimeline timeline={analysis.sentiment_timeline} />
                        </CardContent>
                      </Card>
                    )}

                    {/* Smart Tags */}
                    {(analysis as any).smart_tags?.length > 0 && (
                      <Card className="glass-card">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-sm">
                            <Tag className="w-4 h-4 text-primary" />
                            Tags
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <SmartTagsList tags={(analysis as any).smart_tags} />
                        </CardContent>
                      </Card>
                    )}

                    {/* Improvements */}
                    {analysis.improvements?.length > 0 && (
                      <Card className="glass-card">
                        <CardHeader>
                          <CardTitle className="flex items-center gap-2 text-sm text-primary">
                            <Lightbulb className="w-4 h-4" />
                            Recommandations
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <ImprovementsList improvements={analysis.improvements} />
                        </CardContent>
                      </Card>
                    )}
                  </motion.div>
                )}
              </TabsContent>
            </div>
          </Tabs>
        ) : (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">Impossible de charger les détails de la conversation</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
