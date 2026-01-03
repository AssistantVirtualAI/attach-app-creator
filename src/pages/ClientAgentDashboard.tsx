import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { useClientElevenLabsAnalytics, useClientElevenLabsConversations } from '@/hooks/useClientElevenLabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  MessageSquare, 
  Clock, 
  TrendingUp, 
  Phone,
  Users,
  ThumbsUp
} from 'lucide-react';

const StatCard = ({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  isLoading 
}: { 
  title: string; 
  value: string | number; 
  icon: any; 
  trend?: string;
  isLoading?: boolean;
}) => (
  <Card>
    <CardContent className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{title}</p>
          {isLoading ? (
            <Skeleton className="h-8 w-20 mt-1" />
          ) : (
            <p className="text-2xl font-bold">{value}</p>
          )}
          {trend && !isLoading && (
            <p className="text-xs text-green-600 flex items-center gap-1 mt-1">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </p>
          )}
        </div>
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="h-6 w-6 text-primary" />
        </div>
      </div>
    </CardContent>
  </Card>
);

const ClientAgentDashboard = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName } = useClientAgentAccess(clientId, agentId);
  
  const { data: analytics, isLoading: analyticsLoading } = useClientElevenLabsAnalytics({
    apiKey,
    agentId: elevenlabsAgentId,
  });

  const { data: conversations, isLoading: conversationsLoading } = useClientElevenLabsConversations({
    apiKey,
    agentId: elevenlabsAgentId,
  }, 1, 5);

  const metrics = analytics?.metrics || {};
  const recentConversations = conversations?.conversations || [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{agentName || 'Dashboard'}</h1>
        <p className="text-muted-foreground">Vue d'ensemble des performances de l'agent</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Conversations"
          value={metrics.total_conversations || 0}
          icon={MessageSquare}
          isLoading={analyticsLoading}
        />
        <StatCard
          title="Durée Moyenne"
          value={metrics.avg_duration ? `${Math.round(metrics.avg_duration / 60)}min` : '0min'}
          icon={Clock}
          isLoading={analyticsLoading}
        />
        <StatCard
          title="Appels Aujourd'hui"
          value={metrics.today_conversations || 0}
          icon={Phone}
          isLoading={analyticsLoading}
        />
        <StatCard
          title="Satisfaction"
          value={metrics.avg_satisfaction ? `${Math.round(metrics.avg_satisfaction * 100)}%` : 'N/A'}
          icon={ThumbsUp}
          isLoading={analyticsLoading}
        />
      </div>

      {/* Recent Conversations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Conversations Récentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {conversationsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : recentConversations.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Aucune conversation récente
            </p>
          ) : (
            <div className="space-y-3">
              {recentConversations.map((conv: any) => (
                <div
                  key={conv.conversation_id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {conv.metadata?.caller_id || 'Appelant inconnu'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(conv.start_time_unix_secs * 1000).toLocaleString('fr-FR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium">
                      {conv.call_duration_secs 
                        ? `${Math.floor(conv.call_duration_secs / 60)}:${(conv.call_duration_secs % 60).toString().padStart(2, '0')}`
                        : 'N/A'
                      }
                    </p>
                    <p className={`text-xs ${conv.status === 'done' ? 'text-green-600' : 'text-yellow-600'}`}>
                      {conv.status === 'done' ? 'Terminé' : conv.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientAgentDashboard;
