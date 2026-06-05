import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Voicemail, Mail, Play, Upload, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

export default function TelephonyVoicemail() {
  const [editing, setEditing] = useState<any>(null);
  const [script, setScript] = useState('');
  const [voiceId, setVoiceId] = useState('JBFqnCBsd6RMkjVDRZzb');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const { data: boxes = [], refetch } = useQuery({
    queryKey: ['voicemail-boxes'],
    queryFn: async () => {
      const { data } = await supabase
        .from('pbx_extensions')
        .select('id, extension, effective_cid_name, voicemail_enabled, raw_data')
        .eq('voicemail_enabled', true);
      return data || [];
    },
  });

  const generateGreeting = async () => {
    if (!script.trim()) return;
    setGenerating(true);
    setPreviewUrl(null);
    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-generate-greeting', {
        body: { text: script, voice_id: voiceId },
      });
      if (error) throw error;
      if (data?.audio_url) setPreviewUrl(data.audio_url);
      else if (data?.audio_base64) setPreviewUrl(`data:audio/mpeg;base64,${data.audio_base64}`);
      toast.success('Greeting generated');
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Voicemail className="w-7 h-7" /> Voicemail</h1>
        <p className="text-muted-foreground">Manage voicemail boxes and greetings</p>
      </div>

      <div className="grid gap-3">
        {boxes.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No voicemail-enabled extensions</CardContent></Card>
        ) : boxes.map((b: any) => (
          <Card key={b.id}>
            <CardContent className="py-4 flex items-center gap-4">
              <div className="flex-1">
                <div className="font-mono text-lg">Ext {b.extension}</div>
                <div className="text-xs text-muted-foreground">{b.effective_cid_name || '—'}</div>
                <div className="text-xs flex items-center gap-1 mt-1">
                  <Mail className="w-3 h-3" />
                  {b.raw_data?.voicemail_mail_to || 'No email forwarding'}
                </div>
              </div>
              <Switch checked={b.voicemail_enabled} />
              <Button size="sm" variant="outline" onClick={() => { setEditing(b); setScript(''); setPreviewUrl(null); }}>
                <Sparkles className="w-3 h-3 mr-1.5" /> Manage Greeting
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!editing} onOpenChange={() => setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Greeting — Ext {editing?.extension}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Upload audio (mp3/wav)</Label>
              <Input type="file" accept="audio/*" className="mt-1" />
            </div>
            <div className="border-t pt-3 space-y-2">
              <Label className="text-xs">Or generate with AI</Label>
              <Textarea
                value={script}
                onChange={(e) => setScript(e.target.value)}
                placeholder="Hi, you've reached… please leave a message after the tone."
                rows={4}
              />
              <Input value={voiceId} onChange={(e) => setVoiceId(e.target.value)} placeholder="ElevenLabs voice ID" />
              <Button onClick={generateGreeting} disabled={generating || !script} size="sm" className="w-full">
                <Sparkles className="w-3 h-3 mr-1.5" /> {generating ? 'Generating…' : 'Generate'}
              </Button>
              {previewUrl && (
                <audio controls src={previewUrl} className="w-full mt-2" />
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button disabled={!previewUrl}>
              <Upload className="w-3 h-3 mr-1.5" /> Publish to FusionPBX
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
