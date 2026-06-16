import { useEffect, useMemo, useRef, useState } from "react";
import {
  Phone, PhoneOff, PhoneIncoming, Mic, MicOff, Pause, Play,
  X, Minimize2, Settings, Delete, ClipboardPaste, ArrowRightLeft,
  Plus, Hash, Volume2, MessageSquare, Users, Clock, Grid3x3,
  Sparkles, RefreshCw, AlertCircle, CheckCircle2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useSoftphone, UserStatus } from "@/hooks/useSoftphone";
import { useLemtelAccess } from "@/hooks/useLemtelAccess";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { SoftphoneDiagnostics } from "@/components/softphone/SoftphoneDiagnostics";
import { useToast } from "@/hooks/use-toast";

type Tab = "dial" | "recents" | "sms" | "contacts";

const DIALPAD: { k: string; sub?: string }[] = [
  { k: "1" }, { k: "2", sub: "ABC" }, { k: "3", sub: "DEF" },
  { k: "4", sub: "GHI" }, { k: "5", sub: "JKL" }, { k: "6", sub: "MNO" },
  { k: "7", sub: "PQRS" }, { k: "8", sub: "TUV" }, { k: "9", sub: "WXYZ" },
  { k: "*" }, { k: "0", sub: "+" }, { k: "#" },
];

function statusDotClass(s: string): string {
  if (s === "registered") return "bg-emerald-500";
  if (s === "connecting" || s === "connected") return "bg-amber-500";
  if (s === "error" || s === "disconnected") return "bg-rose-500";
  return "bg-slate-400";
}

function userStatusClass(s: UserStatus): string {
  if (s === "available") return "bg-emerald-500";
  if (s === "busy") return "bg-rose-500";
  if (s === "dnd") return "bg-red-700";
  return "bg-amber-500";
}

function formatDuration(ms: number) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600).toString().padStart(2, "0");
  const m = Math.floor((s % 3600) / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${h}:${m}:${sec}`;
}

function initials(name: string) {
  const parts = (name || "?").trim().split(/\s+/);
  return (parts[0]?.[0] || "?") + (parts[1]?.[0] || "");
}

export interface SoftphoneWidgetProps {
  variant?: "floating" | "full";
}

export function SoftphoneWidget({ variant = "floating" }: SoftphoneWidgetProps) {
  const { isMember } = useLemtelAccess();
  const { user } = useAuth();
  const sp = useSoftphone();
  const { toast } = useToast();
  const audioRef = useRef<HTMLAudioElement>(null);
  const [expanded, setExpanded] = useState(variant === "full");
  const [tab, setTab] = useState<Tab>("dial");
  const [number, setNumber] = useState("");
  const [showDTMF, setShowDTMF] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferTarget, setTransferTarget] = useState("");
  const [tick, setTick] = useState(0);
  const [shake, setShake] = useState(false);
  const [relinking, setRelinking] = useState(false);
  const [showInsights, setShowInsights] = useState(true);

  useEffect(() => { sp.setAudioEl(audioRef.current); }, [sp]);

  useEffect(() => {
    if (sp.snap.callState !== "active") return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [sp.snap.callState]);

  useEffect(() => {
    if (sp.snap.callState === "ringing-in") setExpanded(true);
  }, [sp.snap.callState]);

  // Recent calls
  const { data: recents = [] } = useQuery({
    queryKey: ["softphone-recents", sp.config?.extension],
    enabled: !!sp.config?.extension,
    queryFn: async () => {
      const { data } = await supabase
        .from("pbx_call_records")
        .select("id, direction, caller_number, destination_number, duration_seconds, start_at")
        .order("start_at", { ascending: false })
        .limit(20);
      return data || [];
    },
  });

  // Contacts (extensions + clients)
  const { data: contacts = [] } = useQuery({
    queryKey: ["softphone-contacts"],
    enabled: isMember,
    queryFn: async () => {
      const [{ data: exts }] = await Promise.all([
        supabase.from("pbx_extensions").select("id, extension, effective_cid_name, description"),
      ]);
      const merged = [
        ...(exts || []).map((e: any) => ({
          id: `ext-${e.id}`, name: e.effective_cid_name || e.description || `Ext ${e.extension}`,
          number: e.extension, type: "internal" as const,
        })),
      ];
      return merged;
    },
  });

  // AI Insights — lightweight summary of today's activity from RPC
  const { data: summary, refetch: refetchSummary } = useQuery({
    queryKey: ["softphone-summary", user?.id],
    enabled: !!user && isMember,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_my_extension_summary");
      return (data || {}) as any;
    },
  });

  const relinkExtension = async () => {
    setRelinking(true);
    try {
      const { data, error } = await supabase.rpc("relink_my_softphone_user");
      if (error) throw error;
      const linked = (data as any)?.linked ?? 0;
      toast({
        title: linked > 0 ? "Extension synced" : "No matching extension found",
        description: linked > 0 ? `Linked ${linked} extension${linked === 1 ? "" : "s"}. Reloading…` : "Ask an admin to map your extension to this account.",
      });
      if (linked > 0) setTimeout(() => window.location.reload(), 800);
      else await refetchSummary();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e?.message || String(e), variant: "destructive" });
    } finally {
      setRelinking(false);
    }
  };

  if (!isMember) return null;

  const ext = sp.config?.extension || "—";
  const sipStatus = sp.snap.status;
  const callState = sp.snap.callState;
  const inCall = callState === "active" || callState === "held";

  const dialPress = (k: string) => {
    setNumber((n) => n + k);
    if (inCall) sp.sendDTMF(k);
  };

  const startCall = () => {
    if (!number) { setShake(true); setTimeout(() => setShake(false), 400); return; }
    sp.call(number);
  };

  const onPaste = async () => {
    try {
      const t = await navigator.clipboard.readText();
      setNumber(t.replace(/[^\d+*#]/g, ""));
    } catch {}
  };

  const callDuration = sp.snap.startedAt
    ? formatDuration(Date.now() - sp.snap.startedAt)
    : "00:00:00";

  // ===== Render =====

  const minimizedButton = (
    <button
      onClick={() => setExpanded(true)}
      className={cn(
        "relative w-14 h-14 rounded-full text-primary-foreground shadow-2xl flex items-center justify-center transition-transform hover:scale-110",
        "bg-gradient-to-br from-primary to-primary/70",
        inCall && "animate-pulse",
      )}
      aria-label={`AVA Softphone — Ext. ${ext}`}
      title={`AVA Softphone — Ext. ${ext}`}
    >
      <Phone className="w-6 h-6" />
      <span className={cn(
        "absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full ring-2 ring-background",
        statusDotClass(sipStatus),
      )} />
    </button>
  );

  const hasExtension = ext && ext !== "—";
  const sipLabel =
    sipStatus === "registered" ? "Registered"
    : sipStatus === "connecting" || sipStatus === "connected" ? "Connecting"
    : sipStatus === "error" ? "Error"
    : sipStatus === "disconnected" ? "Offline" : "Idle";

  const header = (
    <div className="px-3 py-2.5 border-b border-border/60 bg-gradient-to-b from-card to-card/80 backdrop-blur rounded-t-2xl space-y-2">
      <div className="flex items-center justify-between gap-2">
        {/* Left: extension + sip status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className={cn(
            "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ring-1",
            hasExtension ? "bg-primary/10 ring-primary/20 text-primary" : "bg-amber-500/10 ring-amber-500/30 text-amber-600",
          )}>
            <Phone className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-sm leading-tight">
                {hasExtension ? `Ext ${ext}` : "No extension"}
              </span>
              {sp.config?.mock && <Badge variant="outline" className="h-4 text-[9px] px-1">DEMO</Badge>}
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground leading-tight">
              <span className={cn("w-1.5 h-1.5 rounded-full", statusDotClass(sipStatus))} />
              <span>{sipLabel}</span>
            </div>
          </div>
        </div>

        {/* Right: availability + actions (single source of truth) */}
        <div className="flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="flex items-center gap-1.5 h-7 px-2 rounded-md border border-border/60 bg-background/60 hover:bg-muted text-[11px] font-medium transition"
                aria-label="Set availability"
              >
                <span className={cn("w-2 h-2 rounded-full", userStatusClass(sp.userStatus))} />
                <span className="capitalize">{sp.userStatus}</span>
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {(["available", "busy", "dnd", "away"] as UserStatus[]).map((s) => (
                <DropdownMenuItem key={s} onClick={() => sp.setStatus(s)}>
                  <span className={cn("w-2 h-2 rounded-full mr-2", userStatusClass(s))} />
                  <span className="capitalize">{s}</span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="ghost" size="icon" className="h-7 w-7" asChild title="Settings">
            <a href="/org/lemtel/telephony/settings"><Settings className="w-3.5 h-3.5" /></a>
          </Button>
          {variant === "floating" && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(false)} title="Minimize">
              <Minimize2 className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Extension not synced banner */}
      {!hasExtension && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-[11px] text-amber-700 dark:text-amber-300">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span className="flex-1">Your extension isn't linked yet.</span>
          <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" disabled={relinking} onClick={relinkExtension}>
            {relinking ? <RefreshCw className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
            Sync
          </Button>
        </div>
      )}
    </div>
  );

  const incomingOverlay = callState === "ringing-in" && (
    <div className="absolute inset-0 z-20 bg-background/95 backdrop-blur-md flex flex-col items-center justify-center p-6 rounded-2xl animate-in slide-in-from-top-4">
      <div className="relative mb-4">
        <span className="absolute inset-0 rounded-full bg-emerald-500/30 animate-ping" />
        <span className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" style={{ animationDelay: "0.5s" }} />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-white flex items-center justify-center text-2xl font-semibold">
          {initials(sp.snap.remoteIdentity || sp.snap.remoteNumber)}
        </div>
      </div>
      <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 mb-1">
        <PhoneIncoming className="w-3 h-3" /> Incoming Call
      </div>
      <div className="text-lg font-semibold mb-1">{sp.snap.remoteIdentity || "Unknown"}</div>
      <div className="text-sm text-muted-foreground mb-6">{sp.snap.remoteNumber}</div>
      <div className="grid grid-cols-2 gap-3 w-full">
        <Button onClick={() => sp.hangup()} variant="destructive" className="h-12">
          <PhoneOff className="w-5 h-5 mr-2" /> Decline
        </Button>
        <Button onClick={() => sp.answer()} className="h-12 bg-emerald-600 hover:bg-emerald-700">
          <Phone className="w-5 h-5 mr-2" /> Answer
        </Button>
      </div>
    </div>
  );

  const ringingOut = callState === "ringing-out" && (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-4">
      <div className="relative">
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 text-primary-foreground flex items-center justify-center text-2xl font-semibold">
          {initials(sp.snap.remoteIdentity || sp.snap.remoteNumber)}
        </div>
      </div>
      <div className="text-center">
        <div className="text-lg font-semibold">{sp.snap.remoteIdentity || sp.snap.remoteNumber}</div>
        <div className="text-sm text-muted-foreground animate-pulse">Calling…</div>
      </div>
      <Button onClick={() => sp.hangup()} variant="destructive" className="w-full h-12 mt-auto">
        <PhoneOff className="w-5 h-5 mr-2" /> End
      </Button>
    </div>
  );

  const activeView = inCall && (
    <div className="flex-1 flex flex-col p-4 gap-3">
      <div className="text-center">
        <div className="text-lg font-semibold truncate">{sp.snap.remoteIdentity || sp.snap.remoteNumber}</div>
        <div className="text-sm text-muted-foreground">{sp.snap.remoteNumber}</div>
        <div className="font-mono text-xl mt-2 tabular-nums">{callDuration}</div>
        {sp.snap.onHold && <Badge variant="outline" className="mt-1">On hold</Badge>}
      </div>

      {showDTMF && (
        <div className="bg-muted/40 rounded-lg p-2">
          <div className="grid grid-cols-3 gap-1.5">
            {DIALPAD.map(({ k }) => (
              <Button key={k} variant="outline" size="sm" onClick={() => sp.sendDTMF(k)} className="h-9 font-mono">{k}</Button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => setShowDTMF(false)}>
            <X className="w-3 h-3 mr-1" /> Close DTMF
          </Button>
        </div>
      )}

      {showTransfer && (
        <div className="bg-muted/40 rounded-lg p-2 space-y-2">
          <Input
            value={transferTarget}
            onChange={(e) => setTransferTarget(e.target.value)}
            placeholder="Extension or number"
            className="h-8 text-sm"
          />
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1 h-8" onClick={() => { sp.transfer(transferTarget); setShowTransfer(false); }}>Transfer</Button>
            <Button size="sm" variant="ghost" className="h-8" onClick={() => setShowTransfer(false)}>Cancel</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button variant={sp.snap.muted ? "default" : "outline"} className="h-11" onClick={() => sp.snap.muted ? sp.unmute() : sp.mute()}>
          {sp.snap.muted ? <MicOff className="w-4 h-4 mr-1.5" /> : <Mic className="w-4 h-4 mr-1.5" />}
          {sp.snap.muted ? "Unmute" : "Mute"}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => {}}>
          <Volume2 className="w-4 h-4 mr-1.5" /> Speaker
        </Button>
        <Button variant={sp.snap.onHold ? "default" : "outline"} className="h-11" onClick={() => sp.snap.onHold ? sp.unhold() : sp.hold()}>
          {sp.snap.onHold ? <Play className="w-4 h-4 mr-1.5" /> : <Pause className="w-4 h-4 mr-1.5" />}
          {sp.snap.onHold ? "Resume" : "Hold"}
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setShowDTMF((v) => !v)}>
          <Hash className="w-4 h-4 mr-1.5" /> DTMF
        </Button>
        <Button variant="outline" className="h-11" onClick={() => setShowTransfer((v) => !v)}>
          <ArrowRightLeft className="w-4 h-4 mr-1.5" /> Transfer
        </Button>
        <Button variant="outline" className="h-11" disabled>
          <Plus className="w-4 h-4 mr-1.5" /> Add Call
        </Button>
      </div>

      <Button onClick={() => sp.hangup()} variant="destructive" className="w-full h-12 mt-auto">
        <PhoneOff className="w-5 h-5 mr-2" /> End Call
      </Button>
    </div>
  );

  const endedView = callState === "ended" && (
    <div className="flex-1 flex flex-col items-center justify-center p-6 gap-3">
      <div className="text-muted-foreground text-sm">Call ended</div>
      <div className="font-mono text-2xl">{sp.snap.startedAt ? formatDuration(Date.now() - sp.snap.startedAt) : "00:00:00"}</div>
      {sp.snap.errorCause && <div className="text-xs text-rose-500">{sp.snap.errorCause}</div>}
      <Button variant="outline" size="sm" onClick={() => sp.call(sp.snap.remoteNumber)}>
        <Phone className="w-4 h-4 mr-1.5" /> Call back
      </Button>
    </div>
  );

  const dialTab = (
    <div className="flex-1 flex flex-col p-3 gap-3">
      {sipStatus !== "registered" && !sp.config?.mock && (
        <div className={cn(
          "rounded-md px-2.5 py-1.5 text-[11px] border",
          sipStatus === "error"
            ? "bg-destructive/10 border-destructive/40 text-destructive-foreground"
            : "bg-amber-500/10 border-amber-500/40 text-amber-100",
        )}>
          SIP: {sipStatus}{sp.snap.errorCause ? ` — ${sp.snap.errorCause}` : ""}
        </div>
      )}
      <div className={cn(
        "h-14 rounded-lg bg-muted/40 flex items-center justify-center font-mono text-2xl tabular-nums px-3 truncate",
        shake && "animate-[shake_0.4s]",
      )}>
        {number || <span className="text-muted-foreground/40 text-base">Enter number</span>}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {DIALPAD.map(({ k, sub }) => (
          <button
            key={k}
            onClick={() => dialPress(k)}
            className="h-12 rounded-lg bg-muted/40 hover:bg-muted active:scale-95 transition flex flex-col items-center justify-center"
          >
            <span className="text-lg font-medium leading-none">{k}</span>
            {sub && <span className="text-[9px] text-muted-foreground mt-0.5">{sub}</span>}
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => setNumber((n) => n.slice(0, -1))}>
          <Delete className="w-4 h-4" />
        </Button>
        <Button
          onClick={startCall}
          disabled={number.length < 3}
          title={sipStatus !== "registered" && !sp.config?.mock ? `SIP ${sipStatus} — call may fail` : undefined}
          className={cn(
            "flex-1 h-11",
            sipStatus === "registered" || sp.config?.mock
              ? "bg-emerald-600 hover:bg-emerald-700"
              : "bg-amber-600 hover:bg-amber-700",
          )}
        >
          <Phone className="w-4 h-4 mr-2" /> Call
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={onPaste}>
          <ClipboardPaste className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const recentsTab = (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {recents.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">No recent calls</div>
        ) : recents.map((c: any) => (
          <button
            key={c.id}
            onClick={() => { setNumber(c.direction === "outbound" ? c.destination_number : c.caller_number); setTab("dial"); }}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 text-left"
          >
            <span className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-white text-xs",
              c.direction === "outbound" ? "bg-blue-500" : c.duration_seconds > 0 ? "bg-emerald-500" : "bg-rose-500",
            )}>
              <Phone className="w-3 h-3" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{c.direction === "outbound" ? c.destination_number : c.caller_number}</div>
              <div className="text-[10px] text-muted-foreground">{new Date(c.start_at).toLocaleString()}</div>
            </div>
            <div className="text-xs text-muted-foreground">{c.duration_seconds || 0}s</div>
          </button>
        ))}
      </div>
    </ScrollArea>
  );

  const smsTab = (
    <div className="flex-1 flex items-center justify-center p-6 text-center">
      <div className="space-y-3">
        <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground" />
        <div className="text-sm text-muted-foreground">Open full messages view</div>
        <Button asChild size="sm" variant="outline">
          <a href="/org/lemtel/telephony/messages">Open SMS</a>
        </Button>
      </div>
    </div>
  );

  const contactsTab = (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-1">
        {contacts.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-10">No contacts</div>
        ) : contacts.slice(0, 50).map((c: any) => (
          <button
            key={c.id}
            onClick={() => { setNumber(c.number); setTab("dial"); }}
            className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted/60 text-left"
          >
            <span className="w-7 h-7 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center font-semibold">
              {initials(c.name)}
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-sm truncate">{c.name}</div>
              <div className="text-[10px] text-muted-foreground">{c.number}</div>
            </div>
            <Badge variant="outline" className="text-[9px] h-4">{c.type}</Badge>
          </button>
        ))}
      </div>
    </ScrollArea>
  );

  const tabBar = (
    <div className="h-12 border-t border-border grid grid-cols-4 bg-card/30">
      {([
        ["dial", Grid3x3, "Dial"],
        ["recents", Clock, "Recents"],
        ["sms", MessageSquare, "SMS"],
        ["contacts", Users, "Contacts"],
      ] as const).map(([id, Icon, label]) => (
        <button
          key={id}
          onClick={() => setTab(id as Tab)}
          className={cn(
            "flex flex-col items-center justify-center text-[10px] gap-0.5 border-t-2 border-transparent transition",
            tab === id ? "text-primary border-primary" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <Icon className="w-4 h-4" />
          {label}
        </button>
      ))}
    </div>
  );

  const footerBar = (
    <div className="h-8 px-3 border-t border-border flex items-center justify-between text-xs">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-1.5 hover:text-foreground text-muted-foreground">
          <span className={cn("w-2 h-2 rounded-full", userStatusClass(sp.userStatus))} />
          <span className="capitalize">{sp.userStatus}</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          {(["available", "busy", "dnd", "away"] as UserStatus[]).map((s) => (
            <DropdownMenuItem key={s} onClick={() => sp.setStatus(s)}>
              <span className={cn("w-2 h-2 rounded-full mr-2", userStatusClass(s))} />
              <span className="capitalize">{s}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
      {sp.config?.mock && <Badge variant="outline" className="text-[9px] h-4">MOCK</Badge>}
    </div>
  );

  const content = (
    <>
      {callState === "idle" && tab === "dial" && dialTab}
      {callState === "idle" && tab === "recents" && recentsTab}
      {callState === "idle" && tab === "sms" && smsTab}
      {callState === "idle" && tab === "contacts" && contactsTab}
      {ringingOut}
      {activeView}
      {endedView}
    </>
  );

  if (variant === "full") {
    return (
      <div className="relative h-[600px] max-w-[400px] mx-auto bg-card border border-border rounded-2xl shadow-xl flex flex-col overflow-hidden">
        <audio ref={audioRef} autoPlay />
        {header}
        {content}
        {(callState === "idle") && tabBar}
        <SoftphoneDiagnostics />
        {footerBar}
        {incomingOverlay}
      </div>
    );
  }

  return (
    <>
      <audio ref={audioRef} autoPlay />
      <style>{`@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-6px)} 75%{transform:translateX(6px)} }`}</style>
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
        {expanded && (
          <div className="relative w-[340px] h-[520px] bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-2">
            {header}
            {content}
            {(callState === "idle") && tabBar}
            <SoftphoneDiagnostics />
            {footerBar}
            {incomingOverlay}
          </div>
        )}
        {!expanded && minimizedButton}
      </div>
    </>
  );
}

export default SoftphoneWidget;
