import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Search, Filter, Clock, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Link } from 'react-router-dom';

// Mock data
const mockConversations = [
  {
    id: '1',
    title: 'Support Client - Problème de connexion',
    duration: 245,
    platform: 'elevenlabs',
    status: 'completed',
    sentiment: 'positive',
    satisfaction_score: 4.5,
    created_at: new Date('2025-10-26T14:30:00'),
  },
  {
    id: '2',
    title: 'Demande d\'information produit',
    duration: 180,
    platform: 'vapi',
    status: 'completed',
    sentiment: 'neutral',
    satisfaction_score: 3.8,
    created_at: new Date('2025-10-26T13:15:00'),
  },
  {
    id: '3',
    title: 'Réclamation livraison',
    duration: 320,
    platform: 'retell',
    status: 'completed',
    sentiment: 'negative',
    satisfaction_score: 2.5,
    created_at: new Date('2025-10-26T11:45:00'),
  },
];

const Conversations = () => {
  const [searchQuery, setSearchQuery] = useState('');

  const getPlatformColor = (platform: string) => {
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

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <TrendingUp className="w-4 h-4 text-success" />;
      case 'negative':
        return <TrendingDown className="w-4 h-4 text-destructive" />;
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 gradient-text">Conversations</h1>
          <p className="text-muted-foreground text-lg">
            Historique complet des conversations vocales IA
          </p>
        </div>

        {/* Search & Filters */}
        <div className="mb-6 flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              placeholder="Rechercher des conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 glass-card"
            />
          </div>
          <Button variant="outline" className="glass-card gap-2">
            <Filter className="w-4 h-4" />
            Filtres
          </Button>
        </div>

        {/* Conversations List */}
        <div className="space-y-4">
          {mockConversations.map((conversation) => (
            <Link key={conversation.id} to={`/conversations/${conversation.id}`}>
              <Card className="glass-card hover:neon-border transition-all duration-200 cursor-pointer">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{conversation.title}</h3>
                        <Badge className={getPlatformColor(conversation.platform)}>
                          {conversation.platform}
                        </Badge>
                        {getSentimentIcon(conversation.sentiment)}
                      </div>

                      <div className="flex items-center gap-6 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {formatDuration(conversation.duration)}
                        </div>
                        <div>Satisfaction: {conversation.satisfaction_score}/5</div>
                        <div>{formatDate(conversation.created_at)}</div>
                      </div>
                    </div>

                    <div className="text-right">
                      <Badge variant="outline" className="mb-2">
                        {conversation.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </AppLayout>
  );
};

export default Conversations;