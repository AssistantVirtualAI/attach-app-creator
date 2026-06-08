import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkles } from "lucide-react";

export default function AIAssistant() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">AVA AI Assistant</h1>
        <p className="text-sm text-muted-foreground">Ask AVA about your calls, voicemail or schedule.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4" /> Personal assistant</CardTitle>
          <Badge variant="secondary">Coming in Phase 3</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Summarize today's calls, draft voicemail greetings, prepare quick replies.
        </CardContent>
      </Card>
    </div>
  );
}
