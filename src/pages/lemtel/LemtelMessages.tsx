import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare, Plus, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { usePbxSmsThreads, usePbxSmsMessages } from '@/hooks/usePbxData';
import { useSmsTemplates } from '@/hooks/useSmsTemplates';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Label } from '@/components/ui/label';

export default function LemtelMessages() {
  const { toast } = useToast();
  const { data: threads = [] } = usePbxSmsThreads();
  const { templates } = useSmsTemplates();
  const qc = useQueryClient();
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [newTo, setNewTo] = useState('');
  const [newText, setNewText] = useState('');

  const selectedThread = (threads as any[]).find(t => t.id === selectedThreadId) || null;
  const { data: messages = [] } = usePbxSmsMessages(selectedThreadId);

  const dids = Array.from(new Set((threads as any[]).map(t => t.did_number)));
  const activeDid = selectedDid || dids[0];
  const didThreads = (threads as any[]).filter(t => t.did_number === activeDid);

  const startNew = async () => {
    if (!activeDid || !newTo.trim() || !newText.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('telnyx-sms', {
      body: { from: activeDid, to: newTo.trim(), text: newText },
    });
    setSending(false);
    if (error) toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    else {
      toast({ title: 'Message sent' });
      setNewOpen(false); setNewTo(''); setNewText('');
      qc.invalidateQueries({ queryKey: ['pbx', 'pbx_sms_threads'] });
    }
  };

  const send = async () => {
    if (!selectedThread || !input.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('telnyx-sms', {
      body: { from: selectedThread.did_number, to: selectedThread.contact_phone, text: input, thread_id: selectedThread.id },
    });
    setSending(false);
    if (error) toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    else {
      setInput('');
      qc.invalidateQueries({ queryKey: ['pbx', 'pbx_sms_messages', selectedThread.id] });
      qc.invalidateQueries({ queryKey: ['pbx', 'pbx_sms_threads'] });
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      <h1 className="text-3xl font-bold mb-4">Messages (SMS)</h1>
      <div className="flex-1 flex gap-4 min-h-0">
        <Card className="w-48 p-3 overflow-auto">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">DIDs</h3>
          {dids.length === 0 ? (
            <p className="text-xs text-muted-foreground">No SMS DIDs yet</p>
          ) : dids.map((d) => (
            <button key={d} onClick={() => { setSelectedDid(d); setSelectedThreadId(null); }}
              className={`w-full text-left px-2 py-1.5 rounded text-sm ${activeDid === d ? 'bg-primary/10 text-primary' : 'hover:bg-muted'}`}>
              {d}
            </button>
          ))}
        </Card>
        <Card className="w-72 p-3 overflow-hidden flex flex-col">
          <h3 className="text-xs font-semibold text-muted-foreground mb-2">Conversations</h3>
          <ScrollArea className="flex-1">
            {didThreads.length === 0 ? (
              <p className="text-xs text-muted-foreground">No conversations</p>
            ) : didThreads.map((t: any) => (
              <button key={t.id} onClick={() => setSelectedThreadId(t.id)}
                className={`w-full text-left p-2 rounded text-sm border-b ${selectedThreadId === t.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <div className="font-medium">{t.contact_name || t.contact_phone}</div>
                <div className="text-xs text-muted-foreground truncate">{t.last_message_at ? new Date(t.last_message_at).toLocaleString() : ''}</div>
              </button>
            ))}
          </ScrollArea>
        </Card>
        <Card className="flex-1 flex flex-col">
          {!selectedThread ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center"><MessageSquare className="w-12 h-12 mx-auto mb-2" /><p>Select a conversation</p></div>
            </div>
          ) : (
            <>
              <div className="border-b p-3"><div className="font-medium">{selectedThread.contact_name || selectedThread.contact_phone}</div></div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {(messages as any[]).map((m: any) => (
                    <div key={m.id} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {m.body}
                      </div>
                    </div>
                  ))}
                  {messages.length === 0 && <p className="text-xs text-muted-foreground text-center">No messages.</p>}
                </div>
              </ScrollArea>
              <div className="border-t p-3 flex gap-2">
                <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Type a message..."
                  onKeyDown={(e) => e.key === 'Enter' && send()} />
                <Button onClick={send} disabled={sending || !input.trim()}><Send className="w-4 h-4" /></Button>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
