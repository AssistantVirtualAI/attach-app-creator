import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Plug, Zap, Bot, Eye, BookOpen, Volume2 } from 'lucide-react';
import { ClientAgentDetails } from './ClientAgentDetails';

const AVAILABLE_SOLUTIONS = [
  { id: 'elevenlabs', name: 'ElevenLabs', description: 'Synthèse vocale avancée', icon: '🎙️' },
  { id: 'vapi', name: 'Vapi', description: 'Agents conversationnels vocaux', icon: '📞' },
  { id: 'retell', name: 'Retell AI', description: 'Appels téléphoniques IA', icon: '🤖' },
  { id: 'openai', name: 'OpenAI', description: 'Modèles GPT', icon: '🧠' },
  { id: 'notion', name: 'Notion', description: 'Synchronisation documents', icon: '📝' },
  { id: 'slack', name: 'Slack', description: 'Notifications équipe', icon: '💬' },
];

interface ClientSolutionsTabProps {
  clientId: string;
  assignedAgents: any[];
}

export const ClientSolutionsTab = ({ clientId, assignedAgents }: ClientSolutionsTabProps) => {
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  // Determine active solutions based on assigned agents platforms
  const activePlatforms = new Set(assignedAgents?.map(a => a.platform?.toLowerCase()) || []);
  
  // Filter ElevenLabs agents
  const elevenLabsAgents = assignedAgents?.filter(a => a.platform?.toLowerCase() === 'elevenlabs') || [];

  return (
    <div className="space-y-6">
      {/* ElevenLabs Agents with Details */}
      {elevenLabsAgents.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Agents ElevenLabs actifs
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {elevenLabsAgents.map((agent) => {
              const config = agent.config as Record<string, any> || {};
              const agentId = config.agent_id || agent.platform_agent_id;
              
              return (
                <div
                  key={agent.id}
                  className="p-4 border rounded-lg border-primary/30 bg-primary/5"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <span className="text-xl">🎙️</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{agent.name}</h4>
                          <Badge variant="default" className="flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            Actif
                          </Badge>
                        </div>
                        {agentId && (
                          <p className="text-xs text-muted-foreground mt-1">
                            ID: {agentId}
                          </p>
                        )}
                        {config.system_prompt && (
                          <p className="text-sm text-muted-foreground mt-1 truncate max-w-md">
                            {config.system_prompt.substring(0, 50)}...
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-right text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          <span>{config.knowledge_base_count || 0} docs</span>
                        </div>
                        {config.voice_id && (
                          <div className="flex items-center gap-1 mt-1">
                            <Volume2 className="h-3 w-3" />
                            <span>Voice configurée</span>
                          </div>
                        )}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => setSelectedAgentId(agent.id)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Détails
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Available Solutions Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plug className="h-5 w-5" />
            Intégrations tierces
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {AVAILABLE_SOLUTIONS.map((solution) => {
              const isActive = activePlatforms.has(solution.id);
              const agentCount = assignedAgents?.filter(
                a => a.platform?.toLowerCase() === solution.id
              ).length || 0;
              
              return (
                <div
                  key={solution.id}
                  className={`p-4 border rounded-lg transition-colors ${
                    isActive ? 'border-primary bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">{solution.icon}</span>
                      <div>
                        <h4 className="font-medium">{solution.name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {solution.description}
                        </p>
                        {isActive && agentCount > 0 && (
                          <p className="text-xs text-primary mt-1">
                            {agentCount} agent{agentCount > 1 ? 's' : ''} actif{agentCount > 1 ? 's' : ''}
                          </p>
                        )}
                      </div>
                    </div>
                    {isActive ? (
                      <Badge variant="default" className="flex items-center gap-1">
                        <CheckCircle className="h-3 w-3" />
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Inactif
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Résumé des connexions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-green-500" />
              <span className="text-sm">
                {activePlatforms.size} intégration(s) active(s)
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-muted" />
              <span className="text-sm">
                {AVAILABLE_SOLUTIONS.length - activePlatforms.size} disponible(s)
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Agent Details Modal */}
      {selectedAgentId && (
        <ClientAgentDetails 
          agentId={selectedAgentId}
          onClose={() => setSelectedAgentId(null)}
        />
      )}
    </div>
  );
};
