import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, TrendingUp, TrendingDown, Minus,
  ChevronLeft, ChevronRight, Play, Sparkles, Search,
  MessageCircle, Phone, User
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
import { fr, enUS } from 'date-fns/locale';
import { useAllAgentsConversations, ConversationFilters as Filters } from '@/hooks/useAllAgentsConversations';
import { ConversationFilters } from '@/components/filters/ConversationFilters';
import { ConversationExport } from '@/components/exports/ConversationExport';
import { SetupIntegrationCard } from '@/components/SetupIntegrationCard';
import { ElevenLabsConversationModal } from '@/components/conversations/ElevenLabsConversationModal';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { useTranslation } from '@/hooks/useTranslation';
import { useLanguage } from '@/context/LanguageContext';

const Conversations = () => {
  const { t } = useTranslation();
  const { language } = useLanguage();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<Filters>({});
  const [selectedConversation, setSelectedConversation] = useState<{
    id: string;
    agentName: string;
    platformAgentId: string;
  } | null>(null);
  
  const { data, isLoading } = useAllAgentsConversations(page, pageSize, filters);

  const dateLocale = language === 'fr' ? fr : enUS;

  const getSentimentVariant = (sentiment: string | undefined): 'success' | 'warning' | 'destructive' | 'info' => {
    switch (sentiment) {
      case 'positive':
        return 'success';
      case 'negative':
        return 'destructive';
      default:
        return 'warning';
    }
  };

  const getSentimentIcon = (sentiment: string | undefined) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-3 h-3" />;
      case 'negative':
        return <TrendingDown className="w-3 h-3" />;
      default:
        return <Minus className="w-3 h-3" />;
    }
  };

  const getSentimentLabel = (sentiment: string | undefined) => {
    switch (sentiment) {
      case 'positive':
        return t('conversations.sentiment.positive');
      case 'negative':
        return t('conversations.sentiment.negative');
      default:
        return t('conversations.sentiment.neutral');
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
        <div className="space-y-6">
          <PortalPageHeader
            title={t('conversations.title')}
            description={t('conversations.allConversations')}
            icon={MessageCircle}
          />
          <SetupIntegrationCard 
            title={t('conversations.configRequired')} 
            message={data.message || t('conversations.configMessage')} 
          />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <PortalPageHeader
            title={t('conversations.title')}
            description={t('conversations.description').replace('{total}', String(data?.total || 0)).replace('{agents}', String(data?.agents?.length || 0))}
            icon={MessageCircle}
          />
          <ConversationExport 
            conversations={data?.conversations || []} 
            filename="conversations"
          />
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[
            { label: t('conversations.stats.total'), value: data?.total || 0, icon: MessageCircle, gradient: 'from-primary to-secondary' },
            { label: t('conversations.stats.activeAgents'), value: data?.agents?.length || 0, icon: User, gradient: 'from-secondary to-accent' },
            { label: t('conversations.stats.positive'), value: data?.conversations?.filter((c: any) => c.analysis?.sentiment === 'positive').length || 0, icon: TrendingUp, gradient: 'from-success to-neon-green' },
            { label: t('conversations.stats.avgDuration'), value: data?.conversations?.length ? formatDuration(Math.round(data.conversations.reduce((acc: number, c: any) => acc + (c.call_duration_secs || c.duration || 0), 0) / data.conversations.length)) : '0m', icon: Phone, gradient: 'from-warning to-sunset-orange' },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className="relative overflow-hidden border border-border bg-card">
                <div className={`absolute inset-0 bg-gradient-to-r ${stat.gradient} opacity-10`} />
                <CardContent className="p-4 relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold text-foreground mt-1">{stat.value}</p>
                    </div>
                    <div className={`p-3 rounded-xl bg-gradient-to-br ${stat.gradient} shadow-lg`}>
                      <stat.icon className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="border border-border bg-card">
            <CardContent className="p-4">
              <ConversationFilters
                filters={filters}
                onFiltersChange={handleFiltersChange}
                agents={data?.agents || []}
                onSearch={handleSearch}
              />
            </CardContent>
          </Card>
        </motion.div>

        {/* Conversations List */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="space-y-3"
        >
          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="border border-border bg-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Skeleton className="w-12 h-12 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-48 bg-muted" />
                      <Skeleton className="h-3 w-32 bg-muted" />
                    </div>
                    <Skeleton className="h-8 w-20 bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : data?.conversations?.length === 0 ? (
            <Card className="border border-border bg-card">
              <CardContent className="p-12 text-center">
                <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-2">{t('conversations.empty.title')}</h3>
                <p className="text-muted-foreground">{t('conversations.empty.description')}</p>
              </CardContent>
            </Card>
          ) : (
            data?.conversations?.map((conversation: any, index: number) => {
              const duration = conversation.call_duration_secs || conversation.duration || 0;
              const startTime = conversation.start_time || conversation.metadata?.start_time;
              const sentiment = conversation.analysis?.sentiment;
              const satisfaction = conversation.analysis?.satisfaction_score;
              
              return (
                <motion.div
                  key={conversation.conversation_id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Card 
                    className="group cursor-pointer border border-border bg-card hover:bg-muted/50 transition-all duration-300 hover:shadow-lg hover:border-primary/30"
                    onClick={() => setSelectedConversation({
                      id: conversation.conversation_id,
                      agentName: conversation.agent_name,
                      platformAgentId: conversation.platform_agent_id
                    })}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-center gap-4">
                        {/* Avatar */}
                        <div className="relative">
                          <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-full blur opacity-40 group-hover:opacity-60 transition-opacity" />
                          <div className="relative w-12 h-12 bg-gradient-to-br from-primary to-secondary rounded-full flex items-center justify-center">
                            <User className="h-6 w-6 text-primary-foreground" />
                          </div>
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-foreground">
                              {t('conversations.conversation')} {conversation.conversation_id.substring(0, 8)}
                            </h3>
                            <Badge className="bg-primary/20 text-primary border-primary/30">
                              {conversation.agent_name}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-6 text-sm text-muted-foreground">
                            <div className="flex items-center gap-2">
                              <Clock className="w-4 h-4" />
                              {formatDuration(duration)}
                            </div>
                            {satisfaction !== undefined && (
                              <div>{t('conversations.satisfaction')}: {(satisfaction * 100).toFixed(0)}%</div>
                            )}
                            {startTime && (
                              <div>
                                {format(new Date(startTime), 'dd MMM yyyy HH:mm', { locale: dateLocale })}
                              </div>
                            )}
                          </div>

                          {conversation.analysis?.summary && (
                            <p className="mt-2 text-sm text-muted-foreground line-clamp-2">
                              {conversation.analysis.summary}
                            </p>
                          )}
                        </div>

                        {/* Sentiment & Actions */}
                        <div className="flex items-center gap-3">
                          <GlowBadge variant={getSentimentVariant(sentiment)}>
                            {getSentimentIcon(sentiment)}
                            <span className="ml-1 capitalize">{getSentimentLabel(sentiment)}</span>
                          </GlowBadge>

                          <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-primary/20 hover:bg-primary/30 text-primary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Play className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 rounded-full bg-secondary/20 hover:bg-secondary/30 text-secondary"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Sparkles className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </motion.div>

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">{t('conversations.pagination.show')}</span>
              <Select 
                value={pageSize.toString()} 
                onValueChange={(v) => {
                  setPageSize(Number(v));
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-20 bg-muted/50 border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="20">20</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                  <SelectItem value="100">100</SelectItem>
                </SelectContent>
              </Select>
              <span className="text-sm text-muted-foreground">{t('conversations.pagination.perPage')}</span>
            </div>

            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border-primary/30 hover:bg-primary/20"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-foreground px-3">
                {t('conversations.pagination.page')} {page} {t('conversations.pagination.of')} {data.totalPages}
              </span>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => setPage(p => Math.min(data.totalPages, p + 1))}
                disabled={page === data.totalPages}
                className="border-primary/30 hover:bg-primary/20"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </motion.div>
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