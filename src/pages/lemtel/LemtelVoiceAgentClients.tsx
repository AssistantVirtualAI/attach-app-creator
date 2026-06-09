import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface VAClient {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  company: string | null;
  notes: string | null;
  status: string;
}

export default function LemtelVoiceAgentClients() {
  const { selectedOrgId } = useOrganization();
  const [clients, setClients] = useState<VAClient[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", contact_email: "", contact_phone: "", company: "", notes: "" });

  const load = async () => {
    if (!selectedOrgId) return;
    const { data } = await supabase.from("voice_agent_clients").select("*")
      .eq("organization_id", selectedOrgId).order("created_at", { ascending: false });
    setClients((data ?? []) as VAClient[]);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [selectedOrgId]);

  const submit = async () => {
    if (!form.name.trim() || !selectedOrgId) return;
    const { error } = await supabase.from("voice_agent_clients").insert({
      organization_id: selectedOrgId, ...form,
    });
    if (error) {
      toast({ title: "Failed", description: error.message, variant: "destructive" });
      return;
    }
    setOpen(false);
    setForm({ name: "", contact_email: "", contact_phone: "", company: "", notes: "" });
    toast({ title: "Client created" });
    load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this client?")) return;
    await supabase.from("voice_agent_clients").delete().eq("id", id);
    load();
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Users className="h-6 w-6" /> Voice Agent Clients
          </h1>
          <p className="text-sm text-muted-foreground">Clients assignable to AI voice agents (separate from phone clients).</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-2" /> New client</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New voice-agent client</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <Input placeholder="Company" value={form.company} onChange={(e) => setForm({ ...form, company: e.target.value })} />
              <Input placeholder="Email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
              <Input placeholder="Phone" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
              <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button onClick={submit}>Create</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader><CardTitle>{clients.length} client(s)</CardTitle></CardHeader>
        <CardContent>
          {clients.length === 0 && <p className="text-sm text-muted-foreground">No voice-agent clients yet.</p>}
          <div className="space-y-2">
            {clients.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded-md p-3">
                <div>
                  <div className="font-medium">{c.name} <Badge variant="outline" className="ml-2">{c.status}</Badge></div>
                  <div className="text-xs text-muted-foreground">
                    {[c.company, c.contact_email, c.contact_phone].filter(Boolean).join(" · ")}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => remove(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
