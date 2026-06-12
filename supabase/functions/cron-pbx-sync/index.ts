// Cron-invoked PBX live sync. Public (verify_jwt = false), idempotent.
// pg_cron hits this every 2 minutes; it forwards a service-role call to
// fusionpbx-proxy `sync-all` so all PBX resources stay fresh.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEMTEL_ORG = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  let body: any = {};
  try { body = await req.json(); } catch { /* tolerate empty */ }
  const orgId: string = body.organization_id || LEMTEL_ORG;

  const t0 = Date.now();
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({ action: "sync-all", organization_id: orgId }),
    });
    const text = await r.text();
    let data: unknown = text;
    try { data = JSON.parse(text); } catch { /* keep raw */ }
    return new Response(JSON.stringify({ ok: r.ok, status: r.status, duration_ms: Date.now() - t0, data }), {
      status: r.ok ? 200 : r.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
