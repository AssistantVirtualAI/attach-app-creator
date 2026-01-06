import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { usePortalPlatformConversations } from '@/hooks/usePortalPlatformData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, MessageSquare, Search, Clock, AlertCircle, Phone } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import { useTranslation } from '@/hooks/useTranslation';

export default function PortalConversationsGeneric() {
  const { t } = useTranslation();
  const { session } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { data: conversationsData, isLoading } = usePortalPlatformConversations(1, 200);
  const conversations = conversationsData?.conversations || [];

  const filtered = conversations.filter((c) =>
    !searchTerm || c.conversation_id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selected = filtered.find((c) => c.conversation_id === selectedConversationId) || null;

  const formatTimestamp = (unixSecs: number | undefined) => {
    if (!unixSecs || isNaN(unixSecs)) return t('common.unknownDate');
    try {
      const date = new Date(unixSecs * 1000);
      if (isNaN(date.getTime())) return t('common.unknownDate');
      return format(date, 'PPp', { locale: enUS });
    } catch {
      return t('common.unknownDate');
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor((seconds || 0) / 60);
    const secs = (seconds || 0) % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusVariant = (status: string) => {
    if (status === 'ended' || status === 'done' || status === 'completed') return 'success' as const;
    if (status === 'failed' || status === 'error') return 'destructive' as const;
    return 'secondary' as const;
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PortalPageHeader
        icon={MessageSquare}
        title={t('clientPortal.nav.conversations')}
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
            <h3 className="text-lg font-semibold mb-2">{t('clientPortal.conversations.noConversations')}</h3>
            <p className="text-muted-foreground text-center max-w-md">
              {t('clientPortal.conversations.noConversationsDesc')}
            </p>
          </CardContent>
        </Card>
      )}

      {!isLoading && conversations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-1 bg-card/50 backdrop-blur-sm border-border/30">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t('common.search')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-muted/30 border-border/50"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                {filtered.length} {t('clientPortal.conversations.conversationsOf')} {conversations.length}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[600px]">
                <div className="p-3 space-y-2">
                  {filtered.map((conversation, index) => (
                    <motion.div
                      key={conversation.conversation_id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
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
                            <Phone className="h-4 w-4 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium text-sm truncate max-w-[120px]">
                              {conversation.conversation_id.slice(0, 8)}...
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {formatTimestamp(conversation.start_time_unix_secs)}
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

          <Card className="lg:col-span-2 bg-card/50 backdrop-blur-sm border-border/30">
            {!selected && (
              <div className="flex flex-col items-center justify-center h-[600px] text-muted-foreground">
                <MessageSquare className="h-12 w-12 mb-4 opacity-50" />
                <p>{t('clientPortal.conversations.selectConversation')}</p>
              </div>
            )}

            {selected && (
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{t('clientPortal.conversations.conversation')}</h3>
                    <p className="text-sm text-muted-foreground">{selected.conversation_id}</p>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {session?.platform}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground">{t('clientPortal.conversations.date')}</p>
                    <p className="font-medium">{formatTimestamp(selected.start_time_unix_secs)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground">{t('clientPortal.conversations.duration')}</p>
                    <p className="font-medium">{formatDuration(selected.call_duration_secs)}</p>
                  </div>
                  <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                    <p className="text-xs text-muted-foreground">{t('clientPortal.conversations.status')}</p>
                    <p className="font-medium">{selected.status}</p>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-muted/20 border border-border/30">
                  <p className="text-xs text-muted-foreground mb-2">{t('clientPortal.conversations.caller')}</p>
                  <p className="font-medium">{selected.metadata?.caller_id || '—'}</p>
                </div>

                <div className="p-4 rounded-xl bg-muted/10 border border-border/30">
                  <p className="text-sm text-muted-foreground">
                    Les détails (transcript/audio/analyse) ne sont pas encore disponibles pour {String(session?.platform).toUpperCase()} dans ce portail.
                  </p>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}
    </motion.div>
  );
}
