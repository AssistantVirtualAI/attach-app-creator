import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Voicemail, Plus, Sparkles, Play, Volume2 } from 'lucide-react';
import { MOCK_IVRS, type LemtelIVR } from '@/lib/lemtelMockData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function LemtelIVR() {
  const [ivrs, setIvrs] = useState<LemtelIVR[]>(MOCK_IVRS);
  const [selected, setSelected] = useState<LemtelIVR | null>(ivrs[0] ?? null);
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
      const script = (data as { script?: string })?.script ?? 'Welcome. Press 1 for sales, 2 for support.';
      const newIvr: LemtelIVR = {
        id: `ivr_${Date.now()}`,
        name: `AI Generated — ${new Date().toLocaleDateString()}`,
        customer_name: 'Unassigned',
        language: aiLang,
        greeting: script,
        options: [{ key: '1', action: 'queue', destination: 'TBD' }, { key: '2', action: 'voicemail', destination: 'General VM' }],
      };
      setIvrs([newIvr, ...ivrs]);
      setSelected(newIvr);
      setAiOpen(false);
      setAiPrompt('');
      toast.success('IVR generated');
    } catch (e) {
      toast.error('Generation failed; created draft with placeholder script');
      const newIvr: LemtelIVR = {
        id: `ivr_${Date.now()}`, name: 'Draft IVR', customer_name: 'Unassigned', language: aiLang,
        greeting: aiPrompt, options: [],
      };
      setIvrs([newIvr, ...ivrs]); setSelected(newIvr); setAiOpen(false);
    } finally { setGenerating(false); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Voicemail className="w-7 h-7" /> Auto-Attendant (IVR)</h1>
          <p className="text-muted-foreground">Visual IVR builder with AI-generated scripts and ElevenLabs audio</p>
        </div>
        <div className="flex gap-2">
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
            {ivrs.map(ivr => (
              <button key={ivr.id} onClick={() => setSelected(ivr)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${selected?.id === ivr.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/50'}`}>
                <div className="font-medium text-sm">{ivr.name}</div>
                <div className="text-xs text-muted-foreground">{ivr.customer_name}</div>
                <Badge variant="outline" className="mt-1 text-xs">{ivr.language}</Badge>
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
                    <p className="text-sm text-muted-foreground mt-1">{selected.customer_name}</p>
                  </div>
                  <Button variant="outline" size="sm"><Play className="w-4 h-4 mr-2" /> Preview</Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label className="flex items-center gap-2"><Volume2 className="w-4 h-4" /> Greeting</Label>
                  <Textarea value={selected.greeting} readOnly rows={3} className="mt-1" />
                </div>
                <div>
                  <Label>Menu Options</Label>
                  <div className="mt-2 space-y-2">
                    {selected.options.map((opt, i) => (
                      <div key={i} className="flex items-center gap-2 p-3 border rounded-lg bg-muted/30">
                        <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground font-bold flex items-center justify-center">{opt.key}</div>
                        <div className="flex-1">
                          <div className="text-sm font-medium capitalize">{opt.action.replace('_', ' ')}</div>
                          <div className="text-xs text-muted-foreground">→ {opt.destination}</div>
                        </div>
                      </div>
                    ))}
                    {selected.options.length === 0 && <p className="text-sm text-muted-foreground">No options configured.</p>}
                  </div>
                </div>
                <Input placeholder="ElevenLabs voice ID (optional)" />
              </CardContent>
            </>
          ) : (
            <CardContent className="py-16 text-center text-muted-foreground">Select an IVR to edit</CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
