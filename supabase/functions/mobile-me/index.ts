// mobile-me: returns the current user's softphone identity + permissions.
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
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const [{ data: profile }, { data: sp }] = await Promise.all([
      sb.from("profiles").select("full_name, email, avatar_url").eq("id", u.user.id).maybeSingle(),
      sb.from("pbx_softphone_users")
        .select("organization_id, client_id, extension_id, extension, sip_domain, display_name, forward_enabled, forward_to, dnd_enabled, status, status_updated_at, updated_at, wss_url")
        .eq("portal_user_id", u.user.id)
        .maybeSingle(),
    ]);

    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);

    const { data: org } = await admin.from("organizations").select("name, sip_domain, fusionpbx_domain_uuid").eq("id", sp.organization_id).maybeSingle();
    const { data: client } = sp.client_id
      ? await admin.from("clients").select("id, name").eq("id", sp.client_id).maybeSingle()
      : { data: null };

    const { data: roleRow } = await admin
      .from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("organization_id", sp.organization_id).maybeSingle();
    const { data: orgMember } = await admin
      .from("org_members").select("role, can_manage_extensions, can_listen_calls")
      .eq("user_id", u.user.id).eq("org_id", sp.organization_id).maybeSingle();
    const { data: superAdmin } = await admin.rpc("is_super_admin", { _user_id: u.user.id }).maybeSingle().catch(() => ({ data: false } as any));
    const { data: lemtelAdmin } = await admin.rpc("is_lemtel_admin", { _user_id: u.user.id }).maybeSingle().catch(() => ({ data: false } as any));
    const orgMemberRole = orgMember?.role || "";
    const role = superAdmin || lemtelAdmin || orgMemberRole === "master_admin" || orgMemberRole === "ava_admin"
      ? "super_admin"
      : orgMemberRole === "customer_admin" || orgMemberRole === "reseller_admin"
        ? "org_admin"
        : (roleRow?.role || (orgMemberRole === "agent" ? "agent" : "agent"));
    const orgMemberCanAdmin = !!orgMember && (["master_admin", "ava_admin", "reseller_admin", "customer_admin"].includes(orgMemberRole) || orgMember.can_manage_extensions || orgMember.can_listen_calls);
    const isDomainAdmin = role === "org_admin" || role === "super_admin" || role === "manager" || orgMemberCanAdmin;
    const canManageRouting = role === "org_admin" || role === "super_admin" || role === "manager" || !!orgMember?.can_manage_extensions;
    const sipDomain = sp.sip_domain || org?.sip_domain || "";
    const portalUrl = Deno.env.get("AVA_PORTAL_URL") || "https://avastatistic.ca";

    return json({
      user: { id: u.user.id, name: profile?.full_name || u.user.email || "User", email: profile?.email || u.user.email || "", avatarUrl: profile?.avatar_url || undefined },
      organization: { id: sp.organization_id, name: org?.name || "Workspace", sipDomain, fusionpbxDomainUuid: org?.fusionpbx_domain_uuid || undefined, portalUrl, wssUrl: sp.wss_url || undefined },
      client: client ? { id: client.id, name: client.name } : undefined,
      domain: { organizationId: sp.organization_id, sipDomain, fusionpbxDomainUuid: org?.fusionpbx_domain_uuid || undefined, portalUrl, wssUrl: sp.wss_url || undefined },
      extension: { number: sp.extension, displayName: sp.display_name || "", sipDomain, id: sp.extension_id || undefined },
      role,
      dataScope: isDomainAdmin ? "domain_admin" : "extension_user",
      permissions: { admin: isDomainAdmin, canManageNumbers: isDomainAdmin, canManageAgents: isDomainAdmin, canManageUsers: role === "org_admin" || role === "super_admin", canManageRouting, canViewDomainReports: isDomainAdmin },
      status: {
        sipState: sp.status === "registered" ? "registered" : sp.status === "connecting" ? "connecting" : "offline",
        doNotDisturb: !!sp.dnd_enabled,
        forwarding: sp.forward_enabled ? sp.forward_to : null,
        updatedAt: sp.status_updated_at || sp.updated_at || undefined,
      },
    });
  } catch (e) {
    console.error("[mobile-me]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
