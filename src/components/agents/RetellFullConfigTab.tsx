import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Volume2, MessageSquare, Settings2, Save, Loader2, RefreshCw, Brain, Zap 
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  useRetellFullAgentConfig,
  useRetellVoices,
  useUpdateRetellAgent,
  useUpdateRetellLLM,
} from '@/hooks/useRetellFullConfig';

interface RetellFullConfigTabProps {
  agentId: string;
  platformAgentId: string | null;
  organizationId: string;
  apiKey?: string | null;
}

const RETELL_LANGUAGES = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'fr-FR', label: 'French' },
  { value: 'es-ES', label: 'Spanish' },
  { value: 'de-DE', label: 'German' },
  { value: 'it-IT', label: 'Italian' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
  { value: 'ja-JP', label: 'Japanese' },
  { value: 'ko-KR', label: 'Korean' },
  { value: 'zh-CN', label: 'Chinese (Mandarin)' },
];

const AMBIENT_SOUNDS = [
  { value: 'none', label: 'Aucun' },
  { value: 'coffee-shop', label: 'Café' },
  { value: 'convention-hall', label: 'Hall de convention' },
  { value: 'summer-outdoor', label: 'Extérieur été' },
  { value: 'mountain-outdoor', label: 'Montagne' },
  { value: 'static-noise', label: 'Bruit statique' },
  { value: 'call-center', label: 'Centre d\'appel' },
];

export function RetellFullConfigTab({ 
  agentId, 
  platformAgentId, 
  organizationId,
  apiKey 
}: RetellFullConfigTabProps) {
  const { data: config, isLoading, refetch } = useRetellFullAgentConfig({
    agentId: platformAgentId,
    organizationId,
    apiKey,
    enabled: !!platformAgentId,
  });

  const { data: voices } = useRetellVoices({ organizationId, apiKey });
  const updateAgent = useUpdateRetellAgent();
  const updateLLM = useUpdateRetellLLM();

  // Agent settings state
  const [voiceId, setVoiceId] = useState('');
  const [voiceTemperature, setVoiceTemperature] = useState(1);
  const [voiceSpeed, setVoiceSpeed] = useState(1);
  const [language, setLanguage] = useState('en-US');
  const [responsiveness, setResponsiveness] = useState(1);
  const [interruptionSensitivity, setInterruptionSensitivity] = useState(1);
  const [enableBackchannel, setEnableBackchannel] = useState(false);
  const [ambientSound, setAmbientSound] = useState('none');
  const [ambientSoundVolume, setAmbientSoundVolume] = useState(1);
  const [boostedKeywords, setBoostedKeywords] = useState('');

  // LLM settings state
  const [generalPrompt, setGeneralPrompt] = useState('');
  const [beginMessage, setBeginMessage] = useState('');
  const [modelTemperature, setModelTemperature] = useState(0);

  // Sync config to local state
  useEffect(() => {
    if (config?.agent) {
      const agent = config.agent;
      setVoiceId(agent.voice_id || '');
      setVoiceTemperature(agent.voice_temperature ?? 1);
      setVoiceSpeed(agent.voice_speed ?? 1);
      setLanguage(agent.language || 'en-US');
      setResponsiveness(agent.responsiveness ?? 1);
      setInterruptionSensitivity(agent.interruption_sensitivity ?? 1);
      setEnableBackchannel(agent.enable_backchannel ?? false);
      setAmbientSound(agent.ambient_sound || 'none');
      setAmbientSoundVolume(agent.ambient_sound_volume ?? 1);
      setBoostedKeywords(agent.boosted_keywords?.join(', ') || '');
    }
    if (config?.llm) {
      const llm = config.llm;
      setGeneralPrompt(llm.general_prompt || '');
      setBeginMessage(llm.begin_message || '');
      setModelTemperature(llm.model_temperature ?? 0);
    }
  }, [config]);

  const handleSaveAgentSettings = () => {
    if (!platformAgentId) return;
    
    const keywords = boostedKeywords
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    updateAgent.mutate({
      agentId: platformAgentId,
      organizationId,
      apiKey: apiKey || undefined,
      config: {
        voice_id: voiceId,
        voice_temperature: voiceTemperature,
        voice_speed: voiceSpeed,
        language,
        responsiveness,
        interruption_sensitivity: interruptionSensitivity,
        enable_backchannel: enableBackchannel,
        ambient_sound: ambientSound === 'none' ? undefined : ambientSound,
        ambient_sound_volume: ambientSoundVolume,
        boosted_keywords: keywords.length > 0 ? keywords : undefined,
      },
    });
  };

  const handleSaveLLMSettings = () => {
    if (!platformAgentId || !config?.llm?.llm_id) return;

    updateLLM.mutate({
      llmId: config.llm.llm_id,
      agentId: platformAgentId,
      organizationId,
      apiKey: apiKey || undefined,
      config: {
        general_prompt: generalPrompt,
        begin_message: beginMessage || undefined,
        model_temperature: modelTemperature,
      },
    });
  };

  if (!platformAgentId) {
    return (
      <Card className="p-8 text-center">
        <Settings2 className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
        <p className="text-muted-foreground">
          Configurez d'abord l'ID de l'agent Retell dans l'onglet Config
        </p>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold">Configuration Avancée Retell</h2>
            <Badge variant="secondary" className="bg-orange-500/10 text-orange-600 border-orange-500/20">
              Retell AI
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Paramétrez tous les aspects de votre agent vocal Retell
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={['prompt', 'voice']} className="space-y-4">
        {/* Section 1: Prompt & LLM */}
        <AccordionItem value="prompt" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Prompt & LLM</h3>
                <p className="text-sm text-muted-foreground">Instructions et premier message</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div>
                <Label className="text-base font-medium">Prompt Système</Label>
                <Textarea
                  value={generalPrompt}
                  onChange={(e) => setGeneralPrompt(e.target.value)}
                  placeholder="Instructions pour l'agent..."
                  className="mt-2 min-h-[200px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Instructions générales qui définissent le comportement de l'agent
                </p>
              </div>

              <div>
                <Label className="text-base font-medium">Premier Message</Label>
                <Textarea
                  value={beginMessage}
                  onChange={(e) => setBeginMessage(e.target.value)}
                  placeholder="Bonjour, comment puis-je vous aider ?"
                  className="mt-2 min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Le message avec lequel l'agent commence la conversation
                </p>
              </div>

              <div className="max-w-md">
                <Label>Température ({modelTemperature.toFixed(1)})</Label>
                <Slider
                  value={[modelTemperature]}
                  onValueChange={([v]) => setModelTemperature(v)}
                  min={0}
                  max={1}
                  step={0.1}
                  className="mt-4"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  0 = Réponses déterministes, 1 = Réponses plus créatives
                </p>
              </div>

              <Button 
                onClick={handleSaveLLMSettings} 
                disabled={updateLLM.isPending || !config?.llm}
              >
                {updateLLM.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder Prompt
              </Button>

              {!config?.llm && (
                <p className="text-sm text-amber-600">
                  ⚠️ Cet agent n'utilise pas un Retell LLM. Le prompt ne peut pas être modifié ici.
                </p>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 2: Voice Settings */}
        <AccordionItem value="voice" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Volume2 className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Voix & Audio</h3>
                <p className="text-sm text-muted-foreground">Configuration de la synthèse vocale</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div>
                <Label>Voix</Label>
                <Select value={voiceId} onValueChange={setVoiceId}>
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Sélectionner une voix" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {voices?.map((voice) => (
                      <SelectItem key={voice.voice_id} value={voice.voice_id}>
                        <div className="flex items-center gap-2">
                          <span>{voice.voice_name}</span>
                          <Badge variant="outline" className="text-xs">
                            {voice.provider}
                          </Badge>
                          {voice.gender && (
                            <span className="text-xs text-muted-foreground">
                              {voice.gender}
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Température voix ({voiceTemperature.toFixed(1)})</Label>
                  <Slider
                    value={[voiceTemperature]}
                    onValueChange={([v]) => setVoiceTemperature(v)}
                    min={0}
                    max={2}
                    step={0.1}
                    className="mt-4"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    Variabilité de la voix
                  </p>
                </div>

                <div>
                  <Label>Vitesse ({voiceSpeed.toFixed(1)}x)</Label>
                  <Slider
                    value={[voiceSpeed]}
                    onValueChange={([v]) => setVoiceSpeed(v)}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="mt-4"
                  />
                </div>
              </div>

              <div>
                <Label>Langue</Label>
                <Select value={language} onValueChange={setLanguage}>
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RETELL_LANGUAGES.map((lang) => (
                      <SelectItem key={lang.value} value={lang.value}>
                        {lang.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Son ambiant</Label>
                  <Select value={ambientSound} onValueChange={setAmbientSound}>
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AMBIENT_SOUNDS.map((sound) => (
                        <SelectItem key={sound.value} value={sound.value}>
                          {sound.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {ambientSound !== 'none' && (
                  <div>
                    <Label>Volume ambiant ({Math.round(ambientSoundVolume * 100)}%)</Label>
                    <Slider
                      value={[ambientSoundVolume]}
                      onValueChange={([v]) => setAmbientSoundVolume(v)}
                      min={0}
                      max={2}
                      step={0.1}
                      className="mt-4"
                    />
                  </div>
                )}
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Section 3: Behavior Settings */}
        <AccordionItem value="behavior" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <Zap className="h-5 w-5 text-green-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Comportement</h3>
                <p className="text-sm text-muted-foreground">Réactivité et interruptions</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Réactivité ({responsiveness.toFixed(1)})</Label>
                  <Slider
                    value={[responsiveness]}
                    onValueChange={([v]) => setResponsiveness(v)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-4"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    0 = Attente longue, 1 = Réponse rapide
                  </p>
                </div>

                <div>
                  <Label>Sensibilité interruption ({interruptionSensitivity.toFixed(1)})</Label>
                  <Slider
                    value={[interruptionSensitivity]}
                    onValueChange={([v]) => setInterruptionSensitivity(v)}
                    min={0}
                    max={1}
                    step={0.1}
                    className="mt-4"
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    0 = Ignore interruptions, 1 = Très sensible
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <Label className="text-base">Backchannel</Label>
                  <p className="text-sm text-muted-foreground">
                    L'agent émet des sons d'écoute (hmm, oui, je vois...)
                  </p>
                </div>
                <Switch
                  checked={enableBackchannel}
                  onCheckedChange={setEnableBackchannel}
                />
              </div>

              <div>
                <Label>Mots-clés boostés</Label>
                <Input
                  value={boostedKeywords}
                  onChange={(e) => setBoostedKeywords(e.target.value)}
                  placeholder="mot1, mot2, mot3..."
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Améliore la reconnaissance de termes spécifiques
                </p>
              </div>

              <Button onClick={handleSaveAgentSettings} disabled={updateAgent.isPending}>
                {updateAgent.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Save className="h-4 w-4 mr-2" />
                Sauvegarder Configuration Agent
              </Button>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  );
}
