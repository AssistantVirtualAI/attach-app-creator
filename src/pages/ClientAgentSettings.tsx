import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { 
  useClientElevenLabsAgentConfig, 
  useClientUpdateAgentPrompt,
  useClientUpdateAgentVoice
} from '@/hooks/useClientElevenLabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { 
  Settings, 
  MessageSquare, 
  Volume2, 
  Save,
  Lock,
  Info,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

const ClientAgentSettings = () => {
  const { clientId, agentId } = useParams();
  const { apiKey, agentId: elevenlabsAgentId, agentName, canEdit } = useClientAgentAccess(clientId, agentId);
  
  // Prompt state
  const [prompt, setPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [hasPromptChanges, setHasPromptChanges] = useState(false);
  
  // Voice state
  const [voiceId, setVoiceId] = useState('');
  const [stability, setStability] = useState(0.5);
  const [similarityBoost, setSimilarityBoost] = useState(0.75);
  const [style, setStyle] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [hasVoiceChanges, setHasVoiceChanges] = useState(false);

  const { data: agentConfig, isLoading, refetch } = useClientElevenLabsAgentConfig({
    apiKey,
    agentId: elevenlabsAgentId,
  });

  const updatePromptMutation = useClientUpdateAgentPrompt();
  const updateVoiceMutation = useClientUpdateAgentVoice();

  // Initialize prompt state from config
  useEffect(() => {
    if (agentConfig?.agent) {
      const configPrompt = agentConfig.agent.prompt?.prompt || '';
      const configFirstMessage = agentConfig.agent.first_message || '';
      setPrompt(configPrompt);
      setFirstMessage(configFirstMessage);
    }
  }, [agentConfig]);

  // Initialize voice state from config
  useEffect(() => {
    if (agentConfig?.agent?.tts) {
      const tts = agentConfig.agent.tts;
      setVoiceId(tts.voice_id || '');
      setStability(tts.stability ?? 0.5);
      setSimilarityBoost(tts.similarity_boost ?? 0.75);
      setStyle(tts.style ?? 0);
      setSpeed(tts.speed ?? 1);
    }
  }, [agentConfig]);

  const handlePromptChange = (value: string) => {
    setPrompt(value);
    setHasPromptChanges(
      value !== (agentConfig?.agent?.prompt?.prompt || '') ||
      firstMessage !== (agentConfig?.agent?.first_message || '')
    );
  };

  const handleFirstMessageChange = (value: string) => {
    setFirstMessage(value);
    setHasPromptChanges(
      prompt !== (agentConfig?.agent?.prompt?.prompt || '') ||
      value !== (agentConfig?.agent?.first_message || '')
    );
  };

  const handleVoiceChange = () => {
    const tts = agentConfig?.agent?.tts || {};
    setHasVoiceChanges(
      voiceId !== (tts.voice_id || '') ||
      stability !== (tts.stability ?? 0.5) ||
      similarityBoost !== (tts.similarity_boost ?? 0.75) ||
      style !== (tts.style ?? 0) ||
      speed !== (tts.speed ?? 1)
    );
  };

  const handleSavePrompt = async () => {
    if (!apiKey || !elevenlabsAgentId) return;
    
    try {
      await updatePromptMutation.mutateAsync({
        apiKey,
        agentId: elevenlabsAgentId,
        prompt,
        firstMessage: firstMessage || undefined,
      });
      setHasPromptChanges(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleSaveVoice = async () => {
    if (!apiKey || !elevenlabsAgentId) return;
    
    try {
      await updateVoiceMutation.mutateAsync({
        apiKey,
        agentId: elevenlabsAgentId,
        voiceSettings: {
          voice_id: voiceId || undefined,
          stability,
          similarity_boost: similarityBoost,
          style,
          speed,
        },
      });
      setHasVoiceChanges(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Configuration</h1>
          <p className="text-muted-foreground">Paramètres de {agentName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          {!canEdit && (
            <Badge variant="secondary" className="flex items-center gap-1">
              <Lock className="h-3 w-3" />
              Lecture seule
            </Badge>
          )}
        </div>
      </div>

      {!apiKey || !elevenlabsAgentId ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Settings className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Configuration ElevenLabs manquante pour cet agent</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="prompt" className="space-y-6">
          <TabsList>
            <TabsTrigger value="prompt" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Prompt
            </TabsTrigger>
            <TabsTrigger value="voice" className="flex items-center gap-2">
              <Volume2 className="h-4 w-4" />
              Voix
            </TabsTrigger>
          </TabsList>

          {/* Prompt Tab */}
          <TabsContent value="prompt" className="space-y-6">
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
                  <Textarea
                    value={firstMessage}
                    onChange={(e) => handleFirstMessageChange(e.target.value)}
                    placeholder="Message de bienvenue de l'agent..."
                    rows={4}
                    disabled={!canEdit}
                  />
                )}
              </CardContent>
            </Card>

            {/* Save Prompt Button */}
            {canEdit && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {hasPromptChanges ? 'Modifications non sauvegardées' : 'Aucune modification'}
                </p>
                <Button 
                  onClick={handleSavePrompt} 
                  disabled={!hasPromptChanges || updatePromptMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updatePromptMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </div>
            )}
          </TabsContent>

          {/* Voice Tab */}
          <TabsContent value="voice" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Volume2 className="h-5 w-5" />
                  Paramètres Vocaux
                </CardTitle>
                <CardDescription>
                  Configuration de la voix de l'agent
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
                    {/* Voice ID */}
                    <div className="space-y-2">
                      <Label>Voice ID</Label>
                      <Input
                        value={voiceId}
                        onChange={(e) => {
                          setVoiceId(e.target.value);
                          handleVoiceChange();
                        }}
                        placeholder="ID de la voix ElevenLabs"
                        disabled={!canEdit}
                        className="font-mono text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        Identifiant de la voix utilisée par l'agent
                      </p>
                    </div>

                    {/* Stability */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Stabilité</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(stability * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[stability * 100]}
                        onValueChange={(vals) => {
                          setStability(vals[0] / 100);
                          handleVoiceChange();
                        }}
                        max={100}
                        step={1}
                        disabled={!canEdit}
                      />
                      <p className="text-xs text-muted-foreground">
                        Plus stable = voix plus cohérente. Moins stable = plus expressif.
                      </p>
                    </div>

                    {/* Similarity Boost */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Similarité</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(similarityBoost * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[similarityBoost * 100]}
                        onValueChange={(vals) => {
                          setSimilarityBoost(vals[0] / 100);
                          handleVoiceChange();
                        }}
                        max={100}
                        step={1}
                        disabled={!canEdit}
                      />
                      <p className="text-xs text-muted-foreground">
                        Contrôle la fidélité à la voix originale
                      </p>
                    </div>

                    {/* Style */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Style</Label>
                        <span className="text-sm text-muted-foreground">
                          {Math.round(style * 100)}%
                        </span>
                      </div>
                      <Slider
                        value={[style * 100]}
                        onValueChange={(vals) => {
                          setStyle(vals[0] / 100);
                          handleVoiceChange();
                        }}
                        max={100}
                        step={1}
                        disabled={!canEdit}
                      />
                      <p className="text-xs text-muted-foreground">
                        Amplifie le style unique de la voix
                      </p>
                    </div>

                    {/* Speed */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Vitesse</Label>
                        <span className="text-sm text-muted-foreground">
                          {speed.toFixed(2)}x
                        </span>
                      </div>
                      <Slider
                        value={[speed * 50]}
                        onValueChange={(vals) => {
                          setSpeed(vals[0] / 50);
                          handleVoiceChange();
                        }}
                        min={25}
                        max={100}
                        step={1}
                        disabled={!canEdit}
                      />
                      <p className="text-xs text-muted-foreground">
                        Vitesse de parole (0.5x à 2x)
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Save Voice Button */}
            {canEdit && (
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  {hasVoiceChanges ? 'Modifications non sauvegardées' : 'Aucune modification'}
                </p>
                <Button 
                  onClick={handleSaveVoice} 
                  disabled={!hasVoiceChanges || updateVoiceMutation.isPending}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateVoiceMutation.isPending ? 'Sauvegarde...' : 'Sauvegarder'}
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default ClientAgentSettings;
