import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Search, Filter, Clock, TrendingUp, TrendingDown, Minus, ExternalLink, 
  Download, Trash2, ChevronLeft, ChevronRight 
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ConversationDetailModal } from '@/components/conversations/ConversationDetailModal';
import { useConversations, useDeleteConversation, ConversationsFilters } from '@/hooks/useConversations';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const Conversations = () => {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [filters, setFilters] = useState<ConversationsFilters>({});
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  
  const { data, isLoading } = useConversations(page, pageSize, filters);
  const deleteConversation = useDeleteConversation();

  const getPlatformColor = (platform: string | null) => {
    switch (platform) {
      case 'elevenlabs':
        return 'bg-primary/20 text-primary border-primary/30';
      case 'vapi':
        return 'bg-secondary/20 text-secondary border-secondary/30';
      case 'retell':
        return 'bg-accent/20 text-accent border-accent/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSentimentIcon = (sentiment: string | null) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return 'N/A';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteConversation.mutateAsync(id);
      toast.success('Conversation supprimée');
    } catch {
      toast.error('Erreur lors de la suppression');
    }
  };

  const exportToCSV = () => {
    if (!data?.data.length) {
      toast.error('Aucune donnée à exporter');
      return;
    }

    const headers = ['Titre', 'Plateforme', 'Durée (s)', 'Sentiment', 'Score', 'Statut', 'Date'];
    const csvContent = [
      headers.join(','),
      ...data.data.map(conv => [
        `"${conv.title.replace(/"/g, '""')}"`,
        conv.platform || '',
        conv.duration || '',
        conv.sentiment || '',
        conv.satisfaction_score || '',
        conv.status || '',
        conv.created_at
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `conversations_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Export CSV téléchargé');
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold mb-2 gradient-text">Conversations</h1>
            <p className="text-muted-foreground text-lg">
              {data?.count || 0} conversations au total
            </p>
          </div>
          <Button onClick={exportToCSV} variant="outline" className="gap-2">
            <Download className="w-4 h-4" />
            Export CSV
          </Button>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <div className="flex-1 min-w-64 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher des conversations..."
              value={filters.search || ''}
              onChange={(e) => {
                setFilters(f => ({ ...f, search: e.target.value }));
                setPage(1);
              }}
              className="pl-10 glass-card"
            />
          </div>
          
          <Select 
            value={filters.platform || 'all'} 
            onValueChange={(v) => {
              setFilters(f => ({ ...f, platform: v }));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Plateforme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes</SelectItem>
              <SelectItem value="elevenlabs">ElevenLabs</SelectItem>
              <SelectItem value="vapi">Vapi</SelectItem>
              <SelectItem value="retell">Retell</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.sentiment || 'all'} 
            onValueChange={(v) => {
              setFilters(f => ({ ...f, sentiment: v }));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sentiment" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous</SelectItem>
              <SelectItem value="positive">Positif</SelectItem>
              <SelectItem value="neutral">Neutre</SelectItem>
              <SelectItem value="negative">Négatif</SelectItem>
            </SelectContent>
          </Select>

          <Select 
            value={filters.dateRange || 'all'} 
            onValueChange={(v) => {
              setFilters(f => ({ ...f, dateRange: v as any }));
              setPage(1);
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Période" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tout</SelectItem>
              <SelectItem value="today">Aujourd'hui</SelectItem>
              <SelectItem value="7days">7 jours</SelectItem>
              <SelectItem value="30days">30 jours</SelectItem>
            </SelectContent>
          </Select>
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
          ) : data?.data.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Aucune conversation trouvée</p>
              </CardContent>
            </Card>
          ) : (
            data?.data.map((conversation) => (
              <Card 
                key={conversation.id} 
                className="glass-card hover:neon-border transition-all duration-200 cursor-pointer"
                onClick={() => setSelectedConversationId(conversation.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{conversation.title}</h3>
                        {conversation.platform && (
                          <Badge className={getPlatformColor(conversation.platform)}>
                            {conversation.platform}
                          </Badge>
                        )}
                        {getSentimentIcon(conversation.sentiment)}
                      </div>

                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDuration(conversation.duration)}
                        </div>
                        {conversation.satisfaction_score && (
                          <div>Satisfaction: {conversation.satisfaction_score}/5</div>
                        )}
                        <div>
                          {format(new Date(conversation.created_at), 'dd MMM yyyy HH:mm', { locale: fr })}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {conversation.status && (
                        <Badge variant="outline">
                          {conversation.status}
                        </Badge>
                      )}
                      <Link 
                        to={`/conversations/${conversation.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="ghost" size="sm" className="gap-2">
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </Link>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="ghost" 
                            size="sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Trash2 className="w-4 h-4 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Supprimer la conversation ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Cette action est irréversible.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={(e) => handleDelete(conversation.id, e)}
                              className="bg-destructive text-destructive-foreground"
                            >
                              Supprimer
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
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

        {/* Modal de détails */}
        {selectedConversationId && (
          <ConversationDetailModal
            isOpen={!!selectedConversationId}
            onClose={() => setSelectedConversationId(null)}
            conversationId={selectedConversationId}
          />
        )}
      </div>
    </AppLayout>
  );
};

export default Conversations;