import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, Calendar, MessageSquare, Clock, User } from 'lucide-react';
import { AgentSettings } from '@/hooks/useAgentSettings';
import { PlatformBadge } from './PlatformBadge';

interface AgentOverviewTabProps {
  agent: AgentSettings;
  client: { id: string; name: string; email: string } | null;
  analytics: {
    totalConversations: number;
    avgDuration: number;
    avgSatisfaction: string;
  };
}

export const AgentOverviewTab = ({ agent, client, analytics }: AgentOverviewTabProps) => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.totalConversations}</p>
                <p className="text-sm text-muted-foreground">Conversations</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.avgDuration}s</p>
                <p className="text-sm text-muted-foreground">Durée moyenne</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                <Bot className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{analytics.avgSatisfaction}</p>
                <p className="text-sm text-muted-foreground">Satisfaction</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="h-5 w-5" />
            Informations de l'agent
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Nom</p>
              <p className="font-medium">{agent.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Plateforme</p>
              <PlatformBadge platform={agent.platform} />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Agent ID</p>
              <code className="text-sm bg-muted px-2 py-1 rounded">
                {agent.platform_agent_id || 'Non configuré'}
              </code>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Layout Widget</p>
              <Badge variant="outline">{agent.widget_layout || 'Original'}</Badge>
            </div>
          </div>

          {agent.description && (
            <div>
              <p className="text-sm text-muted-foreground">Description</p>
              <p className="text-sm">{agent.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {client && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Client assigné
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="font-medium">{client.name}</p>
                <p className="text-sm text-muted-foreground">{client.email}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Dates
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Créé le</p>
              <p className="font-medium">
                {new Date(agent.created_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Mis à jour le</p>
              <p className="font-medium">
                {new Date(agent.updated_at).toLocaleDateString('fr-FR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
