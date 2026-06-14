// mobile-dashboard: aggregated KPIs + "needs attention" for the mobile Home screen.
// Auth: requires user JWT. Scopes by the user's organization(s).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { data: sp } = await sb
      .from("pbx_softphone_users")
      .select("organization_id, extension, extension_uuid, sip_domain, display_name, status, status_updated_at, updated_at, forward_enabled, forward_to, dnd_enabled")
      .eq("portal_user_id", u.user.id)
      .maybeSingle();
    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);

    const orgId = sp.organization_id;
    const since = new Date(Date.now() - 24 * 36e5).toISOString();

    const { data: roleRow } = await sb
      .from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("organization_id", orgId).maybeSingle();
    const role = roleRow?.role || "agent";
    const admin = role === "org_admin" || role === "super_admin" || role === "manager";

    let callsQ = sb.from("pbx_call_records")
      .select("id, direction, call_status, caller_name, caller_number, start_at, duration_seconds, missed_call, has_recording, voicemail_message")
      .eq("organization_id", orgId)
      .gte("start_at", since);
    let vmQ = sb.from("pbx_call_records")
      .select("id, caller_name, caller_number, start_at, voicemail_message")
      .eq("organization_id", orgId)
      .eq("call_status", "voicemail");

    if (!admin) {
      if (sp.extension_uuid) {
        callsQ = callsQ.eq("extension_uuid", sp.extension_uuid);
        vmQ = vmQ.eq("extension_uuid", sp.extension_uuid);
      } else if (sp.extension) {
        callsQ = callsQ.eq("extension", sp.extension);
        vmQ = vmQ.eq("extension", sp.extension);
      }
    }

    let smsQ = sb.from("pbx_sms_threads")
      .select("id, contact_name, contact_phone, unread_count, last_message_at, extension_uuid, extension")
      .eq("organization_id", orgId)
      .order("last_message_at", { ascending: false })
      .limit(admin ? 50 : 20);
    if (!admin) {
      if (sp.extension_uuid) smsQ = smsQ.eq("extension_uuid", sp.extension_uuid);
      else if (sp.extension) smsQ = smsQ.eq("extension", sp.extension);
    }

    const [{ data: calls }, { data: threads }, { data: vmails }, { count: activeUsers }] = await Promise.all([
      callsQ.order("start_at", { ascending: false }).limit(100),
      smsQ,
      vmQ.order("start_at", { ascending: false }).limit(admin ? 25 : 10),
      admin
        ? sb.from("pbx_softphone_users").select("id", { count: "exact", head: true }).eq("organization_id", orgId).neq("status", "offline")
        : Promise.resolve({ count: null } as any),
    ]);

    const callList = calls || [];
    const threadList = threads || [];
    const vmList = vmails || [];

    const missed = callList.filter((c) => c.missed_call).length;
    const answered = callList.filter((c) => !c.missed_call && c.call_status !== "voicemail").length;
    const unreadSms = threadList.reduce((a, t) => a + (t.unread_count || 0), 0);

    const needsAttention: any[] = [];
    for (const v of vmList.slice(0, 2)) {
      needsAttention.push({
        id: `vm-${v.id}`, kind: "voicemail", accent: "gold",
        title: `${v.caller_name || v.caller_number} left a voicemail`,
        subtitle: new Date(v.start_at!).toLocaleString(),
      });
    }
    for (const t of threadList.filter((x) => (x.unread_count || 0) > 0).slice(0, 2)) {
      needsAttention.push({
        id: `sms-${t.id}`, kind: "unread", accent: "cyan",
        title: `${t.contact_name || t.contact_phone} sent a message`,
        subtitle: `${t.unread_count} unread`,
      });
    }
    for (const c of callList.filter((x) => x.missed_call).slice(0, 1)) {
      needsAttention.push({
        id: `cb-${c.id}`, kind: "callback", accent: "violet",
        title: `Callback ${c.caller_name || c.caller_number}`,
        subtitle: new Date(c.start_at!).toLocaleString(),
      });
    }

    const hour = new Date().getHours();
    const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

    return json({
      greeting: `${greeting}, ${sp.display_name || ""}`.trim(),
      brief: `You have ${missed} missed call${missed === 1 ? "" : "s"}, ${vmList.length} voicemail${vmList.length === 1 ? "" : "s"}, and ${unreadSms} unread message${unreadSms === 1 ? "" : "s"}.`,
      scope: { mode: admin ? "domain_admin" : "extension_user", label: admin ? `Domain admin · ${sp.sip_domain || orgId}` : `Extension ${sp.extension}`, organizationId: orgId, sipDomain: sp.sip_domain || undefined, extension: sp.extension, role },
      metrics: { missedCalls: missed, answeredCalls: answered, unreadSms, voicemails: vmList.length, actionItems: needsAttention.length, activeUsers: activeUsers ?? undefined },
      needsAttention,
      status: { sipState: sp.status === "registered" ? "registered" : sp.status === "connecting" ? "connecting" : "offline", doNotDisturb: !!sp.dnd_enabled, forwarding: sp.forward_enabled ? sp.forward_to : null, updatedAt: sp.status_updated_at || sp.updated_at || undefined },
    });
  } catch (e) {
    console.error("[mobile-dashboard]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
