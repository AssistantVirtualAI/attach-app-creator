import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ExtensionEditModal } from "@/components/extensions/ExtensionEditModal";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Phone, Settings2 } from "lucide-react";

export default function MyExtension() {
  const [loading, setLoading] = useState(true);
  const [extension, setExtension] = useState<any>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [dndSaving, setDndSaving] = useState(false);
  const [fwdDest, setFwdDest] = useState("");

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data: spu } = await supabase
      .from("pbx_softphone_users")
      .select("extension, organization_id")
      .eq("portal_user_id", user.id)
      .maybeSingle();
    if (!spu) { setLoading(false); return; }
    const { data: ext } = await supabase
      .from("pbx_extensions")
      .select("*")
      .eq("organization_id", spu.organization_id)
      .eq("extension", spu.extension)
      .maybeSingle();
    setExtension(ext);
    setFwdDest(ext?.forward_all_destination || "");
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!extension?.id) return;
    const ch = supabase
      .channel(`ext-${extension.id}`)
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "pbx_extensions",
        filter: `id=eq.${extension.id}`,
      }, (payload) => setExtension(payload.new))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [extension?.id]);

  async function quickSync(patch: Record<string, any>) {
    if (!extension?.pbx_uuid) { toast.error("Extension not synced yet"); return; }
    setDndSaving(true);
    try {
      const merged = { ...extension, ...patch };
      const payload = {
        extension_uuid: merged.pbx_uuid,
        extension: String(merged.extension),
        do_not_disturb: !!merged.do_not_disturb,
        forward_all_enabled: !!merged.forward_all_enabled,
        forward_all_destination: merged.forward_all_destination || "",
        effective_caller_id_name: merged.effective_cid_name,
        effective_caller_id_number: merged.effective_cid_number,
        enabled: merged.enabled ?? true,
      };
      const { data, error } = await supabase.functions.invoke("fusionpbx-proxy", {
        body: { action: "update-extension", data: { extensions: [payload] } },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.details?.message || error?.message || "Sync failed");
      setExtension(merged);
      toast.success("Synced to FusionPBX");
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDndSaving(false);
    }
  }

  if (loading) {
    return <div className="p-8 flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading your extension…</div>;
  }
  if (!extension) {
    return (
      <div className="p-8">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">No extension assigned</h2>
          <p className="text-sm text-muted-foreground">Ask your administrator to link an extension to your account.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Phone className="h-5 w-5" /> My Extension — Ext {extension.extension}</h1>
          <p className="text-xs text-muted-foreground">
            Last synced: {extension.synced_at ? new Date(extension.synced_at).toLocaleString() : "—"}
          </p>
        </div>
        <Badge variant={extension.enabled ? "default" : "secondary"}>{extension.enabled ? "Active" : "Disabled"}</Badge>
      </div>

      <Card className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <Label className="text-base">⛔ Do Not Disturb</Label>
            <p className="text-xs text-muted-foreground">All calls go to voicemail</p>
          </div>
          <Switch
            checked={!!extension.do_not_disturb}
            disabled={dndSaving}
            onCheckedChange={(v) => quickSync({ do_not_disturb: v })}
          />
        </div>

        <div className="border-t pt-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-base">↗️ Forward all calls</Label>
            <Switch
              checked={!!extension.forward_all_enabled}
              disabled={dndSaving}
              onCheckedChange={(v) => quickSync({ forward_all_enabled: v, forward_all_destination: fwdDest })}
            />
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="5141234567 or ext 222"
              value={fwdDest}
              onChange={(e) => setFwdDest(e.target.value)}
              disabled={!extension.forward_all_enabled}
            />
            <Button
              variant="outline"
              disabled={!extension.forward_all_enabled || dndSaving}
              onClick={() => quickSync({ forward_all_destination: fwdDest, forward_all_enabled: true })}
            >
              Update
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <Button onClick={() => setModalOpen(true)} className="w-full">
          <Settings2 className="h-4 w-4 mr-2" /> Edit full extension settings
        </Button>
      </Card>

      <ExtensionEditModal
        extension={extension}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => load()}
        userRole="user"
      />
    </div>
  );
}
