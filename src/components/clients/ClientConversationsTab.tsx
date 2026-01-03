import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { MessageSquare, Clock, CheckCircle, XCircle, AlertCircle, Filter } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

interface ClientConversationsTabProps {
  clientId: string;
}

type StatusFilter = 'all' | 'resolved' | 'unresolved' | 'pending';

export function ClientConversationsTab({ clientId }: ClientConversationsTabProps) {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const { data: conversations, isLoading } = useQuery({
    queryKey: ['client-conversations', clientId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          id,
          title,
          created_at,
          duration,
          resolution_status,
          sentiment,
          satisfaction_score,
          agent:agents(id, name, platform)
        `)
        .eq('client_id', clientId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
  });

  const filteredConversations = conversations?.filter(conv => {
    if (statusFilter === 'all') return true;
    if (statusFilter === 'resolved') return conv.resolution_status === 'resolved';
    if (statusFilter === 'unresolved') return conv.resolution_status === 'unresolved';
    if (statusFilter === 'pending') return !conv.resolution_status || conv.resolution_status === 'pending';
    return true;
  });

  const getStatusIcon = (status: string | null) => {
    switch (status) {
      case 'resolved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'unresolved':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
    }
  };

  const getStatusBadge = (status: string | null) => {
    switch (status) {
      case 'resolved':
        return <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Résolue</Badge>;
      case 'unresolved':
        return <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">Non résolue</Badge>;
      default:
        return <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">En cours</Badge>;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return '-';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader>
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="glass-card">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5" />
          Conversations récentes
        </CardTitle>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="resolved">Résolues</SelectItem>
              <SelectItem value="unresolved">Non résolues</SelectItem>
              <SelectItem value="pending">En cours</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {!filteredConversations?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
            <p>Aucune conversation trouvée</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredConversations.map((conv) => (
              <div
                key={conv.id}
                onClick={() => navigate(`/conversations/${conv.id}`)}
                className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {getStatusIcon(conv.resolution_status)}
                      <span className="font-medium truncate">{conv.title}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDistanceToNow(new Date(conv.created_at), { addSuffix: true, locale: fr })}
                      </span>
                      {conv.duration && (
                        <span>Durée: {formatDuration(conv.duration)}</span>
                      )}
                      {conv.agent && (
                        <span>Agent: {conv.agent.name}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {conv.satisfaction_score && (
                      <Badge variant="secondary">{conv.satisfaction_score}/5</Badge>
                    )}
                    {getStatusBadge(conv.resolution_status)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
