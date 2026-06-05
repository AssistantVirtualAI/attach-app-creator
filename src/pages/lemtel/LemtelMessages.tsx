import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, MessageSquare } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Thread {
  id: string;
  did_number: string;
  contact_number: string;
  contact_name: string | null;
  messages: any[];
  unread_count: number;
  last_message_at: string;
}

export default function LemtelMessages() {
  const { toast } = useToast();
  const [threads, setThreads] = useState<Thread[]>([]);
  const [selectedDid, setSelectedDid] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const load = async () => {
    const { data } = await supabase.from('lemtel_sms_threads').select('*').order('last_message_at', { ascending: false });
    setThreads((data as any) || []);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel('lemtel-sms-inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lemtel_sms_threads' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const dids = Array.from(new Set(threads.map((t) => t.did_number)));
  const activeDid = selectedDid || dids[0];
  const didThreads = threads.filter((t) => t.did_number === activeDid);

  const send = async () => {
    if (!selectedThread || !input.trim()) return;
    setSending(true);
    const { error } = await supabase.functions.invoke('telnyx-sms', {
      body: { from: selectedThread.did_number, to: selectedThread.contact_number, text: input },
    });
    setSending(false);
    if (error) toast({ title: 'Send failed', description: error.message, variant: 'destructive' });
    else { setInput(''); load(); }
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
            <button key={d} onClick={() => { setSelectedDid(d); setSelectedThread(null); }}
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
            ) : didThreads.map((t) => (
              <button key={t.id} onClick={() => setSelectedThread(t)}
                className={`w-full text-left p-2 rounded text-sm border-b ${selectedThread?.id === t.id ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                <div className="font-medium">{t.contact_name || t.contact_number}</div>
                <div className="text-xs text-muted-foreground truncate">{(t.messages?.[t.messages.length - 1] as any)?.text}</div>
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
              <div className="border-b p-3"><div className="font-medium">{selectedThread.contact_name || selectedThread.contact_number}</div></div>
              <ScrollArea className="flex-1 p-4">
                <div className="space-y-2">
                  {(selectedThread.messages || []).map((m: any, i: number) => (
                    <div key={i} className={`flex ${m.direction === 'outbound' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] px-3 py-2 rounded-lg text-sm ${m.direction === 'outbound' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                        {m.text}
                      </div>
                    </div>
                  ))}
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
