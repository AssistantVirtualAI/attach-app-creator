import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { endpoint, method = "GET", params, body, organization_id } = await req.json();
    if (!endpoint || !organization_id) {
      return new Response(JSON.stringify({ error: "endpoint and organization_id required" }), { status: 400, headers: corsHeaders });
    }

    // Verify org membership
    const { data: member } = await admin
      .from("organization_members").select("organization_id")
      .eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // Load PBX integration (URL/domain + mock mode)
    const { data: integ } = await admin.from("pbx_integrations").select("*").eq("organization_id", organization_id).maybeSingle();
    if (!integ) return new Response(JSON.stringify({ error: "PBX not configured" }), { status: 404, headers: corsHeaders });

    if (integ.config?.mock_mode) {
      return new Response(JSON.stringify({ data: [], mock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lookup creds from lemtel_config (FUSIONPBX_USERNAME, FUSIONPBX_API_KEY)
    const { data: cfgRows } = await admin.from("lemtel_config").select("key, value")
      .in("key", ["FUSIONPBX_USERNAME", "FUSIONPBX_API_KEY"]);
    const cfg = Object.fromEntries((cfgRows || []).map((r: any) => [r.key, r.value]));
    const username = integ.config?.username || cfg.FUSIONPBX_USERNAME;
    const apiKey = cfg.FUSIONPBX_API_KEY;
    if (!username || !apiKey) {
      return new Response(JSON.stringify({ error: "FusionPBX credentials missing" }), { status: 500, headers: corsHeaders });
    }

    // Build URL with key/username query params (FusionPBX REST pattern)
    const sep = endpoint.includes("?") ? "&" : "?";
    const extra = new URLSearchParams({ username, key: apiKey, ...(params || {}) }).toString();
    const url = `${integ.base_url}${endpoint}${sep}${extra}`;

    const basic = btoa(`${username}:${apiKey}`);
    const res = await fetch(url, {
      method,
      body: body ? (typeof body === "string" ? body : JSON.stringify(body)) : undefined,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${basic}`,
      },
    });
    const text = await res.text();
    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    // Audit
    await admin.from("audit_logs").insert({
      organization_id, user_id: user.id,
      action: "fusionpbx_proxy", resource_type: "pbx",
      metadata: { endpoint, method, status: res.status },
    });

    return new Response(JSON.stringify({ data: json, status: res.status }), {
      status: res.ok ? 200 : res.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
