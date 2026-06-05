import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Voicemail, Plus, Sparkles, Play, Volume2, Loader2 } from 'lucide-react';
import { usePbxIvrs, usePbxIvrOptions } from '@/hooks/usePbxData';
import { PbxRefreshButton } from '@/components/lemtel/PbxRefreshButton';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function LemtelIVR() {
  const { data: ivrs = [], isLoading } = usePbxIvrs();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = (ivrs as any[]).find(i => i.id === selectedId) || null;
  const { data: options = [] } = usePbxIvrOptions(selectedId);

  useEffect(() => {
    if (!selectedId && ivrs.length > 0) setSelectedId((ivrs as any[])[0].id);
  }, [ivrs, selectedId]);

  const [aiOpen, setAiOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiLang, setAiLang] = useState<'en' | 'fr' | 'bilingual'>('bilingual');
  const [generating, setGenerating] = useState(false);

  const generate = async () => {
    if (!aiPrompt.trim()) return toast.error('Describe what the IVR should say');
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('ivr-script-generator', {
        body: { prompt: aiPrompt, language: aiLang },
      });
      if (error) throw error;
      const script = (data as { script?: string })?.script ?? '';
      toast.success('Script generated. Copy into a new IVR.');
      console.log('Generated IVR script:', script);
      setAiOpen(false);
      setAiPrompt('');
    } catch (e: any) {
      toast.error(e?.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Voicemail className="w-7 h-7" /> Auto-Attendant (IVR)</h1>
          <p className="text-muted-foreground">IVR menus synced from FusionPBX with AI-generated scripts</p>
        </div>
        <div className="flex gap-2">
          <PbxRefreshButton kind="ivr-queues" />
          <Dialog open={aiOpen} onOpenChange={setAiOpen}>
            <DialogTrigger asChild>
              <Button variant="outline"><Sparkles className="w-4 h-4 mr-2" /> AI Generate</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Generate IVR with AI</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Language</Label>
                  <Select value={aiLang} onValueChange={(v: any) => setAiLang(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">English</SelectItem>
                      <SelectItem value="fr">Français</SelectItem>
                      <SelectItem value="bilingual">Bilingual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Describe the business and what the menu should offer</Label>
                  <Textarea rows={4} value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Dental clinic. Press 1 for appointments, 2 for billing, 3 for emergencies..." />
                </div>
              </div>
              <DialogFooter><Button onClick={generate} disabled={generating}>{generating ? 'Generating…' : 'Generate'}</Button></DialogFooter>
            </DialogContent>
          </Dialog>
          <Button><Plus className="w-4 h-4 mr-2" /> New IVR</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle>IVR Menus ({ivrs.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="animate-spin" /></div>
            ) : ivrs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No IVRs synced.</p>
            ) : (ivrs as any[]).map(ivr => (
              <button key={ivr.id} onClick={() => setSelectedId(ivr.id)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selectedId === ivr.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <div className="font-medium text-sm">{ivr.name}</div>
                <div className="text-xs text-muted-foreground">Ext {ivr.extension || '—'}</div>
                {ivr.enabled === false && <Badge variant="outline" className="mt-1 text-xs">disabled</Badge>}
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
                  <Button variant="outline" size="sm"><Play className="w-4 h-4 mr-2" /> Preview</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Greeting</Label>
                  <Textarea value={selected.greet_long || selected.greet_short || ''} readOnly rows={3} className="mt-1" />
                </div>
                <div>
                  <Label>Menu Options</Label>
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
                    {options.length === 0 && <p className="text-sm text-muted-foreground">No options configured.</p>}
                  </div>
                </div>
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center text-muted-foreground">Select an IVR to view</CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
