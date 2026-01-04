import { useState, useEffect } from 'react';
import { usePortal } from '@/hooks/usePortalAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Settings, Volume2, Sparkles, Play, Mic, Zap, Clock, MessageSquare, Globe, Save, Loader2, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { PortalPageHeader } from '@/components/portal/PortalPageHeader';
import { VoiceSelector } from '@/components/agents/VoiceSelector';
import { 
  useElevenLabsFullAgentConfig,
  useUpdateTTSSettings,
  useUpdateASRSettings,
  useUpdateTurnSettings,
  useUpdatePrompt,
} from '@/hooks/useElevenLabsFullConfig';
import { ELEVENLABS_LANGUAGES, TURN_EAGERNESS_OPTIONS, TTS_MODELS } from '@/types/elevenlabs-full';
import type { TTSSettings, ASRSettings, TurnSettings } from '@/types/elevenlabs-full';

const PortalSettings = () => {
  const { session, hasEditAccess } = usePortal();
  const canEdit = hasEditAccess();
  
  const agentId = session?.agentId;
  // API key is fetched from agent config on the backend
  const apiKey: string | null = null;

  const { data: config, isLoading, refetch } = useElevenLabsFullAgentConfig({
    agentId: agentId || null,
    apiKey: apiKey || null,
    enabled: !!agentId && canEdit,
  });

  const updateTTS = useUpdateTTSSettings();
  const updateASR = useUpdateASRSettings();
  const updateTurn = useUpdateTurnSettings();
  const updatePrompt = useUpdatePrompt();

  // Local state
  const [ttsSettings, setTtsSettings] = useState<TTSSettings>({
    voice_id: '',
    model_id: 'eleven_turbo_v2_5',
    stability: 0.5,
    similarity_boost: 0.75,
    style: 0,
    speed: 1,
  });

  const [asrSettings, setAsrSettings] = useState<ASRSettings>({
    quality: 'high',
    keywords: [],
  });

  const [turnSettings, setTurnSettings] = useState<TurnSettings>({
    turn_timeout: 10,
    silence_end_call_timeout: 30,
    turn_eagerness: 'normal',
  });

  const [prompt, setPrompt] = useState('');
  const [firstMessage, setFirstMessage] = useState('');
  const [keywords, setKeywords] = useState('');

  // Sync config to local state
  useEffect(() => {
    if (config) {
      const tts = config.conversation_config?.tts;
      const stt = config.conversation_config?.stt;
      const turn = config.conversation_config?.turn;
      const agent = config.conversation_config?.agent;

      if (tts) {
        setTtsSettings(prev => ({ ...prev, ...tts }));
      }
      if (stt) {
        setAsrSettings(prev => ({ ...prev, ...stt }));
        if (stt.keywords) {
          setKeywords(stt.keywords.join(', '));
        }
      }
      if (turn) {
        setTurnSettings(prev => ({ ...prev, ...turn }));
      }
      if (agent) {
        setPrompt(agent.prompt?.prompt || '');
        setFirstMessage(agent.first_message || '');
      }
    }
  }, [config]);

  const handleSaveTTS = () => {
    if (!agentId) return;
    updateTTS.mutate({ agentId, apiKey: apiKey || undefined, ttsSettings });
  };

  const handleSaveASR = () => {
    if (!agentId) return;
    const keywordsArray = keywords.split(',').map(k => k.trim()).filter(Boolean);
    updateASR.mutate({ 
      agentId, 
      apiKey: apiKey || undefined, 
      asrSettings: { ...asrSettings, keywords: keywordsArray } 
    });
  };

  const handleSaveTurn = () => {
    if (!agentId) return;
    updateTurn.mutate({ agentId, apiKey: apiKey || undefined, turnSettings });
  };

  const handleSavePrompt = () => {
    if (!agentId) return;
    updatePrompt.mutate({ agentId, apiKey: apiKey || undefined, prompt, firstMessage });
  };

  if (!canEdit) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center py-24"
      >
        <div className="w-24 h-24 rounded-2xl bg-muted/20 flex items-center justify-center mb-6">
          <Settings className="h-12 w-12 text-muted-foreground/30" />
        </div>
        <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
        <p className="text-muted-foreground">Vous n'avez pas les permissions pour accéder à cette page</p>
      </motion.div>
    );
  }

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  };

  if (isLoading) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
        <PortalPageHeader
          icon={Settings}
          title="Configuration"
          description={session?.agentName}
          gradient="pink-orange"
        />
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      <div className="flex items-center justify-between">
        <PortalPageHeader
          icon={Settings}
          title="Configuration"
          description={session?.agentName}
          gradient="pink-orange"
        />
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Actualiser
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={['voice', 'prompt']} className="space-y-4">
        {/* Voice Settings */}
        <AccordionItem value="voice" className="border rounded-lg bg-card/50 backdrop-blur-sm">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Volume2 className="h-5 w-5 text-primary" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Paramètres de Voix</h3>
                <p className="text-sm text-muted-foreground">Synthèse vocale et caractéristiques</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <motion.div variants={itemVariants} className="space-y-6">
              <div>
                <Label className="text-base font-medium mb-4 block">Sélectionner une voix</Label>
                <VoiceSelector
                  selectedVoiceId={ttsSettings.voice_id}
                  onSelect={(voice) => setTtsSettings(prev => ({ ...prev, voice_id: voice.voice_id }))}
                  apiKey={apiKey}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Modèle TTS</Label>
                  <Select
                    value={ttsSettings.model_id || 'eleven_turbo_v2_5'}
                    onValueChange={(v) => setTtsSettings(prev => ({ ...prev, model_id: v }))}
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TTS_MODELS.map(model => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Vitesse ({ttsSettings.speed?.toFixed(1)}x)</Label>
                  <Slider
                    value={[ttsSettings.speed || 1]}
                    onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, speed: v }))}
                    min={0.5}
                    max={2}
                    step={0.1}
                    className="mt-4"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <Label>Stabilité ({Math.round((ttsSettings.stability || 0.5) * 100)}%)</Label>
                  <Slider
                    value={[ttsSettings.stability || 0.5]}
                    onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, stability: v }))}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-4"
                  />
                </div>
                <div>
                  <Label>Similarité ({Math.round((ttsSettings.similarity_boost || 0.75) * 100)}%)</Label>
                  <Slider
                    value={[ttsSettings.similarity_boost || 0.75]}
                    onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, similarity_boost: v }))}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-4"
                  />
                </div>
                <div>
                  <Label>Style ({Math.round((ttsSettings.style || 0) * 100)}%)</Label>
                  <Slider
                    value={[ttsSettings.style || 0]}
                    onValueChange={([v]) => setTtsSettings(prev => ({ ...prev, style: v }))}
                    min={0}
                    max={1}
                    step={0.01}
                    className="mt-4"
                  />
                </div>
              </div>

              <Button onClick={handleSaveTTS} disabled={updateTTS.isPending} className="gap-2 bg-gradient-to-r from-primary to-purple-500">
                {updateTTS.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder Voix
              </Button>
            </motion.div>
          </AccordionContent>
        </AccordionItem>

        {/* Turn Settings */}
        <AccordionItem value="turn" className="border rounded-lg bg-card/50 backdrop-blur-sm">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Gestion des Tours</h3>
                <p className="text-sm text-muted-foreground">Timing et interruptions</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <motion.div variants={itemVariants} className="space-y-6">
              <div>
                <Label>Réactivité de l'agent</Label>
                <div className="grid grid-cols-3 gap-3 mt-3">
                  {TURN_EAGERNESS_OPTIONS.map(option => (
                    <Card
                      key={option.value}
                      className={`p-4 cursor-pointer transition-all ${
                        turnSettings.turn_eagerness === option.value 
                          ? 'border-primary bg-primary/5' 
                          : 'hover:border-primary/50'
                      }`}
                      onClick={() => setTurnSettings(prev => ({ ...prev, turn_eagerness: option.value as any }))}
                    >
                      <h4 className="font-medium">{option.label}</h4>
                      <p className="text-xs text-muted-foreground mt-1">{option.description}</p>
                    </Card>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label>Timeout de tour ({turnSettings.turn_timeout}s)</Label>
                  <Slider
                    value={[turnSettings.turn_timeout || 10]}
                    onValueChange={([v]) => setTurnSettings(prev => ({ ...prev, turn_timeout: v }))}
                    min={5}
                    max={30}
                    step={1}
                    className="mt-4"
                  />
                </div>

                <div>
                  <Label>Fin d'appel sur silence ({turnSettings.silence_end_call_timeout}s)</Label>
                  <Slider
                    value={[turnSettings.silence_end_call_timeout || 30]}
                    onValueChange={([v]) => setTurnSettings(prev => ({ ...prev, silence_end_call_timeout: v }))}
                    min={10}
                    max={120}
                    step={5}
                    className="mt-4"
                  />
                </div>
              </div>

              <Button onClick={handleSaveTurn} disabled={updateTurn.isPending} className="gap-2">
                {updateTurn.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder Tours
              </Button>
            </motion.div>
          </AccordionContent>
        </AccordionItem>

        {/* ASR Settings */}
        <AccordionItem value="asr" className="border rounded-lg bg-card/50 backdrop-blur-sm">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Mic className="h-5 w-5 text-purple-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Reconnaissance Vocale</h3>
                <p className="text-sm text-muted-foreground">Paramètres ASR</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <motion.div variants={itemVariants} className="space-y-6">
              <div>
                <Label>Qualité</Label>
                <Select
                  value={asrSettings.quality || 'high'}
                  onValueChange={(v: any) => setAsrSettings(prev => ({ ...prev, quality: v }))}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high">Haute (recommandé)</SelectItem>
                    <SelectItem value="standard">Standard</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Mots-clés personnalisés</Label>
                <Input
                  value={keywords}
                  onChange={(e) => setKeywords(e.target.value)}
                  placeholder="mot1, mot2, mot3..."
                  className="mt-2"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Séparez les mots-clés par des virgules pour améliorer la reconnaissance.
                </p>
              </div>

              <Button onClick={handleSaveASR} disabled={updateASR.isPending} className="gap-2">
                {updateASR.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder ASR
              </Button>
            </motion.div>
          </AccordionContent>
        </AccordionItem>

        {/* Prompt Settings */}
        <AccordionItem value="prompt" className="border rounded-lg bg-card/50 backdrop-blur-sm">
          <AccordionTrigger className="px-6 hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-pink-500/10">
                <MessageSquare className="h-5 w-5 text-pink-500" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold">Prompt & Premier Message</h3>
                <p className="text-sm text-muted-foreground">Instructions de l'agent</p>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-6 pb-6">
            <motion.div variants={itemVariants} className="space-y-6">
              <div>
                <Label>Prompt Système</Label>
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  className="mt-2 font-mono text-sm"
                  placeholder="Vous êtes un assistant IA..."
                />
              </div>

              <div>
                <Label>Premier Message</Label>
                <Textarea
                  value={firstMessage}
                  onChange={(e) => setFirstMessage(e.target.value)}
                  rows={2}
                  className="mt-2"
                  placeholder="Bonjour, comment puis-je vous aider ?"
                />
              </div>

              <Button onClick={handleSavePrompt} disabled={updatePrompt.isPending} className="gap-2 bg-gradient-to-r from-pink-500 to-purple-500">
                {updatePrompt.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Sauvegarder Prompt
              </Button>
            </motion.div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Tips Card */}
      <motion.div variants={itemVariants}>
        <Card className="bg-gradient-to-br from-primary/5 via-purple-500/5 to-pink-500/5 border-border/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-purple-500/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold mb-2 flex items-center gap-2">
                  Conseil IA
                  <Zap className="h-3 w-3 text-yellow-400" />
                </h3>
                <p className="text-sm text-muted-foreground">
                  Pour de meilleurs résultats, ajustez la stabilité entre 0.3 et 0.7. 
                  Une valeur trop haute peut rendre la voix monotone. Utilisez les mots-clés
                  pour améliorer la reconnaissance de termes spécifiques à votre domaine.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
};

export default PortalSettings;
