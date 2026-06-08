import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";

export default function OrgChat() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Organization Chat</h1>
        <p className="text-sm text-muted-foreground">Real-time chat with your teammates inside your organization.</p>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><MessageSquare className="h-4 w-4" /> Channels</CardTitle>
          <Badge variant="secondary">Coming in Phase 4</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          General, Support, Sales and Admin channels — strictly isolated per organization.
        </CardContent>
      </Card>
    </div>
  );
}
