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
    const callProxy = async (payload: Record<string, unknown>) => fetch(`${SUPABASE_URL}/functions/v1/fusionpbx-proxy`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
      },
      body: JSON.stringify({ organization_id: orgId, ...payload }),
    });

    const [cdrRes, vmRes] = await Promise.all([
      callProxy({ action: "sync-cdrs", page_size: 250, max_pages: 4 }),
      callProxy({ action: "sync-voicemail-messages", params: { page_size: 250, max_pages: 1 } }),
    ]);
    const parse = async (r: Response) => {
      const text = await r.text();
      try { return { ok: r.ok, status: r.status, data: JSON.parse(text) }; }
      catch { return { ok: r.ok, status: r.status, data: text.slice(0, 500) }; }
    };
    const data = { cdrs: await parse(cdrRes), voicemails: await parse(vmRes) };
    const ok = data.cdrs.ok && data.voicemails.ok;
    return new Response(JSON.stringify({ ok, duration_ms: Date.now() - t0, data }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
