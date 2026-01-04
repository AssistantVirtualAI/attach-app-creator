import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalConversations, usePortalConversationDetails, usePortalConversationAudio } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Slider } from '@/components/ui/slider';
import { MessageSquare, Search, Phone, Clock, TrendingUp, User, Loader2, AlertCircle, Volume2, Download, Filter, X, CheckCircle, XCircle, Brain, FileText, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { AdvancedAudioPlayer } from '@/components/audio/AdvancedAudioPlayer';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

const PortalConversations = () => {
  const { session } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  
  // Audio state
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioUnavailable, setAudioUnavailable] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  
  // Filters state
  const [showFilters, setShowFilters] = useState(false);
  const [durationFilter, setDurationFilter] = useState<[number, number]>([0, 600]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const { data: conversationsData, isLoading, refetch } = usePortalConversations(page, 100);
  const { data: selectedConversation, isLoading: detailsLoading } = usePortalConversationDetails(selectedConversationId);
  const audioMutation = usePortalConversationAudio();

  const conversations = conversationsData?.conversations || [];

  // Apply filters
  const filteredConversations = conversations.filter(c => {
    // Search filter
    if (searchTerm && !c.conversation_id.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    
    // Duration filter
    const duration = c.call_duration_secs || 0;
    if (duration < durationFilter[0] || duration > durationFilter[1]) {
      return false;
    }
    
    // Date filters
    if (dateFrom || dateTo) {
      const convDate = c.start_time_unix_secs ? new Date(c.start_time_unix_secs * 1000) : null;
      if (convDate) {
        if (dateFrom && convDate < new Date(dateFrom)) return false;
        if (dateTo && convDate > new Date(dateTo + 'T23:59:59')) return false;
      }
    }
    
    return true;
  });

  // Audio handler
  const handlePlayAudio = async (conversationId: string) => {
    setIsLoadingAudio(true);
    setAudioUnavailable(false);
    setAudioUrl(null);
    
    try {
      const result = await audioMutation.mutateAsync({ conversationId, format: 'mp3' });
      
      if (result?.audio_unavailable) {
        setAudioUnavailable(true);
        toast.error(`Audio non disponible: ${result.reason || 'raison inconnue'}`);
      } else if (result?.audio_url) {
        setAudioUrl(result.audio_url);
        toast.success('Audio chargé');
      } else {
        setAudioUnavailable(true);
        toast.error("Impossible de charger l'audio");
      }
    } catch (error) {
      console.error('Audio error:', error);
      setAudioUnavailable(true);
      toast.error("Erreur lors du chargement de l'audio");
    } finally {
      setIsLoadingAudio(false);
    }
  };

  // CSV Export
  const exportToCSV = () => {
    const headers = ['ID', 'Date', 'Durée (s)', 'Messages', 'Statut'];
    const rows = filteredConversations.map(c => [
      c.conversation_id,
      c.start_time_unix_secs ? new Date(c.start_time_unix_secs * 1000).toISOString() : '',
      c.call_duration_secs || 0,
      c.message_count || 0,
      c.status || ''
    ]);
    
    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `conversations_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    toast.success('Export CSV téléchargé');
  };

  const clearFilters = () => {
    setSearchTerm('');
    setDurationFilter([0, 600]);
    setDateFrom('');
    setDateTo('');
  };

  const activeFiltersCount = [
    searchTerm,
    durationFilter[0] > 0 || durationFilter[1] < 600,
    dateFrom,
    dateTo
  ].filter(Boolean).length;

  // Helper to safely format timestamps
  const formatTimestamp = (unixSecs: number | undefined, formatStr: string): string => {
    if (!unixSecs || isNaN(unixSecs)) return 'Date inconnue';
    try {
      const date = new Date(unixSecs * 1000);
      if (isNaN(date.getTime())) return 'Date inconnue';
      return format(date, formatStr, { locale: fr });
    } catch {
      return 'Date inconnue';
    }
  };

  const safeDuration = (seconds: number | undefined): number => {
    if (seconds === undefined || isNaN(seconds)) return 0;
    return Math.floor(seconds);
  };

  const getStatusVariant = (status: string): 'success' | 'destructive' | 'secondary' => {
    switch (status) {
      case 'done':
      case 'completed': return 'success';
      case 'failed':
      case 'error': return 'destructive';
      default: return 'secondary';
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Reset audio when changing conversation
  const handleSelectConversation = (id: string) => {
    setSelectedConversationId(id);
    setAudioUrl(null);
    setAudioUnavailable(false);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PortalPageHeader
        icon={MessageSquare}
        title="Conversations"
        description={session?.agentName}
        gradient="blue-purple"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2">
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV} className="gap-2">
              <Download className="h-4 w-4" />
              CSV
            </Button>
            <Button 
              variant={showFilters ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowFilters(!showFilters)}
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtres
              {activeFiltersCount > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </div>
        }
      />

      {/* Filters Panel */}
      {showFilters && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold">Filtres avancés</h4>
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="h-4 w-4 mr-1" /> Réinitialiser
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Durée (secondes)</label>
                <Slider
                  value={durationFilter}
                  onValueChange={(v) => setDurationFilter(v as [number, number])}
                  min={0}
                  max={600}
                  step={10}
                />
                <p className="text-xs text-muted-foreground">
                  {formatDuration(durationFilter[0])} - {formatDuration(durationFilter[1])}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de début</label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Date de fin</label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="bg-muted/30"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      {!isLoading && conversations.length === 0 && (
        <Card className="bg-card/50 backdrop-blur-sm border-border/30">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune conversation</h3>
            <p className="text-muted-foreground text-center max-w-md">
              Aucune conversation n'a encore été enregistrée pour cet agent.
            </p>
          </CardContent>
        </Card>
      )}

      {conversations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Conversations List */}
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur-sm border-border/30">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Rechercher..." 
                  value={searchTerm} 
                  onChange={(e) => setSearchTerm(e.target.value)} 
                  className="pl-10 bg-muted/30 border-border/50" 
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {filteredConversations.length} conversation(s) sur {conversations.length}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-3 space-y-2">
                  {filteredConversations.map((conversation, index) => (
                    <motion.div
                      key={conversation.conversation_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      onClick={() => handleSelectConversation(conversation.conversation_id)}
                      className={`p-4 rounded-xl cursor-pointer transition-all border ${
                        selectedConversationId === conversation.conversation_id
                          ? 'bg-primary/10 border-primary/30 shadow-lg shadow-primary/5'
                          : 'bg-muted/20 border-border/30 hover:bg-muted/40 hover:border-border/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[120px]">
                              {conversation.conversation_id.slice(0, 8)}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(conversation.start_time_unix_secs, 'PPp')}
                            </p>
                          </div>
                        </div>
                        <GlowBadge variant={getStatusVariant(conversation.status)} className="text-xs">
                          {conversation.status}
                        </GlowBadge>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(conversation.call_duration_secs)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {conversation.message_count} msgs
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Conversation Detail */}
          <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border/30">
            {detailsLoading && selectedConversationId && (
              <div className="flex items-center justify-center h-[600px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            )}

            {selectedConversation ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-full flex flex-col"
              >
                <CardHeader className="border-b border-border/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                        <Phone className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">Conversation</h3>
                        <p className="text-sm text-muted-foreground">
                          {formatTimestamp(selectedConversation.start_time_unix_secs, 'PPPp')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(selectedConversation.call_duration_secs)}
                      </Badge>
                      <GlowBadge variant={getStatusVariant(selectedConversation.status)}>
                        {selectedConversation.status}
                      </GlowBadge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 p-6 overflow-auto">
                  <div className="space-y-6">
                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Messages', value: selectedConversation.message_count, icon: MessageSquare },
                        { label: 'Durée', value: formatDuration(selectedConversation.call_duration_secs), icon: Clock },
                        { label: 'Statut', value: selectedConversation.status, icon: TrendingUp },
                      ].map((metric) => (
                        <div key={metric.label} className="p-4 rounded-xl bg-muted/20 border border-border/30">
                          <metric.icon className="h-4 w-4 text-primary mb-2" />
                          <p className="text-2xl font-bold">{metric.value}</p>
                          <p className="text-xs text-muted-foreground">{metric.label}</p>
                        </div>
                      ))}
                    </div>

                    {/* Audio Player Section */}
                    <div className="p-4 rounded-xl bg-muted/10 border border-border/30">
                      <h4 className="font-semibold mb-3 flex items-center gap-2">
                        <Volume2 className="h-4 w-4 text-primary" />
                        Écouter l'appel
                      </h4>
                      
                      {!audioUrl && !audioUnavailable && !isLoadingAudio && (
                        <Button 
                          onClick={() => handlePlayAudio(selectedConversation.conversation_id)}
                          className="gap-2"
                        >
                          <Volume2 className="h-4 w-4" />
                          Charger l'audio
                        </Button>
                      )}
                      
                      {isLoadingAudio && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Chargement de l'audio...
                        </div>
                      )}
                      
                      {audioUnavailable && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <AlertCircle className="h-4 w-4" />
                          Audio non disponible pour cette conversation
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={() => handlePlayAudio(selectedConversation.conversation_id)}
                          >
                            Réessayer
                          </Button>
                        </div>
                      )}
                      
                      {audioUrl && (
                        <AdvancedAudioPlayer 
                          audioUrl={audioUrl} 
                          conversation={{
                            conversation_id: selectedConversation.conversation_id,
                            duration_seconds: selectedConversation.call_duration_secs
                          }}
                        />
                      )}
                    </div>

                    {/* AI Analysis Section */}
                    {selectedConversation.analysis && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
                        <h4 className="font-semibold mb-4 flex items-center gap-2">
                          <Brain className="h-4 w-4 text-primary" />
                          Analyse IA
                        </h4>
                        
                        <div className="space-y-4">
                          {/* Summary */}
                          {((selectedConversation.analysis as any).summary || (selectedConversation.analysis as any).transcript_summary) && (
                            <div className="p-3 rounded-lg bg-muted/20">
                              <h5 className="text-sm font-medium mb-2 flex items-center gap-2">
                                <FileText className="h-3 w-3" />
                                Résumé
                              </h5>
                              <p className="text-sm text-muted-foreground">
                                {(selectedConversation.analysis as any).summary || (selectedConversation.analysis as any).transcript_summary}
                              </p>
                            </div>
                          )}
                          
                          {/* Call Success */}
                          {selectedConversation.analysis.call_successful !== undefined && (
                            <div className="flex items-center gap-2">
                              {selectedConversation.analysis.call_successful === 'success' || String(selectedConversation.analysis.call_successful) === 'true' ? (
                                <Badge className="bg-green-500/20 text-green-600 gap-1">
                                  <CheckCircle className="h-3 w-3" />
                                  Appel réussi
                                </Badge>
                              ) : (
                                <Badge className="bg-red-500/20 text-red-600 gap-1">
                                  <XCircle className="h-3 w-3" />
                                  Appel non réussi
                                </Badge>
                              )}
                            </div>
                          )}
                          
                          {/* Data Collection Results */}
                          {selectedConversation.analysis.data_collection_results && 
                           Object.keys(selectedConversation.analysis.data_collection_results).length > 0 && (
                            <div className="p-3 rounded-lg bg-muted/20">
                              <h5 className="text-sm font-medium mb-2">Informations collectées</h5>
                              <div className="grid grid-cols-2 gap-2">
                                {Object.entries(selectedConversation.analysis.data_collection_results).map(([key, value]) => (
                                  <div key={key} className="text-sm">
                                    <span className="text-muted-foreground">{key}:</span>{' '}
                                    <span className="font-medium">{String(value) || '-'}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Evaluation Criteria */}
                          {selectedConversation.analysis.evaluation_criteria_results && 
                           Object.keys(selectedConversation.analysis.evaluation_criteria_results).length > 0 && (
                            <div className="p-3 rounded-lg bg-muted/20">
                              <h5 className="text-sm font-medium mb-2">Critères d'évaluation</h5>
                              <div className="flex flex-wrap gap-2">
                                {Object.entries(selectedConversation.analysis.evaluation_criteria_results).map(([key, value]) => {
                                  const isSuccess = value === 'success' || value === true || value === 'true';
                                  return (
                                    <Badge 
                                      key={key} 
                                      variant="outline"
                                      className={isSuccess ? 'border-green-500/50 text-green-600' : 'border-red-500/50 text-red-600'}
                                    >
                                      {isSuccess ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                                      {key}
                                    </Badge>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          
                          {/* Fallback if no detailed analysis */}
                          {!(selectedConversation.analysis as any).summary && 
                           !(selectedConversation.analysis as any).transcript_summary &&
                           !selectedConversation.analysis.data_collection_results &&
                           !selectedConversation.analysis.evaluation_criteria_results && (
                            <p className="text-sm text-muted-foreground">
                              L'analyse détaillée n'est pas disponible pour cette conversation.
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Transcript */}
                    {selectedConversation.transcript && selectedConversation.transcript.length > 0 ? (
                      <div className="space-y-4">
                        <h4 className="font-semibold flex items-center gap-2">
                          <Volume2 className="h-4 w-4 text-primary" />
                          Transcription
                        </h4>
                        <ScrollArea className="h-[300px] rounded-xl border border-border/30 p-4">
                          <div className="space-y-3">
                            {selectedConversation.transcript.map((entry, idx) => (
                              <div
                                key={idx}
                                className={`flex gap-3 ${entry.role === 'agent' ? 'flex-row' : 'flex-row-reverse'}`}
                              >
                                <div className={`max-w-[80%] p-3 rounded-xl ${
                                  entry.role === 'agent' 
                                    ? 'bg-primary/10 border border-primary/20' 
                                    : 'bg-muted/30 border border-border/30'
                                }`}>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">
                                    {entry.role === 'agent' ? 'Agent' : 'Utilisateur'} • {formatDuration(safeDuration(entry.time_in_call_secs))}
                                  </p>
                                  <p className="text-sm">{entry.message}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </ScrollArea>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-muted/10 border border-border/30 border-dashed">
                        <p className="text-sm text-muted-foreground text-center">
                          Transcription non disponible pour cette conversation
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </motion.div>
            ) : !detailsLoading && (
              <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
                <div className="w-20 h-20 rounded-2xl bg-muted/20 flex items-center justify-center mb-4">
                  <MessageSquare className="h-10 w-10 opacity-30" />
                </div>
                <p className="text-lg font-medium">Sélectionnez une conversation</p>
                <p className="text-sm">Pour voir les détails et la transcription</p>
              </div>
            )}
          </Card>
        </div>
      )}
    </motion.div>
  );
};

export default PortalConversations;