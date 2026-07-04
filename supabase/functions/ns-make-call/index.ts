// ns-make-call — thin wrapper that forwards to ns-calls (action: "start").
// Keeps a stable public name for the mobile app while call control stays in ns-calls.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization");
  if (!auth) return json({ success: false, error: "unauthorized", code: 401 }, 401);

  const body = await req.json().catch(() => ({} as any));
  const to =
    body?.to_number ?? body?.destination ?? body?.number ?? body?.to ?? null;
  if (!to || typeof to !== "string") {
    return json({ success: false, error: "destination requise", code: 400 }, 400);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const target = `${SUPABASE_URL}/functions/v1/ns-calls`;
  const res = await fetch(target, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: auth,
      apikey: Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    },
    body: JSON.stringify({
      action: "start",
      to_number: to,
      caller_id_number: body?.caller_id_number,
      caller_id_name: body?.caller_id_name,
    }),
  });

  const text = await res.text();
  return new Response(text || "{}", {
    status: res.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
