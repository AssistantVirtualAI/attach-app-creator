import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, TrendingUp, TrendingDown, Minus, ExternalLink, 
  ChevronLeft, ChevronRight, Play, Sparkles
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useAllAgentsConversations, ConversationFilters as Filters } from '@/hooks/useAllAgentsConversations';
import { ConversationFilters } from '@/components/filters/ConversationFilters';
import { ConversationExport } from '@/components/exports/ConversationExport';
import { SetupIntegrationCard } from '@/components/SetupIntegrationCard';
import { ElevenLabsConversationModal } from '@/components/conversations/ElevenLabsConversationModal';

const Conversations = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>({});
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    agentName: string;
    platformAgentId: string;
  } | null>(null);
  
  const { data, isLoading } = useAllAgentsConversations(page, pageSize, filters);

  const getSentimentIcon = (sentiment: string | undefined) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (seconds: number | undefined) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleSearch = (search: string) => {
    setFilters(f => ({ ...f, search }));
    setPage(1);
  };

  const handleFiltersChange = (newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1);
  };

  // Show setup message if no agents configured
  if (data?.requiresSetup) {
    return (
      <AppLayout>
        <div className="container mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-2 gradient-text">Conversations</h1>
            <p className="text-muted-foreground text-lg">
              Toutes les conversations de vos agents vocaux
            </p>
          </div>
          <SetupIntegrationCard 
            title="Configuration Requise" 
            message={data.message || 'Veuillez configurer au moins un agent ElevenLabs pour voir les conversations.'} 
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Conversations</h1>
            <p className="text-muted-foreground text-lg">
              {data?.total || 0} conversations au total • {data?.agents?.length || 0} agents
            </p>
          </div>
          <ConversationExport 
            conversations={data?.conversations || []} 
            filename="conversations"
          />
        </div>

        {/* Filters */}
        <div className="mb-6">
          <ConversationFilters
            filters={filters}
            onFiltersChange={handleFiltersChange}
            agents={data?.agents || []}
            onSearch={handleSearch}
          />
        </div>

        {/* Conversations List */}
        <div className="space-y-4">
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="glass-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="space-y-2 flex-1">
                      <Skeleton className="h-6 w-64" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                    <Skeleton className="h-8 w-24" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : data?.conversations?.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Aucune conversation trouvée</p>
              </CardContent>
            </Card>
          ) : (
            data?.conversations?.map((conversation) => {
              const duration = conversation.call_duration_secs || conversation.duration || 0;
              const startTime = conversation.start_time || conversation.metadata?.start_time;
              const sentiment = conversation.analysis?.sentiment;
              const satisfaction = conversation.analysis?.satisfaction_score;
              
              return (
                <Card 
                  key={conversation.conversation_id} 
                  className="glass-card hover:neon-border transition-all duration-200 cursor-pointer"
                  onClick={() => setSelectedConversation({
                    id: conversation.conversation_id,
                    agentName: conversation.agent_name,
                    platformAgentId: conversation.platform_agent_id
                  })}
                >
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            Conversation {conversation.conversation_id.substring(0, 8)}
                          </h3>
                          <Badge className="bg-primary/20 text-primary border-primary/30">
                            {conversation.agent_name}
                          </Badge>
                          {getSentimentIcon(sentiment)}
                        </div>

                        <div className="flex items-center gap-6 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <Clock className="w-4 h-4" />
                            {formatDuration(duration)}
                          </div>
                          {satisfaction !== undefined && (
                            <div>Satisfaction: {(satisfaction * 100).toFixed(0)}%</div>
                          )}
                          {startTime && (
                            <div>
                              {format(new Date(startTime), 'dd MMM yyyy HH:mm', { locale: fr })}
                            </div>
                          )}
                        </div>

                        {conversation.analysis?.summary && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {conversation.analysis.summary}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Play className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="gap-2">
                          <Sparkles className="w-4 h-4 text-primary" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Afficher</span>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">par page</span>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm">
                Page {page} sur {data.totalPages}
              </span>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* ElevenLabs Conversation Modal with AI Analysis */}
        <ElevenLabsConversationModal
          isOpen={!!selectedConversation}
          onClose={() => setSelectedConversation(null)}
          conversationId={selectedConversation?.id || null}
          agentName={selectedConversation?.agentName}
          platformAgentId={selectedConversation?.platformAgentId}
        />
      </div>
    </AppLayout>
  );
};

export default Conversations;
