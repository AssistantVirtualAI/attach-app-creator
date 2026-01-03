import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bot, TrendingUp, Clock, Star } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface AgentPerformance {
  name: string;
  conversations: number;
  satisfaction: number;
  duration: number;
}

interface AgentPerformanceCardProps {
  agents: AgentPerformance[];
  isLoading?: boolean;
}

export const AgentPerformanceCard = ({ agents, isLoading }: AgentPerformanceCardProps) => {
  if (isLoading) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Performance des Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!agents || agents.length === 0) {
    return (
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            Performance des Agents
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            Aucun agent configuré avec des conversations
          </p>
        </CardContent>
      </Card>
    );
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  };

  const getSatisfactionColor = (score: number) => {
    if (score >= 4) return 'text-emerald-500';
    if (score >= 3) return 'text-amber-500';
    return 'text-red-500';
  };

  const maxConversations = Math.max(...agents.map(a => a.conversations), 1);

  return (
    <Card className="bg-card/50 backdrop-blur-sm border-border/50">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Bot className="h-5 w-5 text-primary" />
          Performance des Agents
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {agents.slice(0, 5).map((agent, index) => (
            <div 
              key={index}
              className="p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-sm">{agent.name}</span>
                </div>
                <Badge variant="outline" className="text-xs">
                  {agent.conversations} conv.
                </Badge>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Volume</span>
                  <span className="text-foreground">
                    {Math.round((agent.conversations / maxConversations) * 100)}%
                  </span>
                </div>
                <Progress 
                  value={(agent.conversations / maxConversations) * 100} 
                  className="h-1.5" 
                />
              </div>

              <div className="flex items-center gap-4 mt-2 text-xs">
                <div className="flex items-center gap-1">
                  <Star className={`h-3 w-3 ${getSatisfactionColor(agent.satisfaction)}`} />
                  <span className={getSatisfactionColor(agent.satisfaction)}>
                    {agent.satisfaction.toFixed(1)}/5
                  </span>
                </div>
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <span>{formatDuration(agent.duration)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};
