import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Palette, Phone, Users, CreditCard, Save, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { InviteUserDialog } from "@/components/portal/InviteUserDialog";

export default function CustomerSettings() {
  const { slug } = useParams();
  const qc = useQueryClient();

  const { data: org } = useQuery({
    queryKey: ["org-full", slug],
    queryFn: async () => {
      const { data } = await supabase.from("organizations").select("*").eq("slug", slug!).maybeSingle();
      return data as any;
    },
    enabled: !!slug,
  });

  const [brandName, setBrandName] = useState("");
  const [brandLogo, setBrandLogo] = useState("");
  const [brandColor, setBrandColor] = useState("#0023e6");
  const [supportEmail, setSupportEmail] = useState("");

  useEffect(() => {
    if (org) {
      setBrandName(org.brand_name || org.name || "");
      setBrandLogo(org.brand_logo_url || "");
      setBrandColor(org.brand_primary_color || "#0023e6");
      setSupportEmail(org.support_email || "");
    }
  }, [org]);

  const saveBrand = async () => {
    if (!org?.id) return;
    const { error } = await supabase.from("organizations").update({
      brand_name: brandName, brand_logo_url: brandLogo,
      brand_primary_color: brandColor, support_email: supportEmail,
    }).eq("id", org.id);
    if (error) return toast.error(error.message);
    toast.success("Branding saved");
    qc.invalidateQueries({ queryKey: ["org-full", slug] });
  };

  const { data: members = [] } = useQuery({
    queryKey: ["org-members-list", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("org_members").select("*").eq("org_id", org.id);
      return (data || []) as any[];
    },
  });

  const { data: dids = [] } = useQuery({
    queryKey: ["org-dids", org?.id],
    enabled: !!org?.id,
    queryFn: async () => {
      const { data } = await (supabase as any).from("pbx_dids").select("*").eq("organization_id", org.id);
      return (data || []) as any[];
    },
  });

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-3xl font-bold">{org?.name || "Settings"}</h1>
      <Tabs defaultValue="branding">
        <TabsList>
          <TabsTrigger value="branding"><Palette className="h-4 w-4 mr-1" />Branding</TabsTrigger>
          <TabsTrigger value="numbers"><Phone className="h-4 w-4 mr-1" />Numbers</TabsTrigger>
          <TabsTrigger value="users"><Users className="h-4 w-4 mr-1" />Users</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-4 w-4 mr-1" />Billing</TabsTrigger>
        </TabsList>

        <TabsContent value="branding">
          <Card>
            <CardHeader><CardTitle>White-label branding</CardTitle></CardHeader>
            <CardContent className="space-y-4 max-w-xl">
              <div><Label>Brand name</Label><Input value={brandName} onChange={(e) => setBrandName(e.target.value)} /></div>
              <div><Label>Logo URL</Label><Input value={brandLogo} onChange={(e) => setBrandLogo(e.target.value)} placeholder="https://…" /></div>
              <div><Label>Primary color</Label>
                <div className="flex gap-2">
                  <Input type="color" className="w-20" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                  <Input value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
                </div>
              </div>
              <div><Label>Support email</Label><Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
              <Button onClick={saveBrand}><Save className="h-4 w-4 mr-2" />Save branding</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="numbers">
          <Card>
            <CardHeader><CardTitle>Phone numbers ({dids.length})</CardTitle></CardHeader>
            <CardContent>
              {dids.length === 0 ? (
                <p className="text-sm text-muted-foreground">No numbers assigned yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b"><tr className="text-left"><th className="p-2">DID</th><th className="p-2">Type</th><th className="p-2">Status</th></tr></thead>
                  <tbody>
                    {dids.map((d: any) => (
                      <tr key={d.id} className="border-b">
                        <td className="p-2 font-mono">{d.did_number || d.number}</td>
                        <td className="p-2">{d.did_type || "—"}</td>
                        <td className="p-2"><Badge variant={d.enabled ? "default" : "secondary"}>{d.enabled ? "active" : "disabled"}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card>
            <CardHeader><CardTitle>Team members ({members.length})</CardTitle></CardHeader>
            <CardContent>
              {members.length === 0 ? (
                <p className="text-sm text-muted-foreground">No members yet. Use the user provisioning flow to add one.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b"><tr className="text-left"><th className="p-2">User</th><th className="p-2">Role</th></tr></thead>
                  <tbody>
                    {members.map((m: any) => (
                      <tr key={m.id} className="border-b">
                        <td className="p-2 font-mono text-xs">{m.user_id?.slice(0, 12)}</td>
                        <td className="p-2"><Badge variant="outline">{m.role}</Badge></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <Card>
            <CardHeader><CardTitle>Plan & billing</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Plan</span><span className="font-medium capitalize">{org?.billing_plan || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge>{org?.status || "—"}</Badge></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max extensions</span><span>{org?.max_extensions || "—"}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Max DIDs</span><span>{org?.max_dids || "—"}</span></div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
