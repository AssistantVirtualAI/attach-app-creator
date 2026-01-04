import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalConversations, usePortalConversationDetails } from '@/hooks/usePortalElevenLabs';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Search, Phone, Clock, TrendingUp, User, Loader2, AlertCircle, Play, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PortalConversations = () => {
  const { session } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: conversationsData, isLoading } = usePortalConversations(page, 50);
  const { data: selectedConversation, isLoading: detailsLoading } = usePortalConversationDetails(selectedConversationId);

  const conversations = conversationsData?.conversations || [];

  const filteredConversations = conversations.filter(c => 
    c.conversation_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

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

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PortalPageHeader
        icon={MessageSquare}
        title="Conversations"
        description={session?.agentName}
        gradient="blue-purple"
      />

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
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-3 space-y-2">
                  {filteredConversations.map((conversation, index) => (
                    <motion.div
                      key={conversation.conversation_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      onClick={() => setSelectedConversationId(conversation.conversation_id)}
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
                              {format(new Date(conversation.start_time_unix_secs * 1000), 'PPp', { locale: fr })}
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
                          {format(new Date(selectedConversation.start_time_unix_secs * 1000), 'PPPp', { locale: fr })}
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
                                    {entry.role === 'agent' ? 'Agent' : 'Utilisateur'} • {formatDuration(Math.floor(entry.time_in_call_secs))}
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

                    {/* Analysis */}
                    {selectedConversation.analysis && (
                      <div className="p-4 rounded-xl bg-gradient-to-br from-primary/5 to-purple-500/5 border border-primary/20">
                        <h4 className="font-semibold mb-3 flex items-center gap-2">
                          <TrendingUp className="h-4 w-4 text-primary" />
                          Analyse IA
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          {selectedConversation.analysis.call_successful && (
                            <div>
                              <span className="text-muted-foreground">Succès:</span>{' '}
                              <span className="font-medium">{selectedConversation.analysis.call_successful}</span>
                            </div>
                          )}
                        </div>
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
