import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Hash, Lock, Plus, Send, Paperclip, Smile, Trash2, MessageSquare } from "lucide-react";
import { ThreadPanel } from "@/components/chat/ThreadPanel";
import { ChatSearchBar } from "@/components/chat/ChatSearchBar";
import { useChannels, useChatMessages, type Channel } from "@/hooks/useOrgChat";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

const EMOJIS = ["👍", "❤️", "😂", "🎉", "🚀", "👀"];

export default function OrgChat() {
  const { language } = useLanguage();
  const lang: "en" | "fr" = language === "fr" ? "fr" : "en";
  const t = (en: string, fr: string) => (lang === "fr" ? fr : en);
  const { user } = useAuth();

  const { query: channelsQ, create } = useChannels();
  const channels = channelsQ.data?.channels ?? [];
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = channels.find((c) => c.id === activeId) || null;

  useEffect(() => {
    if (!activeId && channels.length) setActiveId(channels[0].id);
  }, [channels, activeId]);

  return (
    <div className="h-[calc(100vh-4rem)] flex">
      <Sidebar
        channels={channels}
        activeId={activeId}
        onSelect={setActiveId}
        loading={channelsQ.isLoading}
        onCreate={async (name, type) => {
          const r = await create.mutateAsync({ name, channel_type: type });
          if (r?.channel?.id) {
            setActiveId(r.channel.id);
            toast.success(t("Channel created", "Canal créé"));
          }
        }}
        t={t}
      />
      <div className="flex-1 flex flex-col bg-background min-w-0">
        {active ? (
          <ChannelView channel={active} userId={user?.id ?? ""} t={t} />
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            {channelsQ.isLoading ? <Skeleton className="h-6 w-32" /> : t("Select a channel", "Sélectionnez un canal")}
          </div>
        )}
      </div>
    </div>
  );
}

function Sidebar({
  channels, activeId, onSelect, loading, onCreate, t,
}: {
  channels: Channel[]; activeId: string | null; onSelect: (id: string) => void;
  loading: boolean; onCreate: (name: string, type: "public" | "private") => Promise<void>;
  t: (en: string, fr: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"public" | "private">("public");
  return (
    <aside className="w-60 border-r bg-muted/30 flex flex-col">
      <div className="p-3 border-b flex items-center justify-between">
        <h2 className="text-sm font-semibold">{t("Channels", "Canaux")}</h2>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7"><Plus className="h-4 w-4" /></Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("Create channel", "Créer un canal")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>{t("Name", "Nom")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="general" />
              </div>
              <div>
                <Label>{t("Type", "Type")}</Label>
                <Select value={type} onValueChange={(v: any) => setType(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">{t("Public", "Public")}</SelectItem>
                    <SelectItem value="private">{t("Private", "Privé")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={async () => { await onCreate(name, type); setOpen(false); setName(""); }} disabled={!name.trim()}>
                {t("Create", "Créer")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {loading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-7 w-full" />)}
          {channels.map((c) => (
            <button
              key={c.id}
              onClick={() => onSelect(c.id)}
              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-accent text-left ${
                c.id === activeId ? "bg-accent font-medium" : ""
              }`}
            >
              {c.channel_type === "private" ? <Lock className="h-3.5 w-3.5" /> : <Hash className="h-3.5 w-3.5" />}
              <span className="truncate">{c.name}</span>
            </button>
          ))}
        </div>
      </ScrollArea>
    </aside>
  );
}

function ChannelView({ channel, userId, t }: { channel: Channel; userId: string; t: (en: string, fr: string) => string }) {
  const { messages, send, remove, react, uploadAttachment, getSignedUrl, query } = useChatMessages(channel.id);
  const [draft, setDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [threadParent, setThreadParent] = useState<any | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
    });
  }, [messages.length]);

  const handleSend = async () => {
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    try { await send.mutateAsync({ content }); }
    catch (e: any) { toast.error(e?.message); }
  };

  const handleFile = async (file: File) => {
    if (file.size > 25 * 1024 * 1024) return toast.error(t("Max 25MB", "Max 25 Mo"));
    setUploading(true);
    try {
      const att = await uploadAttachment(file);
      await send.mutateAsync({ content: "", attachments: [att] });
    } catch (e: any) { toast.error(e?.message); }
    finally { setUploading(false); }
  };

  return (
    <>
      <div className="border-b px-4 py-2 flex items-center gap-2">
        {channel.channel_type === "private" ? <Lock className="h-4 w-4" /> : <Hash className="h-4 w-4" />}
        <h2 className="font-semibold">{channel.name}</h2>
        {channel.description && <span className="text-sm text-muted-foreground">— {channel.description}</span>}
        <Badge variant="outline" className="ml-auto text-xs">{channel.members?.length ?? 0} {t("members", "membres")}</Badge>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {query.isLoading && <Skeleton className="h-20 w-full" />}
        {!query.isLoading && messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-12">
            {t("No messages yet. Say hi 👋", "Aucun message. Lance la discussion 👋")}
          </div>
        )}
        {messages.map((m) => (
          <MessageBubble
            key={m.id}
            msg={m}
            isOwn={m.sender_id === userId}
            onDelete={() => remove.mutate(m.id)}
            onReact={(emoji) => react.mutate({ id: m.id, emoji })}
            getSignedUrl={getSignedUrl}
            t={t}
          />
        ))}
      </div>

      <div className="border-t p-3 flex items-end gap-2">
        <Button
          size="icon" variant="ghost" disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" />
        </Button>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder={t(`Message #${channel.name}`, `Message #${channel.name}`)}
        />
        <Button onClick={handleSend} disabled={!draft.trim() || send.isPending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </>
  );
}

function MessageBubble({
  msg, isOwn, onDelete, onReact, getSignedUrl, t,
}: {
  msg: any; isOwn: boolean;
  onDelete: () => void; onReact: (emoji: string) => void;
  getSignedUrl: (p: string) => Promise<string>;
  t: (en: string, fr: string) => string;
}) {
  const [showEmoji, setShowEmoji] = useState(false);
  const [urls, setUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    (msg.attachments ?? []).forEach(async (a: any) => {
      if (!urls[a.path]) {
        try { const u = await getSignedUrl(a.path); setUrls((p) => ({ ...p, [a.path]: u })); } catch {}
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [msg.id]);

  if (msg.message_type === "deleted") {
    return <div className="text-xs italic text-muted-foreground">— {t("message deleted", "message supprimé")}</div>;
  }

  return (
    <div className="group flex gap-3">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold shrink-0">
        {(msg.sender_name ?? "?").slice(0, 1).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-medium text-sm">{msg.sender_name}</span>
          <span className="text-[11px] text-muted-foreground">
            {format(new Date(msg.created_at), "p")}
            {msg.edited_at && <em className="ml-1">({t("edited", "modifié")})</em>}
          </span>
          <div className="ml-auto opacity-0 group-hover:opacity-100 flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setShowEmoji((s) => !s)}>
              <Smile className="h-3 w-3" />
            </Button>
            {isOwn && (
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={onDelete}>
                <Trash2 className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>
        {msg.content && <div className="text-sm whitespace-pre-wrap break-words">{msg.content}</div>}
        {(msg.attachments ?? []).map((a: any) => (
          <div key={a.path} className="mt-1">
            {a.mime?.startsWith("image/") && urls[a.path] ? (
              <img src={urls[a.path]} alt={a.name} className="max-h-64 rounded border" />
            ) : (
              <a href={urls[a.path]} target="_blank" rel="noreferrer" className="text-xs underline text-primary">
                📎 {a.name}
              </a>
            )}
          </div>
        ))}
        {msg.reactions && Object.keys(msg.reactions).length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {Object.entries(msg.reactions as Record<string, string[]>).map(([e, users]) => (
              <button
                key={e}
                onClick={() => onReact(e)}
                className="text-xs bg-accent rounded-full px-2 py-0.5 hover:bg-accent/80"
              >
                {e} {users.length}
              </button>
            ))}
          </div>
        )}
        {showEmoji && (
          <div className="flex gap-1 mt-1">
            {EMOJIS.map((e) => (
              <button key={e} className="hover:scale-110 transition" onClick={() => { onReact(e); setShowEmoji(false); }}>
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
