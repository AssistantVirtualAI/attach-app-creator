import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Sparkles, Send, Loader2, X, MessageCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Msg = { role: "user" | "assistant"; content: string };

const SUGGESTIONS = [
  "Summarize my calls today",
  "Show my unread voicemails",
  "Generate a voicemail greeting saying: Hi, you've reached me, please leave a message",
  "Analyze my recent call sentiment",
];

export function MyAIChat({ embedded = false, onClose }: { embedded?: boolean; onClose?: () => void }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || loading) return;
    setInput("");
    const newMsgs: Msg[] = [...messages, { role: "user", content: text }];
    setMessages(newMsgs);
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("my-ai-assistant", {
        body: { messages: newMsgs },
      });
      if (error) throw error;
      if (data?.error === "rate_limited") { toast.error("Rate limit reached. Try again in a moment."); return; }
      if (data?.error === "ai_credits_exhausted") { toast.error("AI credits exhausted — please add credits."); return; }
      if (data?.error) { toast.error(data.error); return; }
      setMessages([...newMsgs, { role: "assistant", content: data?.message ?? "(no response)" }]);
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to reach assistant");
    } finally { setLoading(false); }
  }, [input, loading, messages]);

  return (
    <Card className={cn("flex flex-col bg-background/95 backdrop-blur", embedded ? "h-[600px]" : "h-full")}>
      <header className="flex items-center justify-between px-4 py-2.5 border-b">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">AVA Assistant</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setMessages([])} title="Clear">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
          {onClose && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Hi! I can summarize your calls, manage your voicemail greeting, and analyze recent activity. Try:
            </p>
            <div className="flex flex-col gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)}
                  className="text-left text-xs p-2 rounded border hover:border-primary/50 hover:bg-accent transition">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted",
            )}>
              {m.role === "assistant"
                ? <div className="prose prose-sm dark:prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_h3]:my-1"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                : <span className="whitespace-pre-wrap">{m.content}</span>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
            </div>
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }}
        className="flex items-center gap-2 p-3 border-t">
        <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask AVA…" disabled={loading} />
        <Button type="submit" size="icon" disabled={loading || !input.trim()}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </Card>
  );
}

export function MyAIChatLauncher() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        size="lg"
        className="fixed bottom-5 right-5 z-40 rounded-full h-14 w-14 shadow-2xl shadow-primary/30 p-0"
        aria-label="Open AVA assistant"
      >
        <Sparkles className="h-6 w-6" />
      </Button>
      {open && (
        <div className="fixed bottom-24 right-5 z-50 w-[380px] max-w-[calc(100vw-2.5rem)] h-[560px] max-h-[calc(100vh-8rem)] shadow-2xl rounded-lg overflow-hidden">
          <MyAIChat onClose={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
