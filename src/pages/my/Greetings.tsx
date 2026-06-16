import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PlayCircle, Wand2, Trash2, CheckCircle2, Library, Plus } from "lucide-react";
import { useGreetingsLibrary } from "@/hooks/useGreetingsLibrary";
import { toast } from "sonner";
import { format } from "date-fns";

export default function MyGreetings() {
  const { query, create, remove, activate } = useGreetingsLibrary();
  const greetings = query.data?.greetings ?? [];
  const extensions = query.data?.extensions ?? [];
  const voices = query.data?.voices ?? [];

  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [voiceId, setVoiceId] = useState("EXAVITQu4vr4xnSDxMaL");
  const [extension, setExtension] = useState<string>("__all__");

  const handleCreate = () => {
    if (!text.trim()) return toast.error("Enter greeting text");
    create.mutate(
      {
        name: name.trim() || `Greeting ${greetings.length + 1}`,
        text: text.trim(),
        voice_id: voiceId,
        extension: extension === "__all__" ? null : extension,
      },
      {
        onSuccess: () => {
          toast.success("Greeting generated");
          setName(""); setText("");
        },
        onError: (e: any) => toast.error(e?.message ?? "Failed"),
      }
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Library className="h-6 w-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">Voicemail Greetings</h1>
          <p className="text-sm text-muted-foreground">
            Generate, preview, and switch between ElevenLabs greetings for your extensions.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4" /> New AI greeting
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Business hours, After hours…" />
            </div>
            <div>
              <Label>Apply to extension</Label>
              <Select value={extension} onValueChange={setExtension}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All my lines</SelectItem>
                  {extensions.map((e) => (
                    <SelectItem key={e.extension} value={e.extension}>
                      Ext {e.extension}{e.display_name ? ` — ${e.display_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Voice</Label>
              <Select value={voiceId} onValueChange={setVoiceId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {voices.map((v) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Script</Label>
              <Textarea rows={5} value={text} onChange={(e) => setText(e.target.value)}
                placeholder="Hi, you've reached… please leave a message after the tone." />
            </div>
            <Button onClick={handleCreate} disabled={create.isPending} className="w-full">
              <Wand2 className="h-4 w-4 mr-2" />
              {create.isPending ? "Generating…" : "Generate & Save"}
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PlayCircle className="h-4 w-4" />
              My greetings
              <Badge variant="secondary" className="ml-2">{greetings.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {query.isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
            {!query.isLoading && greetings.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">No greetings yet. Generate your first one.</p>
            )}
            {greetings.map((g) => (
              <div key={g.id} className={`rounded-lg border p-3 space-y-2 ${g.is_active ? "border-primary bg-primary/5" : ""}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium">{g.name}</span>
                      {g.is_active && <Badge className="bg-primary/15 text-primary">Active</Badge>}
                      <Badge variant="outline" className="text-xs">
                        {g.extension ? `Ext ${g.extension}` : "All lines"}
                      </Badge>
                      {g.voice_name && <Badge variant="outline" className="text-xs">{g.voice_name}</Badge>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(g.created_at), "PPp")}
                    </div>
                    {g.text_script && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{g.text_script}</p>
                    )}
                  </div>
                </div>
                {g.audio_url && <audio controls src={g.audio_url} className="w-full h-9" />}
                <div className="flex gap-2 flex-wrap">
                  {!g.is_active && (
                    <Button size="sm" onClick={() => activate.mutate(g.id, {
                      onSuccess: () => toast.success("Activated"),
                      onError: (e: any) => toast.error(e?.message),
                    })}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Set active
                    </Button>
                  )}
                  <Button size="sm" variant="destructive" onClick={() => {
                    if (confirm("Delete this greeting?")) remove.mutate(g.id, {
                      onSuccess: () => toast.success("Deleted"),
                    });
                  }}>
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
