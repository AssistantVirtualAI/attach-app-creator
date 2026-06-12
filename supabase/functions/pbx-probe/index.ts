// Probe FusionPBX with arbitrary method + body
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const FUSIONPBX_API_URL = Deno.env.get("FUSIONPBX_API_URL")!.replace(/\/+$/, "").replace(/\/app\/api(\/\d+)?$/, "");
  const FUSIONPBX_API_KEY = Deno.env.get("FUSIONPBX_API_KEY")!;
  const FUSIONPBX_USERNAME = Deno.env.get("FUSIONPBX_USERNAME")!;

  let body: any = {};
  try { body = await req.json(); } catch { /* */ }
  const path: string = body.path || "gateways";
  const method: string = (body.method || "GET").toUpperCase();
  const payload = body.payload;
  const useQueryAuth = !!body.useQueryAuth;

  let url = `${FUSIONPBX_API_URL}/app/api/7/${path}`;
  if (useQueryAuth) {
    const sep = url.includes("?") ? "&" : "?";
    url += `${sep}key=${encodeURIComponent(FUSIONPBX_API_KEY)}&username=${encodeURIComponent(FUSIONPBX_USERNAME)}`;
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (!useQueryAuth) headers.Authorization = `Basic ${FUSIONPBX_API_KEY}`;
  if (payload !== undefined) headers["Content-Type"] = "application/json";

  const r = await fetch(url, {
    method,
    headers,
    body: payload !== undefined ? JSON.stringify(payload) : undefined,
  });
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, url, body: text.slice(0, 4000) }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
