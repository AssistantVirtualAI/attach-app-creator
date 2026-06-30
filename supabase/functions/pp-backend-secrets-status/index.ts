// Reports which backend secrets are configured (presence only, never the value).
// Used by the integrations admin page to show "API key detected in backend".
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

/** integration_key -> [backend secret names that satisfy it] */
const MAP: Record<string, string[]> = {
  ns_api: ["NS_API_KEY", "NS_API_BASE_URL", "NS_DEFAULT_DOMAIN"],
  anthropic: ["ANTHROPIC_API_KEY", "LOVABLE_API_KEY"],
  openai: ["OPENAI_API_KEY"],
  elevenlabs: ["ELEVENLABS_API_KEY"],
  ms365: ["MS365_CLIENT_ID", "MS365_CLIENT_SECRET", "MS365_TENANT_ID"],
  maestro: ["MAESTRO_API_KEY", "MAESTRO_WEBHOOK_SECRET"],
  webhooks: ["NS_WEBHOOK_SECRET"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
  telnyx: ["TELNYX_API_KEY", "TELNYX_PUBLIC_KEY", "TELNYX_MESSAGING_PROFILE_ID"],
  resend: ["RESEND_API_KEY"],
  stripe: ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"],
  fusionpbx: ["FUSIONPBX_API_KEY", "FUSIONPBX_API_URL", "FUSIONPBX_USERNAME", "FUSIONPBX_PASSWORD"],
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const out: Record<string, { configured: boolean; present: string[]; missing: string[] }> = {};
    for (const [key, names] of Object.entries(MAP)) {
      const present: string[] = [];
      const missing: string[] = [];
      for (const n of names) {
        const v = Deno.env.get(n);
        if (v && v.length > 0) present.push(n); else missing.push(n);
      }
      out[key] = { configured: present.length > 0, present, missing };
    }

    return new Response(JSON.stringify({ ok: true, secrets: out }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
