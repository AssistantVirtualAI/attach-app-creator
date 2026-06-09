import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";

interface Props {
  voiceAgentId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export default function AssignClientDialog({ voiceAgentId, open, onOpenChange }: Props) {
  const { selectedOrgId } = useOrganization();
  const [vaClients, setVaClients] = useState<{ id: string; name: string }[]>([]);
  const [phoneClients, setPhoneClients] = useState<{ id: string; name: string }[]>([]);
  const [assigned, setAssigned] = useState<{ client_id: string | null; phone_client_id: string | null }[]>([]);

  const load = async () => {
    if (!selectedOrgId) return;
    const [va, ph, asg] = await Promise.all([
      supabase.from("voice_agent_clients").select("id,name").eq("organization_id", selectedOrgId),
      supabase.from("clients").select("id,name").eq("organization_id", selectedOrgId),
      supabase.from("voice_agent_assignments").select("client_id,phone_client_id").eq("voice_agent_id", voiceAgentId),
    ]);
    setVaClients((va.data ?? []) as any);
    setPhoneClients((ph.data ?? []) as any);
    setAssigned((asg.data ?? []) as any);
  };
  useEffect(() => { if (open) load(); /* eslint-disable-next-line */ }, [open, voiceAgentId, selectedOrgId]);

  const isAssigned = (id: string, kind: "va" | "phone") =>
    assigned.some((a) => (kind === "va" ? a.client_id === id : a.phone_client_id === id));

  const toggle = async (id: string, kind: "va" | "phone") => {
    if (!selectedOrgId) return;
    if (isAssigned(id, kind)) {
      await supabase.from("voice_agent_assignments").delete()
        .eq("voice_agent_id", voiceAgentId)
        .eq(kind === "va" ? "client_id" : "phone_client_id", id);
    } else {
      const { error } = await supabase.from("voice_agent_assignments").insert({
        voice_agent_id: voiceAgentId,
        organization_id: selectedOrgId,
        source: kind === "va" ? "agents" : "pbx_softphone_users",
        client_id: kind === "va" ? id : null,
        phone_client_id: kind === "phone" ? id : null,
      });
      if (error) {
        toast({ title: "Failed", description: error.message, variant: "destructive" });
        return;
      }
    }
    load();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Assign clients to voice agent</DialogTitle></DialogHeader>
        <Tabs defaultValue="va">
          <TabsList className="grid grid-cols-2">
            <TabsTrigger value="va">Voice-agent clients</TabsTrigger>
            <TabsTrigger value="phone">Phone clients</TabsTrigger>
          </TabsList>
          <TabsContent value="va" className="space-y-2 max-h-80 overflow-auto">
            {vaClients.length === 0 && <p className="text-sm text-muted-foreground">No voice-agent clients yet.</p>}
            {vaClients.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded p-2">
                <span>{c.name}</span>
                <Button size="sm" variant={isAssigned(c.id, "va") ? "default" : "outline"}
                  onClick={() => toggle(c.id, "va")}>
                  {isAssigned(c.id, "va") ? "Assigned" : "Assign"}
                </Button>
              </div>
            ))}
          </TabsContent>
          <TabsContent value="phone" className="space-y-2 max-h-80 overflow-auto">
            {phoneClients.length === 0 && <p className="text-sm text-muted-foreground">No phone clients.</p>}
            {phoneClients.map((c) => (
              <div key={c.id} className="flex items-center justify-between border rounded p-2">
                <span>{c.name}</span>
                <Button size="sm" variant={isAssigned(c.id, "phone") ? "default" : "outline"}
                  onClick={() => toggle(c.id, "phone")}>
                  {isAssigned(c.id, "phone") ? "Assigned" : "Assign"}
                </Button>
              </div>
            ))}
          </TabsContent>
        </Tabs>
        <DialogFooter><Button onClick={() => onOpenChange(false)}>Done</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
