import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed, MessageSquare, Voicemail, Smartphone, Settings, Activity } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface Mapping {
  extension: string;
  display_name: string | null;
  status: string | null;
  forward_enabled?: boolean | null;
  forward_to?: string | null;
}

export default function PortalDashboard() {
  const { user } = useAuth();
  const [me, setMe] = useState<Mapping | null>(null);
  const [calls, setCalls] = useState<any[]>([]);
  const [sms, setSms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const { data: sp } = await supabase
        .from("pbx_softphone_users")
        .select("extension, display_name, status, forward_enabled, forward_to")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      setMe(sp as any);

      if (sp?.extension) {
        const { data: cdrs } = await supabase
          .from("pbx_call_records")
          .select("id, direction, caller_id_number, destination_number, duration_seconds, start_stamp, missed_call")
          .or(`caller_id_number.eq.${sp.extension},destination_number.eq.${sp.extension}`)
          .order("start_stamp", { ascending: false })
          .limit(20);
        setCalls(cdrs || []);

        const { data: threads } = await supabase
          .from("pbx_sms_threads")
          .select("id, contact_name, contact_phone, unread_count, last_message_at")
          .order("last_message_at", { ascending: false })
          .limit(10);
        setSms(threads || []);
      }
      setLoading(false);
    })();
  }, [user?.id]);

  const todayCalls = calls.filter((c) => c.start_stamp && new Date(c.start_stamp).toDateString() === new Date().toDateString());
  const missed = todayCalls.filter((c) => c.missed_call).length;
  const inbound = todayCalls.filter((c) => c.direction === "inbound").length;
  const outbound = todayCalls.filter((c) => c.direction === "outbound").length;
  const unread = sms.reduce((s, t: any) => s + (t.unread_count || 0), 0);

  if (loading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Loading your portal…</div>;
  }

  if (!me) {
    return (
      <div className="max-w-md mx-auto mt-12">
        <Card>
          <CardContent className="py-10 text-center space-y-3">
            <Phone className="w-10 h-10 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">No extension assigned</h2>
            <p className="text-sm text-muted-foreground">
              Your account isn't linked to a softphone extension yet. Contact your administrator.
            </p>
            <Button asChild variant="outline" size="sm">
              <Link to="/org/lemtel/portal/diagnostic">Run diagnostic</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const dot =
    me.status === "available" ? "bg-emerald-500" :
    me.status === "oncall" ? "bg-amber-500" :
    me.status === "dnd" ? "bg-rose-500" :
    "bg-muted-foreground";

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Welcome, {me.display_name || `Ext ${me.extension}`}</h1>
          <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
            <span className={`w-2 h-2 rounded-full ${dot}`} />
            Extension {me.extension} · {me.status || "offline"}
            {me.forward_enabled && me.forward_to && (
              <Badge variant="outline" className="ml-2">↪ forwarding to {me.forward_to}</Badge>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link to="/org/lemtel/portal/softphone"><Phone className="w-4 h-4 mr-2" /> Open Softphone</Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link to="/org/lemtel/portal/diagnostic"><Settings className="w-4 h-4 mr-2" /> Diagnostic</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="Calls today" value={todayCalls.length} Icon={Activity} color="text-blue-500" />
        <Kpi label="Inbound" value={inbound} Icon={PhoneIncoming} color="text-emerald-500" />
        <Kpi label="Outbound" value={outbound} Icon={PhoneOutgoing} color="text-indigo-500" />
        <Kpi label="Missed" value={missed} Icon={PhoneMissed} color="text-rose-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Recent calls</CardTitle></CardHeader>
          <CardContent className="p-0">
            {calls.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">No calls yet</div>
            ) : (
              <ul className="divide-y">
                {calls.slice(0, 8).map((c) => (
                  <li key={c.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    {c.missed_call ? <PhoneMissed className="w-4 h-4 text-rose-500" /> :
                      c.direction === "inbound" ? <PhoneIncoming className="w-4 h-4 text-emerald-500" /> :
                      <PhoneOutgoing className="w-4 h-4 text-indigo-500" />}
                    <span className="font-mono text-xs flex-1 truncate">
                      {c.direction === "inbound" ? c.caller_id_number : c.destination_number}
                    </span>
                    <span className="text-xs text-muted-foreground">{c.duration_seconds || 0}s</span>
                    <span className="text-xs text-muted-foreground">
                      {c.start_stamp ? formatDistanceToNow(new Date(c.start_stamp), { addSuffix: true }) : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-base">SMS inbox</CardTitle>
            {unread > 0 && <Badge>{unread} unread</Badge>}
          </CardHeader>
          <CardContent className="p-0">
            {sms.length === 0 ? (
              <div className="px-4 py-6 text-sm text-muted-foreground text-center">No messages</div>
            ) : (
              <ul className="divide-y">
                {sms.slice(0, 8).map((t: any) => (
                  <li key={t.id} className="flex items-center gap-3 px-4 py-2 text-sm">
                    <MessageSquare className="w-4 h-4 text-muted-foreground" />
                    <span className="flex-1 truncate">{t.contact_name || t.contact_phone}</span>
                    {t.unread_count > 0 && <Badge variant="secondary">{t.unread_count}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickLink to="/org/lemtel/portal/softphone" Icon={Phone} label="Softphone" />
        <QuickLink to="/org/lemtel/portal/calls" Icon={Activity} label="Call history" />
        <QuickLink to="/org/lemtel/portal/messages" Icon={MessageSquare} label="Messages" />
        <QuickLink to="/org/lemtel/portal/extensions" Icon={Smartphone} label="Extensions" />
      </div>
    </div>
  );
}

function Kpi({ label, value, Icon, color }: { label: string; value: number; Icon: any; color: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs text-muted-foreground font-normal">{label}</CardTitle>
        <Icon className={`w-4 h-4 ${color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ to, Icon, label }: { to: string; Icon: any; label: string }) {
  return (
    <Link to={to} className="block">
      <Card className="hover:bg-muted/40 transition cursor-pointer">
        <CardContent className="flex items-center gap-3 py-3">
          <Icon className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
