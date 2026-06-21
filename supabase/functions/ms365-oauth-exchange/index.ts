import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { code, redirect_uri } = await req.json();
    if (!code || !redirect_uri) return new Response(JSON.stringify({ success: false, error: "missing code/redirect_uri" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: ms } = await admin.from("planipret_integration_secrets").select("config").eq("provider", "microsoft").maybeSingle();
    const c = (ms?.config ?? {}) as Record<string, string>;
    const clientId = c.client_id ?? Deno.env.get("MICROSOFT_CLIENT_ID");
    const clientSecret = c.client_secret ?? Deno.env.get("MICROSOFT_CLIENT_SECRET");
    const tenant = c.tenant_id ?? Deno.env.get("MICROSOFT_TENANT_ID") ?? "common";
    if (!clientId || !clientSecret) return new Response(JSON.stringify({ success: false, error: "MS365 non configuré côté admin" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = new URLSearchParams({
      client_id: clientId, client_secret: clientSecret, grant_type: "authorization_code",
      code, redirect_uri, scope: "openid offline_access Mail.ReadWrite Calendars.ReadWrite User.Read",
    });
    const r = await fetch(`https://login.microsoftonline.com/${tenant}/oauth2/v2.0/token`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
    const d = await r.json();
    if (!r.ok) return new Response(JSON.stringify({ success: false, error: d.error_description ?? "OAuth failed", details: d }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    await admin.from("planipret_profiles").update({ ms365_access_token: d.access_token, ms365_refresh_token: d.refresh_token }).eq("user_id", userId);
    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message ?? "Erreur" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
