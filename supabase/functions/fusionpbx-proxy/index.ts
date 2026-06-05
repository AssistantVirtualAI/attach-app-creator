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
    const { data: member } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .eq("organization_id", "71755d33-ed64-4ad5-a828-61c9d2029eb7")
      .maybeSingle();
    if (!member) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const { endpoint, method = "GET", body } = await req.json();
    if (!endpoint) throw new Error("endpoint required");

    const { data: cfg } = await admin.from("lemtel_config").select("key, value").in("key", ["FUSIONPBX_URL", "FUSIONPBX_USERNAME", "FUSIONPBX_API_KEY"]);
    const config = Object.fromEntries((cfg || []).map((r: any) => [r.key, r.value]));
    const url = `${config.FUSIONPBX_URL}${endpoint}${endpoint.includes("?") ? "&" : "?"}username=${config.FUSIONPBX_USERNAME}&key=${config.FUSIONPBX_API_KEY}`;

    const res = await fetch(url, { method, body: body ? JSON.stringify(body) : undefined, headers: { "Content-Type": "application/json" } });
    const text = await res.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    return new Response(JSON.stringify(json), { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: corsHeaders });
  }
});
