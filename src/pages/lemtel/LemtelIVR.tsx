import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Voicemail, Plus, Sparkles, Play, Volume2, Loader2, Mic, Save, Wand2, AlertCircle, RotateCcw, CheckCircle2 } from 'lucide-react';
import { usePbxIvrs, usePbxIvrOptions } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrganization } from '@/context/OrganizationContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';

// Curated ElevenLabs voices (multilingual v2 compatible)
const VOICES = [
  { id: '21m00Tcm4TlvDq8ikWAM', name: 'Rachel · Calm Female (EN)' },
  { id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah · Warm Female (EN/FR)' },
  { id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura · Friendly Female (EN/FR)' },
  { id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda · Soft Female (EN/FR)' },
  { id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice · British Female' },
  { id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica · Conversational' },
  { id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George · Deep Male (EN/FR)' },
  { id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel · Authoritative Male' },
  { id: 'nPczCjzI2devNBz1zQrb', name: 'Brian · Narrator Male' },
  { id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam · Young Male' },
  { id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie · Casual Male' },
];

type IvrAudioPreview = {
  id?: string;
  audio_url?: string | null;
  storage_path?: string | null;
  script_text?: string | null;
  elevenlabs_voice_id?: string | null;
  language?: string | null;
  status?: string | null;
  created_at?: string | null;
};

const errorText = (error: any, fallback: string) =>
  error?.message || error?.error_description || error?.details || error?.hint || fallback;

export default function LemtelIVR() {
  const { selectedOrgId } = useOrganization();
  const queryClient = useQueryClient();
  const { data: ivrs = [], isLoading } = usePbxIvrs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (ivrs as any[]).find(i => i.id === selectedId) || null;
  const { data: options = [] } = usePbxIvrOptions(selectedId);

  useEffect(() => {
    if (!selectedId && ivrs.length > 0) setSelectedId((ivrs as any[])[0].id);
  }, [ivrs, selectedId]);

  // ===== AI script generator =====
  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLang, setAiLang] = useState<'en' | 'fr' | 'bilingual'>('bilingual');
  const [generating, setGenerating] = useState(false);

  // ===== ElevenLabs voice studio =====
  const [script, setScript] = useState('');
  const [voiceId, setVoiceId] = useState(VOICES[1].id);
  const [language, setLanguage] = useState<'fr' | 'en' | 'es'>('fr');
  const [synthesizing, setSynthesizing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<IvrAudioPreview | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [lastAction, setLastAction] = useState<'generate' | 'save' | null>(null);

  // Load existing greeting/audio when selecting an IVR
  useEffect(() => {
    if (selected) {
      setScript(selected.greet_long || selected.greet_short || '');
      setPreview(null);
      setGenerateError(null);
      setSaveError(null);
    }
  }, [selectedId]);

  // Fetch most recent generated audio for this IVR
  const { data: lastAudio } = useQuery({
    queryKey: ['ivr-audio', selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pbx_ivr_audio')
        .select('*')
        .eq('ivr_id', selectedId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      if (!data?.storage_path) return data;
      const { data: signed } = await supabase.storage
        .from('lemtel-ivr-audio')
        .createSignedUrl(data.storage_path, 3600);
      return { ...data, audio_url: signed?.signedUrl || data.audio_url };
    },
  });

  useEffect(() => {
    if (lastAudio?.audio_url && !preview) {
      setPreview(lastAudio as IvrAudioPreview);
      if (lastAudio.script_text) setScript(lastAudio.script_text);
    }
    if (lastAudio?.elevenlabs_voice_id) setVoiceId(lastAudio.elevenlabs_voice_id);
    if (lastAudio?.language) setLanguage(lastAudio.language as any);
  }, [lastAudio?.id]);

  const generateScript = async () => {
    if (!aiPrompt.trim()) return toast.error('Décrivez ce que doit dire le menu');
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ivr-script-generator', {
        body: { prompt: aiPrompt, language: aiLang },
      });
      if (error) throw error;
      const generated = (data as { script?: string })?.script ?? '';
      setScript(generated);
      toast.success('Script généré — vérifiez puis synthétisez la voix');
      setAiOpen(false);
      setAiPrompt('');
    } catch (e: any) {
      toast.error(e?.message || 'Échec génération');
    } finally {
      setGenerating(false);
    }
  };

  const synthesize = async () => {
    if (!script.trim()) return toast.error('Tapez un script');
    if (!selectedOrgId) return toast.error('Organisation introuvable');
    if (!selectedId) return toast.error('Sélectionnez un IVR');
    setLastAction('generate');
    setGenerateError(null);
    setSaveError(null);
    setPreview(null);
    setSynthesizing(true);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-generate-greeting', {
        body: {
          script_text: script,
          voice_id: voiceId,
          language,
          ivr_id: selectedId,
          organization_id: selectedOrgId,
        },
      });
      if (error) throw error;
      const url = (data as any)?.audio_url;
      if (!url) throw new Error('No audio URL returned');
      setPreview({
        id: (data as any)?.id,
        audio_url: url,
        storage_path: (data as any)?.storage_path,
        script_text: script,
        elevenlabs_voice_id: voiceId,
        language,
        status: 'ready',
      });
      queryClient.invalidateQueries({ queryKey: ['ivr-audio', selectedId] });
      toast.success('Voix générée — écoutez l’aperçu avant d’enregistrer');
    } catch (e: any) {
      const message = errorText(e, 'Échec de la génération ElevenLabs');
      setGenerateError(message);
      toast.error(message);
    } finally {
      setSynthesizing(false);
    }
  };

  const saveAsGreeting = async () => {
    if (!selected) return;
    if (!preview?.audio_url) {
      const message = 'Générez et écoutez un aperçu audio avant d’insérer le message dans l’IVR.';
      setSaveError(message);
      return toast.error(message);
    }
    setLastAction('save');
    setSaveError(null);
    setSaving(true);
    try {
      const voiceName = VOICES.find((voice) => voice.id === voiceId)?.name || voiceId;
      const { error } = await supabase
        .from('pbx_ivrs')
        .update({
          greet_long: script,
          raw_data: {
            ...(selected.raw_data || {}),
            elevenlabs_greeting: {
              audio_id: preview.id,
              audio_url: preview.audio_url,
              storage_path: preview.storage_path,
              script_text: script,
              elevenlabs_voice_id: voiceId,
              voice_name: voiceName,
              language,
              saved_at: new Date().toISOString(),
            },
          },
        } as any)
        .eq('id', selected.id);
      if (error) throw error;
      if (preview.id) {
        await supabase.from('pbx_ivr_audio').update({ status: 'saved' }).eq('id', preview.id);
      }
      queryClient.invalidateQueries({ queryKey: ['pbx', 'pbx_ivrs'] });
      queryClient.invalidateQueries({ queryKey: ['ivr-audio', selectedId] });
      toast.success('Message d\'accueil mis à jour');
    } catch (e: any) {
      const message = errorText(e, 'Échec de l’enregistrement du message d’accueil');
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Voicemail className="w-7 h-7" /> Auto-Attendant (IVR)</h1>
          <p className="text-muted-foreground">Menus IVR synchronisés depuis FusionPBX · Voix générées avec ElevenLabs</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="ivr-queues" />
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Sparkles className="w-4 h-4 mr-2" /> AI Script</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Générer un script IVR avec l'IA</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Langue</Label>
                  <Select value={aiLang} onValueChange={(v: any) => setAiLang(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="bilingual">Bilingue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Décrivez l'entreprise et le menu</Label>
                  <Textarea rows={4} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Clinique dentaire. 1 pour les rendez-vous, 2 pour la facturation, 3 pour les urgences..." />
                </div>
              </div>
              <DialogFooter><Button onClick={generateScript} disabled={generating}>{generating ? 'Génération…' : 'Générer'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button><Plus className="w-4 h-4 mr-2" /> Nouvel IVR</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>Menus IVR ({ivrs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
            ) : ivrs.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun IVR synchronisé.</p>
            ) : (ivrs as any[]).map(ivr => (
              <button key={ivr.id} onClick={() => setSelectedId(ivr.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedId === ivr.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <div className="font-medium text-sm">{ivr.name}</div>
                <div className="text-xs text-muted-foreground">Ext {ivr.extension || '—'}</div>
                {ivr.enabled === false && <Badge variant="outline" className="mt-1 text-xs">désactivé</Badge>}
              </button>
            ))}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          {selected ? (
            <>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selected.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">Extension {selected.extension || '—'}</p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* ElevenLabs Voice Studio */}
                <div className="rounded-lg border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Mic className="w-4 h-4 text-primary" />
                    <h3 className="font-semibold">Voice Studio · ElevenLabs</h3>
                    <Badge variant="outline" className="ml-auto text-[10px]">eleven_multilingual_v2</Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs">Voix</Label>
                      <Select value={voiceId} onValueChange={setVoiceId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {VOICES.map(v => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Langue</Label>
                      <Select value={language} onValueChange={(v: any) => setLanguage(v)}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                          <SelectItem value="es">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs flex items-center gap-2">
                      <Volume2 className="w-3 h-3" /> Script du message d'accueil
                    </Label>
                    <Textarea
                      rows={5}
                      value={script}
                      onChange={(e) => setScript(e.target.value)}
                      placeholder="Bonjour, vous avez joint... Pour les ventes, faites le 1. Pour le support, faites le 2…"
                      className="mt-1 font-mono text-sm"
                    />
                    <div className="text-[10px] text-muted-foreground mt-1 text-right">
                      {script.length} caractères
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button onClick={synthesize} disabled={synthesizing || !script.trim()} size="sm">
                      {synthesizing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Wand2 className="w-4 h-4 mr-2" />}
                      Générer la voix
                    </Button>
                    <Button onClick={saveAsGreeting} disabled={saving || !script.trim()} variant="outline" size="sm">
                      {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                      Enregistrer comme message d'accueil
                    </Button>
                  </div>

                  {audioUrl && (
                    <div className="rounded-md bg-background/60 p-3 border">
                      <div className="text-xs text-muted-foreground mb-2 flex items-center gap-2">
                        <Play className="w-3 h-3" /> Aperçu audio
                      </div>
                      <audio controls src={audioUrl} className="w-full" />
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Fichier stocké dans <code>lemtel-ivr-audio</code> · prêt pour l'import FusionPBX.
                      </p>
                    </div>
                  )}
                </div>

                {/* Menu Options */}
                <div>
                  <Label>Options du menu</Label>
                  <div className="mt-2 space-y-2">
                    {(options as any[]).map((opt: any) => (
                      <div key={opt.id} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">{opt.digit}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium capitalize">{(opt.destination_type || '').replace('_', ' ')}</div>
                          <div className="text-xs text-muted-foreground">→ {opt.destination_id || opt.description || '—'}</div>
                        </div>
                      </div>
                    ))}
                    {options.length === 0 && <p className="text-sm text-muted-foreground">Aucune option configurée.</p>}
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center text-muted-foreground">Sélectionnez un IVR</CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
