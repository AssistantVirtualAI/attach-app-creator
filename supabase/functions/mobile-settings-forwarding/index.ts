// mobile-settings-forwarding: toggle / set call forwarding for the current softphone user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
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

    const { target } = await req.json().catch(() => ({}));
    const enabled = !!target;

    const { error } = await sb.from("pbx_softphone_users")
      .update({ forward_enabled: enabled, forward_to: enabled ? String(target) : null, updated_at: new Date().toISOString() })
      .eq("portal_user_id", u.user.id);
    if (error) return json({ error: error.message }, 400);

    return json({ ok: true, forwarding: enabled ? String(target) : null });
  } catch (e) {
    console.error("[mobile-settings-forwarding]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
