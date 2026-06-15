import { ConsolePageHeader } from "@/components/console/ConsolePageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Bot } from "lucide-react";

export default function ConsoleChatbot() {
  return (
    <div>
      <ConsolePageHeader title="PBX Chatbot" description="Natural-language operations on the phone system." sourceId="extensions" hasData />
      <div className="p-4">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground space-y-2">
            <Bot className="h-8 w-8 mx-auto" />
            <div className="font-medium">Coming in Phase 4B</div>
            <div className="text-xs">Ask in plain English, get a confirmable action backed by the source registry.</div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
