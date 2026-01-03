import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { useClientElevenLabsAgentConfig, useClientUpdateAgentPrompt } from '@/hooks/useClientElevenLabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { 
  Settings, 
  MessageSquare, 
  Volume2, 
  Save,
  Lock,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

const ClientAgentSettings = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName, canEdit } = useClientAgentAccess(clientId, agentId);
  
  const [prompt, setPrompt] = useState('');
  const [hasChanges, setHasChanges] = useState(false);

  const { data: agentConfig, isLoading } = useClientElevenLabsAgentConfig({
    apiKey,
    agentId: elevenlabsAgentId,
  });

  const updatePromptMutation = useClientUpdateAgentPrompt();

  useEffect(() => {
    if (agentConfig?.agent?.prompt?.prompt) {
      setPrompt(agentConfig.agent.prompt.prompt);
    }
  }, [agentConfig]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setHasChanges(value !== agentConfig?.agent?.prompt?.prompt);
  };

  const handleSavePrompt = async () => {
    if (!apiKey || !elevenlabsAgentId) return;
    
    await updatePromptMutation.mutateAsync({
      apiKey,
      agentId: elevenlabsAgentId,
      prompt,
    });
    
    setHasChanges(false);
  };

  const voiceSettings = agentConfig?.agent?.tts || {};
  const firstMessage = agentConfig?.agent?.first_message || '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">Paramètres de {agentName}</p>
        </div>
        {!canEdit && (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Lock className="h-3 w-3" />
            Lecture seule
          </Badge>
        )}
      </div>

      {/* System Prompt */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Prompt Système
          </CardTitle>
          <CardDescription>
            Instructions données à l'agent pour définir son comportement
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : (
            <div className="space-y-4">
              <Textarea
                value={prompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="Instructions pour l'agent..."
                rows={12}
                disabled={!canEdit}
                className="font-mono text-sm"
              />
              {canEdit && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {hasChanges ? 'Modifications non sauvegardées' : 'Aucune modification'}
                  </p>
                  <Button 
                    onClick={handleSavePrompt} 
                    disabled={!hasChanges || updatePromptMutation.isPending}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    {updatePromptMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* First Message */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Premier Message
          </CardTitle>
          <CardDescription>
            Message de bienvenue prononcé par l'agent au début de chaque conversation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : (
            <div className="p-4 bg-muted rounded-lg">
              <p className="text-sm italic">
                "{firstMessage || 'Aucun premier message configuré'}"
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Voice Settings (Read-only display) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Volume2 className="h-5 w-5" />
            Paramètres Vocaux
          </CardTitle>
          <CardDescription>
            Configuration de la voix de l'agent (lecture seule)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Voice ID</label>
                  <code className="text-xs bg-muted px-2 py-1 rounded">
                    {voiceSettings.voice_id || 'Non configuré'}
                  </code>
                </div>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Stabilité</label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((voiceSettings.stability || 0.5) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(voiceSettings.stability || 0.5) * 100]}
                  max={100}
                  step={1}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Similarité</label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((voiceSettings.similarity_boost || 0.75) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(voiceSettings.similarity_boost || 0.75) * 100]}
                  max={100}
                  step={1}
                  disabled
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Style</label>
                  <span className="text-sm text-muted-foreground">
                    {Math.round((voiceSettings.style || 0) * 100)}%
                  </span>
                </div>
                <Slider
                  value={[(voiceSettings.style || 0) * 100]}
                  max={100}
                  step={1}
                  disabled
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default ClientAgentSettings;
