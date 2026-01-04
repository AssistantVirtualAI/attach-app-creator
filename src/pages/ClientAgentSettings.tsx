import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useClientAgentAccess } from '@/hooks/useClientAgentAccess';
import { 
  useClientElevenLabsAgentConfig, 
  useClientUpdateAgentPrompt,
  useClientUpdateAgentVoice,
  useClientElevenLabsVoices
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Settings, 
  MessageSquare, 
  Volume2, 
  Save,
  Lock,
  Info,
  RefreshCw,
  Play,
  Pause,
  Search,
  Loader2
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

  const { data: voices = [], isLoading: voicesLoading } = useClientElevenLabsVoices(apiKey);

  const updatePromptMutation = useClientUpdateAgentPrompt();
  const updateVoiceMutation = useClientUpdateAgentVoice();
  
  // Voice preview state
  const [voiceSearch, setVoiceSearch] = useState('');
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

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

  // Filter voices based on search
  const filteredVoices = voices.filter((voice: any) => 
    voice.name?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    voice.labels?.accent?.toLowerCase().includes(voiceSearch.toLowerCase()) ||
    voice.labels?.gender?.toLowerCase().includes(voiceSearch.toLowerCase())
  );

  // Handle voice preview
  const handlePlayPreview = (voice: any) => {
    if (playingVoiceId === voice.voice_id) {
      audioElement?.pause();
      setPlayingVoiceId(null);
      return;
    }

    if (audioElement) {
      audioElement.pause();
    }

    if (voice.preview_url) {
      const audio = new Audio(voice.preview_url);
      audio.onended = () => setPlayingVoiceId(null);
      audio.play();
      setAudioElement(audio);
      setPlayingVoiceId(voice.voice_id);
    }
  };

  // Handle voice selection
  const handleSelectVoice = (selectedVoiceId: string) => {
    setVoiceId(selectedVoiceId);
    handleVoiceChange();
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
                    {/* Voice Selector */}
                    <div className="space-y-3">
                      <Label>Sélectionner une voix</Label>
                      
                      {/* Current voice */}
                      {voiceId && (
                        <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
                          <p className="text-sm font-medium">Voix actuelle</p>
                          <p className="text-xs text-muted-foreground font-mono">{voiceId}</p>
                        </div>
                      )}
                      
                      {/* Voice search */}
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          value={voiceSearch}
                          onChange={(e) => setVoiceSearch(e.target.value)}
                          placeholder="Rechercher une voix..."
                          className="pl-10"
                          disabled={!canEdit}
                        />
                      </div>

                      {/* Voices list */}
                      {voicesLoading ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : (
                        <ScrollArea className="h-[250px] rounded-lg border border-border/50">
                          <div className="p-2 space-y-2">
                            {filteredVoices.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">
                                Aucune voix trouvée
                              </p>
                            ) : (
                              filteredVoices.map((voice: any) => (
                                <div
                                  key={voice.voice_id}
                                  className={`p-3 rounded-lg cursor-pointer transition-all border ${
                                    voiceId === voice.voice_id
                                      ? 'bg-primary/10 border-primary/30'
                                      : 'bg-muted/20 border-border/30 hover:bg-muted/40'
                                  }`}
                                  onClick={() => canEdit && handleSelectVoice(voice.voice_id)}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-sm truncate">{voice.name}</p>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {voice.labels?.accent && (
                                          <Badge variant="secondary" className="text-xs">
                                            {voice.labels.accent}
                                          </Badge>
                                        )}
                                        {voice.labels?.gender && (
                                          <Badge variant="outline" className="text-xs">
                                            {voice.labels.gender}
                                          </Badge>
                                        )}
                                        {voice.labels?.age && (
                                          <Badge variant="outline" className="text-xs">
                                            {voice.labels.age}
                                          </Badge>
                                        )}
                                      </div>
                                    </div>
                                    {voice.preview_url && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 ml-2"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePlayPreview(voice);
                                        }}
                                      >
                                        {playingVoiceId === voice.voice_id ? (
                                          <Pause className="h-4 w-4" />
                                        ) : (
                                          <Play className="h-4 w-4" />
                                        )}
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </ScrollArea>
                      )}
                      
                      <p className="text-xs text-muted-foreground">
                        Sélectionnez une voix ou écoutez un aperçu avant de choisir
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
