import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const OWNER_UUID = "e5d025c9-eef2-4422-b97d-3190388b7376";
const ALLOWED = new Set(["microsoft", "maestro"]);

function mask(v: unknown): string {
  if (typeof v !== "string" || !v) return "";
  if (v.length <= 6) return "•".repeat(v.length);
  return v.slice(0, 2) + "•".repeat(Math.max(4, v.length - 6)) + v.slice(-4);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization") ?? "";
  const supaUrl = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supaUser = createClient(supaUrl, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await supaUser.auth.getUser();
  const user = userRes?.user;
  if (!user || user.id !== OWNER_UUID) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const admin = createClient(supaUrl, service);
  const url = new URL(req.url);
  const action = url.searchParams.get("action") ?? "get";

  if (req.method === "GET" || action === "get") {
    const { data, error } = await admin
      .from("planipret_integration_secrets")
      .select("provider, config, updated_at");
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Mask all values before returning to the browser.
    const masked = (data ?? []).map((row: any) => ({
      provider: row.provider,
      updated_at: row.updated_at,
      config_masked: Object.fromEntries(
        Object.entries(row.config ?? {}).map(([k, v]) => [k, mask(v)])
      ),
      has_keys: Object.keys(row.config ?? {}),
    }));
    return new Response(JSON.stringify({ items: masked }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const body = await req.json().catch(() => null);
    if (!body?.provider || !ALLOWED.has(body.provider) || typeof body.config !== "object") {
      return new Response(JSON.stringify({ error: "invalid_body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Merge with existing so blank fields don't wipe stored values.
    const { data: existing } = await admin
      .from("planipret_integration_secrets")
      .select("config")
      .eq("provider", body.provider)
      .maybeSingle();

    const merged: Record<string, string> = { ...(existing?.config ?? {}) };
    for (const [k, v] of Object.entries(body.config as Record<string, unknown>)) {
      if (typeof v === "string" && v.trim() !== "") merged[k] = v.trim();
    }

    const { error } = await admin
      .from("planipret_integration_secrets")
      .upsert(
        { provider: body.provider, config: merged, updated_by: user.id },
        { onConflict: "provider" }
      );
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
