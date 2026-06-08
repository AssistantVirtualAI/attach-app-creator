import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Bot, ShieldAlert } from "lucide-react";

export default function AdminAIChat() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">AVA AI Telecom Admin</h1>
        <p className="text-sm text-muted-foreground">Configure your phone system through a guided AI assistant. Every change is confirmed before execution and audited.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Bot className="h-4 w-4" /> Admin AI Chat</CardTitle>
          <Badge variant="secondary">Coming in Phase 6</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Ask things like:</p>
          <ul className="list-disc list-inside text-xs space-y-1">
            <li>Create a holiday schedule for Christmas and New Year</li>
            <li>Change business hours to Mon–Fri 9am–5pm</li>
            <li>Reset SIP password for extension 205</li>
            <li>Route this DID to the sales queue</li>
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-amber-600"><ShieldAlert className="h-4 w-4" /> Safety</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          AVA will never apply a configuration change without your explicit confirmation. All actions are written to audit logs.
        </CardContent>
      </Card>
    </div>
  );
}
