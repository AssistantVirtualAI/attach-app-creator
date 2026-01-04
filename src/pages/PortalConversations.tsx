import { useState } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { MessageSquare, Search, Phone, Clock, TrendingUp, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { GlowBadge } from '@/components/portal/GlowBadge';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const mockConversations = [
  { id: 1, caller: 'Jean Dupont', duration: '3:42', status: 'completed', sentiment: 'positive', date: new Date() },
  { id: 2, caller: 'Marie Martin', duration: '5:18', status: 'completed', sentiment: 'neutral', date: new Date(Date.now() - 3600000) },
  { id: 3, caller: 'Pierre Bernard', duration: '2:05', status: 'missed', sentiment: 'negative', date: new Date(Date.now() - 7200000) },
  { id: 4, caller: 'Sophie Petit', duration: '8:22', status: 'completed', sentiment: 'positive', date: new Date(Date.now() - 86400000) },
  { id: 5, caller: 'Lucas Moreau', duration: '1:45', status: 'completed', sentiment: 'positive', date: new Date(Date.now() - 172800000) },
];

const PortalConversations = () => {
  const { session } = usePortal();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedConversation, setSelectedConversation] = useState<typeof mockConversations[0] | null>(null);

  const filteredConversations = mockConversations.filter(c => 
    c.caller.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getSentimentVariant = (sentiment: string): 'success' | 'destructive' | 'secondary' => {
    switch (sentiment) {
      case 'positive': return 'success';
      case 'negative': return 'destructive';
      default: return 'secondary';
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <PortalPageHeader
        icon={MessageSquare}
        title="Conversations"
        description={session?.agentName}
        gradient="blue-purple"
      />

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
                    key={conversation.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    onClick={() => setSelectedConversation(conversation)}
                    className={`p-4 rounded-xl cursor-pointer transition-all border ${
                      selectedConversation?.id === conversation.id
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
                          <p className="font-medium text-sm">{conversation.caller}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(conversation.date, 'PPp', { locale: fr })}
                          </p>
                        </div>
                      </div>
                      <GlowBadge variant={getSentimentVariant(conversation.sentiment)} className="text-xs">
                        {conversation.sentiment}
                      </GlowBadge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {conversation.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Phone className="h-3 w-3" />
                        {conversation.status === 'completed' ? 'Terminé' : 'Manqué'}
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
                      <User className="h-6 w-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{selectedConversation.caller}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(selectedConversation.date, 'PPPp', { locale: fr })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="gap-1">
                      <Clock className="h-3 w-3" />
                      {selectedConversation.duration}
                    </Badge>
                    <GlowBadge variant={getSentimentVariant(selectedConversation.sentiment)}>
                      {selectedConversation.sentiment}
                    </GlowBadge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="flex-1 p-6">
                <div className="space-y-6">
                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Score satisfaction', value: '92%', icon: TrendingUp },
                      { label: 'Durée', value: selectedConversation.duration, icon: Clock },
                      { label: 'Statut', value: selectedConversation.status === 'completed' ? 'Terminé' : 'Manqué', icon: Phone },
                    ].map((metric) => (
                      <div key={metric.label} className="p-4 rounded-xl bg-muted/20 border border-border/30">
                        <metric.icon className="h-4 w-4 text-primary mb-2" />
                        <p className="text-2xl font-bold">{metric.value}</p>
                        <p className="text-xs text-muted-foreground">{metric.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Transcript placeholder */}
                  <div className="p-4 rounded-xl bg-muted/10 border border-border/30 border-dashed">
                    <p className="text-sm text-muted-foreground text-center">
                      La transcription de la conversation sera affichée ici
                    </p>
                  </div>
                </div>
              </CardContent>
            </motion.div>
          ) : (
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
    </motion.div>
  );
};

export default PortalConversations;
