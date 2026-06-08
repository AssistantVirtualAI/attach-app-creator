import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Phone, Voicemail, MessageSquare, Headphones, Download, User, ArrowRight, FileText } from "lucide-react";
import { PortalRoleBadge } from "@/components/portals/PortalShells";

const quick = [
  { title: "Softphone", desc: "Make and receive calls", to: "/my/softphone", icon: Phone },
  { title: "My Calls", desc: "Your recent call history", to: "/my/calls", icon: FileText },
  { title: "Voicemail", desc: "Listen to messages", to: "/my/voicemail", icon: Voicemail },
  { title: "Messages", desc: "Team chat and SMS", to: "/my/messages", icon: MessageSquare },
  { title: "Recordings", desc: "Your call recordings", to: "/my/recordings", icon: Headphones },
  { title: "Downloads", desc: "Desktop and mobile apps", to: "/my/downloads", icon: Download },
  { title: "Profile", desc: "Your account and preferences", to: "/my/profile", icon: User },
];

export default function MyDashboardLanding() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <PortalRoleBadge role="my" />
        <h1 className="text-3xl font-bold mt-1">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Your personal workspace</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quick.map((q) => (
          <Card key={q.to} className="hover:border-primary/40 transition-colors">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <q.icon className="h-4 w-4 text-primary" /> {q.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground mb-3">{q.desc}</p>
              <Button asChild size="sm" variant="outline">
                <Link to={q.to}>Open <ArrowRight className="ml-1 h-3 w-3" /></Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
