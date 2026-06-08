import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock, Phone, ShieldCheck } from "lucide-react";

export default function TelecomSettings() {
  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold">Telecom Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your extension, working hours and after-hours call handling.</p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Phone className="h-4 w-4" /> Extension</CardTitle>
          <Badge variant="secondary">Coming in Phase 2</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Extension number, SIP registration status, availability presence.
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2 text-base"><Clock className="h-4 w-4" /> Working Hours</CardTitle>
          <Badge variant="secondary">Coming in Phase 2</Badge>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Monday–Sunday schedule, timezone, break window, after-hours routing.
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-4 w-4" /> Security</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          SIP passwords are never displayed in this app. Use the password reset action to rotate them via secure email.
        </CardContent>
      </Card>
    </div>
  );
}
