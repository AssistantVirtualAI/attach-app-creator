import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function friendly(status: number, raw: string): string {
  if (status === 401 || status === 403) return "FusionPBX rejected the credentials. Verify Username and API Key in Settings.";
  if (status === 404) return "FusionPBX endpoint not found. Check the base URL and endpoint path.";
  if (status === 0) return "Could not reach FusionPBX server. Check the base URL or network.";
  if (status >= 500) return "FusionPBX server error. Try again shortly or check PBX logs.";
  return raw?.slice(0, 240) || `Request failed with status ${status}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let organization_id: string | undefined;
  let endpoint = "", method = "GET";
  let userId: string | null = null;

  const logFailure = async (error: string, status: number, extra: Record<string, unknown> = {}) => {
    try {
      if (organization_id) {
        await admin.from("audit_logs").insert({
          organization_id,
          user_id: userId,
          action: "fusionpbx_proxy_error",
          resource_type: "pbx",
          metadata: { endpoint, method, status, error, ...extra },
        });
      }
    } catch (_) { /* swallow */ }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    userId = user.id;

    const body = await req.json();
    endpoint = body.endpoint;
    method = body.method || "GET";
    organization_id = body.organization_id;
    const params = body.params;
    const reqBody = body.body;

    if (!endpoint || !organization_id) {
      return new Response(JSON.stringify({ error: "endpoint and organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: member } = await admin
      .from("organization_members").select("organization_id")
      .eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member) {
      await logFailure("Forbidden: user not a member of organization", 403);
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: integ } = await admin.from("pbx_integrations").select("*").eq("organization_id", organization_id).maybeSingle();
    if (!integ) {
      await logFailure("PBX integration not configured", 404);
      return new Response(JSON.stringify({ error: "PBX integration is not configured for this organization. Open Lemtel Settings to set the FusionPBX URL and credentials." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (integ.config?.mock_mode) {
      return new Response(JSON.stringify({ data: [], mock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!integ.base_url) {
      await logFailure("Missing base_url", 400);
      return new Response(JSON.stringify({ error: "FusionPBX base URL is missing. Set it in Lemtel Settings." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cfgRows } = await admin.from("lemtel_config").select("key, value")
      .in("key", ["FUSIONPBX_USERNAME", "FUSIONPBX_API_KEY"]);
    const cfg = Object.fromEntries((cfgRows || []).map((r: any) => [r.key, r.value]));
    const username = integ.config?.username || cfg.FUSIONPBX_USERNAME;
    const apiKey = cfg.FUSIONPBX_API_KEY;
    if (!username || !apiKey) {
      await logFailure("Missing FusionPBX credentials", 500);
      return new Response(JSON.stringify({ error: "FusionPBX credentials missing. Add FUSIONPBX_USERNAME and FUSIONPBX_API_KEY in Lemtel Settings." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sep = endpoint.includes("?") ? "&" : "?";
    const extra = new URLSearchParams({ username, key: apiKey, ...(params || {}) }).toString();
    const url = `${integ.base_url}${endpoint}${sep}${extra}`;
    const basic = btoa(`${username}:${apiKey}`);

    let res: Response;
    let text = "";
    try {
      res = await fetch(url, {
        method,
        body: reqBody ? (typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody)) : undefined,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basic}`,
        },
      });
      text = await res.text();
    } catch (netErr: any) {
      const errMsg = `Network error reaching FusionPBX: ${netErr?.message ?? String(netErr)}`;
      await logFailure(errMsg, 0);
      return new Response(JSON.stringify({ error: friendly(0, errMsg) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!res.ok) {
      const userMsg = friendly(res.status, text);
      await logFailure(userMsg, res.status, { response_preview: text.slice(0, 500) });
      return new Response(JSON.stringify({ error: userMsg, status: res.status }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("audit_logs").insert({
      organization_id, user_id: user.id,
      action: "fusionpbx_proxy", resource_type: "pbx",
      metadata: { endpoint, method, status: res.status },
    });

    return new Response(JSON.stringify({ data: json, status: res.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await logFailure(e?.message ?? String(e), 500);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
