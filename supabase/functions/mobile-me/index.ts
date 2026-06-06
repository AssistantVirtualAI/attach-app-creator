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
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const [{ data: profile }, { data: sp }] = await Promise.all([
      sb.from("profiles").select("full_name, email, avatar_url").eq("id", u.user.id).maybeSingle(),
      sb.from("pbx_softphone_users")
        .select("organization_id, client_id, extension, sip_domain, display_name, forward_enabled, forward_to, dnd_enabled, status")
        .eq("portal_user_id", u.user.id)
        .maybeSingle(),
    ]);

    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);

    const { data: org } = await sb.from("organizations").select("name").eq("id", sp.organization_id).maybeSingle();
    const { data: client } = sp.client_id
      ? await sb.from("clients").select("id, name").eq("id", sp.client_id).maybeSingle()
      : { data: null };

    const { data: roleRow } = await sb
      .from("user_roles").select("role")
      .eq("user_id", u.user.id).eq("organization_id", sp.organization_id).maybeSingle();
    const role = roleRow?.role || "agent";
    const admin = role === "org_admin" || role === "super_admin";

    return json({
      user: { id: u.user.id, name: profile?.full_name || u.user.email || "User", email: profile?.email || u.user.email || "", avatarUrl: profile?.avatar_url || undefined },
      organization: { id: sp.organization_id, name: org?.name || "Workspace" },
      client: client ? { id: client.id, name: client.name } : undefined,
      extension: { number: sp.extension, displayName: sp.display_name || "", sipDomain: sp.sip_domain || "" },
      permissions: { admin, canManageNumbers: admin, canManageAgents: admin },
      status: {
        sipState: sp.status === "registered" ? "registered" : sp.status === "connecting" ? "connecting" : "offline",
        doNotDisturb: !!sp.dnd_enabled,
        forwarding: sp.forward_enabled ? sp.forward_to : null,
      },
    });
  } catch (e) {
    console.error("[mobile-me]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
