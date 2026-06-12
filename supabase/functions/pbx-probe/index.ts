// One-shot probe: fetches a raw FusionPBX path with service-role auth and returns the response.
// Used to debug gateway endpoint shape.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const FUSIONPBX_API_URL = Deno.env.get("FUSIONPBX_API_URL")!.replace(/\/+$/, "").replace(/\/app\/api(\/\d+)?$/, "");
  const FUSIONPBX_API_KEY = Deno.env.get("FUSIONPBX_API_KEY")!;

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const path: string = body.path || "gateways";
  const r = await fetch(`${FUSIONPBX_API_URL}/app/api/7/${path}`, {
    headers: { Authorization: `Basic ${FUSIONPBX_API_KEY}`, Accept: "application/json" },
  });
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: text.slice(0, 3000) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
