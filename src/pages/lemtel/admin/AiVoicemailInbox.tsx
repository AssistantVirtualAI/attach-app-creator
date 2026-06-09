import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Voicemail, Sparkles, CheckCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VM {
  id: string;
  extension: string | null;
  caller_number: string | null;
  duration_seconds: number | null;
  transcript: string | null;
  ai_summary: string | null;
  ai_sentiment?: string | null;
  read_at: string | null;
  created_at: string;
}

export default function AiVoicemailInbox() {
  const { selectedOrgId } = useOrganization();
  const [items, setItems] = useState<VM[]>([]);

  const load = async () => {
    if (!selectedOrgId) return;
    const { data } = await supabase
      .from("pbx_voicemails").select("*")
      .eq("organization_id", selectedOrgId)
      .order("created_at", { ascending: false })
      .limit(50);
    setItems((data ?? []) as unknown as VM[]);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel("vm-inbox")
      .on("postgres_changes", { event: "*", schema: "public", table: "pbx_voicemails" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, [selectedOrgId]);

  const markRead = async (id: string) => {
    await supabase.rpc("mark_voicemail_read", { _id: id });
    load();
  };

  const status = (v: VM) =>
    v.ai_summary ? "summarized" : v.transcript ? "transcribed" : "received";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Voicemail className="h-6 w-6" /> AI Voicemail Inbox
        </h1>
        <p className="text-sm text-muted-foreground">Live transcripts, summaries and sentiment for your voicemails.</p>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <p className="text-sm text-muted-foreground">No voicemails.</p>}
        {items.map((v) => (
          <Card key={v.id} className={v.read_at ? "" : "border-primary/50"}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle className="text-base">
                  From {v.caller_number ?? "Unknown"} · ext {v.extension ?? "-"}
                </CardTitle>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString()} · {v.duration_seconds ?? 0}s
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={v.ai_summary ? "default" : "secondary"}>{status(v)}</Badge>
                {v.ai_sentiment && <Badge variant="outline">{v.ai_sentiment}</Badge>}
                {!v.read_at && (
                  <Button size="sm" variant="ghost" onClick={() => markRead(v.id)}>
                    <CheckCheck className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {v.ai_summary && (
                <div className="bg-muted/50 rounded p-2">
                  <div className="text-xs font-medium flex items-center gap-1 mb-1">
                    <Sparkles className="h-3 w-3" /> AI summary
                  </div>
                  {v.ai_summary}
                </div>
              )}
              {v.transcript && (
                <details><summary className="cursor-pointer text-xs text-muted-foreground">Transcript</summary>
                  <p className="mt-1 whitespace-pre-wrap">{v.transcript}</p>
                </details>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
