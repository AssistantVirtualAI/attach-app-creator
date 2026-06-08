import { useState, useEffect, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Eye, EyeOff, RefreshCw, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type UserRole = "master_admin" | "customer_admin" | "user";

interface Props {
  extension: any;
  open: boolean;
  onClose: () => void;
  onSaved?: (updated: any) => void;
  userRole?: UserRole;
  organizationId?: string;
}

const LEMTEL_ORG = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

function genPassword(len = 14) {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  return Array.from(crypto.getRandomValues(new Uint32Array(len)))
    .map((n) => chars[n % chars.length])
    .join("");
}
function genPin(len = 6) {
  return Array.from(crypto.getRandomValues(new Uint32Array(len)))
    .map((n) => String(n % 10))
    .join("");
}

export function ExtensionEditModal({
  extension,
  open,
  onClose,
  onSaved,
  userRole = "customer_admin",
  organizationId = LEMTEL_ORG,
}: Props) {
  const [form, setForm] = useState<any>(extension || {});
  const [saving, setSaving] = useState(false);
  const [showPw, setShowPw] = useState(false);

  useEffect(() => {
    if (extension) setForm({ ...extension });
  }, [extension]);

  const isUser = userRole === "user";
  const set = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const payload = useMemo(() => ({
    extension_uuid: form.pbx_uuid,
    domain_uuid: "2936594e-17b7-42a9-9165-95be48627923",
    extension: String(form.extension ?? ""),
    password: form.password,
    effective_caller_id_name: form.effective_cid_name,
    effective_caller_id_number: form.effective_cid_number,
    outbound_caller_id_name: form.outbound_cid_name,
    outbound_caller_id_number: form.outbound_cid_number,
    emergency_caller_id_name: form.emergency_cid_name,
    emergency_caller_id_number: form.emergency_cid_number,
    directory_first_name: form.directory_first_name,
    directory_last_name: form.directory_last_name,
    directory_visible: !!form.directory_visible,
    directory_exten_visible: !!form.directory_exten_visible,
    call_timeout: form.call_timeout ?? 30,
    call_group: form.call_group || "",
    call_screen_enabled: !!form.call_screen,
    hold_music: form.hold_music || "default",
    extension_language: form.extension_language || "fr-ca",
    extension_dialect: form.extension_dialect || "june",
    extension_voice: form.extension_voice || null,
    extension_type: form.extension_type || "default",
    enabled: !!form.enabled,
    accountcode: form.accountcode || "lemtel.lemtel.tel",
    description: form.description,
    limit_max: String(form.limit_max ?? "5"),
    limit_destination: form.limit_destination || "!USER_BUSY",
    max_registrations: form.max_registrations || null,
    voicemail_enabled: !!form.voicemail_enabled,
    voicemail_mail_to: form.voicemail_mail_to || "",
    do_not_disturb: !!form.do_not_disturb,
    forward_all_enabled: !!form.forward_all_enabled,
    forward_all_destination: form.forward_all_destination || "",
    forward_busy_enabled: !!form.forward_busy_enabled,
    forward_busy_destination: form.forward_busy_destination || "",
    forward_no_answer_enabled: !!form.forward_no_answer_enabled,
    forward_no_answer_destination: form.forward_no_answer_destination || "",
    forward_user_not_registered_enabled: !!form.forward_user_not_registered_enabled,
    forward_user_not_registered_destination: form.forward_user_not_registered_destination || "",
    user_record: form.user_record || "none",
    absolute_codec_string: form.absolute_codec_string || null,
    sip_bypass_media: form.sip_bypass_media || null,
    force_ping: !!form.force_ping,
    sip_force_contact: form.sip_force_contact || null,
    sip_force_expires: form.sip_force_expires || null,
    cidr: form.cidr || null,
    auth_acl: form.auth_acl || null,
    toll_allow: form.toll_allow || null,
    missed_call_app: form.missed_call_app || null,
    missed_call_data: form.missed_call_data || null,
    user_context: "lemtel.lemtel.tel",
  }), [form]);

  async function handleSave() {
    if (!form.pbx_uuid) {
      toast.error("Missing FusionPBX extension UUID — sync first.");
      return;
    }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("fusionpbx-proxy", {
        body: {
          action: "update-extension",
          data: { extensions: [payload] },
          organization_id: organizationId,
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).details?.message || (data as any).error);
      toast.success(`Extension ${form.extension} synced to FusionPBX`);
      onSaved?.(form);
      onClose();
    } catch (e: any) {
      toast.error(`Save failed: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            Edit Extension {form.extension} {form.description ? `· ${form.description}` : ""}
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <TabsList className="grid grid-cols-6 w-full">
            <TabsTrigger value="general">📞 General</TabsTrigger>
            <TabsTrigger value="voicemail">📬 Voicemail</TabsTrigger>
            <TabsTrigger value="forwarding">↗️ Forward</TabsTrigger>
            <TabsTrigger value="devices" disabled={isUser}>📱 Devices</TabsTrigger>
            <TabsTrigger value="advanced" disabled={isUser}>⚙️ Advanced</TabsTrigger>
            <TabsTrigger value="security" disabled={isUser}>🔐 Security</TabsTrigger>
          </TabsList>

          {/* GENERAL */}
          <TabsContent value="general" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Identity</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Extension *</Label>
                  <Input value={form.extension || ""} onChange={(e) => set("extension", e.target.value)} disabled={isUser} maxLength={15} />
                </div>
                <div>
                  <Label>Description</Label>
                  <Input value={form.description || ""} onChange={(e) => set("description", e.target.value)} />
                </div>
              </div>
              <div>
                <Label>SIP Password *</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showPw ? "text" : "password"}
                      value={form.password || ""}
                      onChange={(e) => set("password", e.target.value)}
                    />
                    <Button
                      type="button" size="icon" variant="ghost"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={() => setShowPw((s) => !s)}
                    >
                      {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                  <Button type="button" variant="outline" onClick={() => set("password", genPassword())}>
                    <RefreshCw className="h-4 w-4 mr-1" /> Generate
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Caller ID</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Effective CID Name *</Label>
                  <Input value={form.effective_cid_name || ""} onChange={(e) => set("effective_cid_name", e.target.value)} />
                </div>
                <div>
                  <Label>Effective CID Number</Label>
                  <Input value={form.effective_cid_number || ""} onChange={(e) => set("effective_cid_number", e.target.value)} disabled={isUser} />
                </div>
                <div>
                  <Label>Outbound CID Name</Label>
                  <Input value={form.outbound_cid_name || ""} onChange={(e) => set("outbound_cid_name", e.target.value)} />
                </div>
                <div>
                  <Label>Outbound CID Number</Label>
                  <Input value={form.outbound_cid_number || ""} onChange={(e) => set("outbound_cid_number", e.target.value)} disabled={isUser} />
                </div>
                <div>
                  <Label>Emergency CID Name</Label>
                  <Input value={form.emergency_cid_name || ""} onChange={(e) => set("emergency_cid_name", e.target.value)} disabled={isUser} />
                </div>
                <div>
                  <Label>Emergency CID Number</Label>
                  <Input value={form.emergency_cid_number || ""} onChange={(e) => set("emergency_cid_number", e.target.value)} disabled={isUser} />
                </div>
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Directory</h3>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>First name</Label><Input value={form.directory_first_name || ""} onChange={(e) => set("directory_first_name", e.target.value)} /></div>
                <div><Label>Last name</Label><Input value={form.directory_last_name || ""} onChange={(e) => set("directory_last_name", e.target.value)} /></div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Visible in directory</Label>
                <Switch checked={!!form.directory_visible} onCheckedChange={(v) => set("directory_visible", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Announce extension</Label>
                <Switch checked={!!form.directory_exten_visible} onCheckedChange={(v) => set("directory_exten_visible", v)} />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Call settings</h3>
              <div>
                <Label>Call timeout: {form.call_timeout ?? 30}s</Label>
                <Slider min={10} max={120} step={1} value={[form.call_timeout ?? 30]} onValueChange={([v]) => set("call_timeout", v)} />
              </div>
              <div><Label>Call group</Label><Input value={form.call_group || ""} onChange={(e) => set("call_group", e.target.value)} placeholder="sales, support, billing" /></div>
              <div className="flex items-center justify-between">
                <Label>Call screening</Label>
                <Switch checked={!!form.call_screen} onCheckedChange={(v) => set("call_screen", v)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Hold music</Label>
                  <Input value={form.hold_music || "default"} onChange={(e) => set("hold_music", e.target.value)} />
                </div>
                <div>
                  <Label>Language</Label>
                  <Select value={form.extension_language || "fr-ca"} onValueChange={(v) => set("extension_language", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fr-ca">Français (CA)</SelectItem>
                      <SelectItem value="en-us">English (US)</SelectItem>
                      <SelectItem value="fr-fr">Français (FR)</SelectItem>
                      <SelectItem value="es-es">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Extension type</Label>
                  <Select value={form.extension_type || "default"} onValueChange={(v) => set("extension_type", v)} disabled={isUser}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="default">Default (SIP)</SelectItem>
                      <SelectItem value="virtual">Virtual (forwarding only)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label>Enabled</Label>
                  <Switch checked={!!form.enabled} onCheckedChange={(v) => set("enabled", v)} disabled={isUser} />
                </div>
              </div>
              <div>
                <Label>Account code</Label>
                <Input value={form.accountcode || "lemtel.lemtel.tel"} onChange={(e) => set("accountcode", e.target.value)} disabled={isUser} />
              </div>
            </Card>

            {!isUser && (
              <Card className="p-4 space-y-3">
                <h3 className="font-semibold text-sm">Limits</h3>
                <div className="grid grid-cols-3 gap-3">
                  <div><Label>Max calls</Label><Input type="number" value={form.limit_max || "5"} onChange={(e) => set("limit_max", e.target.value)} /></div>
                  <div><Label>Limit destination</Label><Input value={form.limit_destination || "!USER_BUSY"} onChange={(e) => set("limit_destination", e.target.value)} /></div>
                  <div><Label>Max registrations</Label><Input type="number" value={form.max_registrations || ""} onChange={(e) => set("max_registrations", e.target.value ? parseInt(e.target.value) : null)} /></div>
                </div>
              </Card>
            )}
          </TabsContent>

          {/* VOICEMAIL */}
          <TabsContent value="voicemail" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base">Voicemail enabled</Label>
                <Switch checked={!!form.voicemail_enabled} onCheckedChange={(v) => set("voicemail_enabled", v)} />
              </div>
              <div>
                <Label>Voicemail PIN</Label>
                <div className="flex gap-2">
                  <Input value={form.voicemail_password || ""} onChange={(e) => set("voicemail_password", e.target.value.replace(/\D/g, ""))} maxLength={8} />
                  <Button type="button" variant="outline" onClick={() => set("voicemail_password", genPin())}>
                    <RefreshCw className="h-4 w-4 mr-1" /> 6-digit
                  </Button>
                </div>
              </div>
              <div>
                <Label>Email notifications to</Label>
                <Input value={form.voicemail_mail_to || ""} onChange={(e) => set("voicemail_mail_to", e.target.value)} placeholder="user@company.com, backup@company.com" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Attachment</Label>
                  <Select value={form.voicemail_file || "listen"} onValueChange={(v) => set("voicemail_file", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="listen">Listen link (login required)</SelectItem>
                      <SelectItem value="attach">Attach MP3</SelectItem>
                      <SelectItem value="none">No attachment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between pt-6">
                  <Label>Keep local copy</Label>
                  <Switch checked={!!form.voicemail_keep_local} onCheckedChange={(v) => set("voicemail_keep_local", v)} />
                </div>
              </div>
              <div className="flex items-center justify-between">
                <Label>Auto-transcribe voicemails</Label>
                <Switch checked={!!form.voicemail_transcription} onCheckedChange={(v) => set("voicemail_transcription", v)} />
              </div>
              <div className="flex items-center justify-between">
                <Label>Send transcription to AI</Label>
                <Switch checked={!!form.voicemail_custom_prompt} onCheckedChange={(v) => set("voicemail_custom_prompt", v)} />
              </div>
            </Card>

            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Missed call notification</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Type</Label>
                  <Select value={form.missed_call_app || "none"} onValueChange={(v) => set("missed_call_app", v === "none" ? null : v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Destination</Label>
                  <Input value={form.missed_call_data || ""} onChange={(e) => set("missed_call_data", e.target.value)} disabled={!form.missed_call_app} />
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* FORWARDING */}
          <TabsContent value="forwarding" className="space-y-4 pt-4">
            <Card className="p-4 flex items-center justify-between">
              <div>
                <Label className="text-base">Do Not Disturb</Label>
                <p className="text-xs text-muted-foreground">All inbound calls go straight to voicemail</p>
              </div>
              <Switch checked={!!form.do_not_disturb} onCheckedChange={(v) => set("do_not_disturb", v)} />
            </Card>

            {[
              { e: "forward_all_enabled", d: "forward_all_destination", label: "Forward all calls" },
              { e: "forward_busy_enabled", d: "forward_busy_destination", label: "Forward when busy" },
              { e: "forward_no_answer_enabled", d: "forward_no_answer_destination", label: "Forward on no answer" },
              { e: "forward_user_not_registered_enabled", d: "forward_user_not_registered_destination", label: "Forward when offline" },
            ].map(({ e, d, label }) => (
              <Card key={e} className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Label>{label}</Label>
                  <Switch checked={!!form[e]} onCheckedChange={(v) => set(e, v)} />
                </div>
                <Input
                  placeholder="5141234567 or ext 222"
                  value={form[d] || ""}
                  onChange={(ev) => set(d, ev.target.value)}
                  disabled={!form[e]}
                />
              </Card>
            ))}
          </TabsContent>

          {/* DEVICES */}
          <TabsContent value="devices" className="pt-4">
            <Card className="p-4">
              <p className="text-sm text-muted-foreground">
                Registered devices and provisioning are managed in <b>Phone System → Devices</b>.
                Device lines linked to this extension: <b>{Array.isArray(form.device_lines) ? form.device_lines.length : 0}</b>
              </p>
            </Card>
          </TabsContent>

          {/* ADVANCED */}
          <TabsContent value="advanced" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <div>
                <Label>Recording</Label>
                <Select value={form.user_record || "none"} onValueChange={(v) => set("user_record", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="local">Inbound</SelectItem>
                    <SelectItem value="remote">Outbound</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Absolute codec string</Label>
                <Input value={form.absolute_codec_string || ""} onChange={(e) => set("absolute_codec_string", e.target.value)} placeholder="PCMU,PCMA" />
              </div>
              <div>
                <Label>SIP bypass media</Label>
                <Select value={form.sip_bypass_media || "none"} onValueChange={(v) => set("sip_bypass_media", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="bypass-media">bypass-media</SelectItem>
                    <SelectItem value="bypass-media-after-bridge">bypass-media-after-bridge</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between pt-6">
                  <Label>Force ping</Label>
                  <Switch checked={!!form.force_ping} onCheckedChange={(v) => set("force_ping", v)} />
                </div>
                <div><Label>SIP force expires</Label><Input type="number" value={form.sip_force_expires || ""} onChange={(e) => set("sip_force_expires", e.target.value ? parseInt(e.target.value) : null)} /></div>
              </div>
              <div><Label>SIP force contact</Label><Input value={form.sip_force_contact || ""} onChange={(e) => set("sip_force_contact", e.target.value)} /></div>
              <div><Label>CIDR allow</Label><Input value={form.cidr || ""} onChange={(e) => set("cidr", e.target.value)} placeholder="192.168.1.0/24" /></div>
              <div><Label>Auth ACL</Label><Input value={form.auth_acl || ""} onChange={(e) => set("auth_acl", e.target.value)} /></div>
              <div><Label>Toll allow</Label><Input value={form.toll_allow || ""} onChange={(e) => set("toll_allow", e.target.value)} placeholder="domestic,international" /></div>
            </Card>
          </TabsContent>

          {/* SECURITY */}
          <TabsContent value="security" className="space-y-4 pt-4">
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Reset SIP password</h3>
              <div className="flex gap-2">
                <Input
                  type={showPw ? "text" : "password"}
                  value={form.password || ""}
                  onChange={(e) => set("password", e.target.value)}
                />
                <Button type="button" variant="outline" onClick={() => set("password", genPassword())}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Auto
                </Button>
              </div>
            </Card>
            <Card className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Reset voicemail PIN</h3>
              <div className="flex gap-2">
                <Input value={form.voicemail_password || ""} onChange={(e) => set("voicemail_password", e.target.value.replace(/\D/g, ""))} maxLength={8} />
                <Button type="button" variant="outline" onClick={() => set("voicemail_password", genPin())}>
                  <RefreshCw className="h-4 w-4 mr-1" /> Generate
                </Button>
              </div>
            </Card>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Save &amp; Sync to FusionPBX
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
