import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sparkles, Send, ShieldAlert } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface Msg { role: "user" | "assistant"; content: string; }

export default function AvaAdminChat() {
  const { selectedOrgId } = useOrganization();
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm AVA. I can suggest telecom actions; you confirm before anything destructive runs." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!input.trim() || !selectedOrgId) return;
    const userMsg: Msg = { role: "user", content: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("telecom-admin-ai-agent", {
        body: { organizationId: selectedOrgId, messages: [...messages, userMsg] },
      });
      if (error) throw error;
      const reply = (data as any)?.reply ?? "(no reply)";
      setMessages((m) => [...m, { role: "assistant", content: reply }]);
    } catch (e) {
      toast({ title: "AVA failed", description: String((e as Error).message), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Sparkles className="h-6 w-6" /> AVA Admin Assistant
        </h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          <ShieldAlert className="h-3 w-3" /> Two-step propose → confirm. Destructive ops require explicit re-typed confirmation.
        </p>
      </div>
      <Card className="min-h-[60vh] flex flex-col">
        <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-auto">
          {messages.map((m, i) => (
            <div key={i} className={`rounded p-3 text-sm ${m.role === "user" ? "bg-primary/10 ml-12" : "bg-muted mr-12"}`}>
              <div className="text-xs text-muted-foreground mb-1">{m.role === "user" ? "You" : "AVA"}</div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </CardContent>
        <div className="border-t p-3 flex gap-2">
          <Input value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }}
            placeholder="Ask AVA…" disabled={loading} />
          <Button onClick={send} disabled={loading}><Send className="h-4 w-4" /></Button>
        </div>
      </Card>
    </div>
  );
}
