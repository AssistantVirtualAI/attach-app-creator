import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Plug, Zap } from 'lucide-react';

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
  // Determine active solutions based on assigned agents platforms
  const activePlatforms = new Set(assignedAgents?.map(a => a.platform.toLowerCase()) || []);

  return (
    <div className="space-y-6">
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
    </div>
  );
};
