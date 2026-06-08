import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { email, organizationId, code } = await req.json();
    if (!email || !organizationId || !code) {
      return new Response(JSON.stringify({ error: "missing_fields" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const normalizedEmail = String(email).toLowerCase();
    const codeStr = String(code).trim();
    if (!/^\d{6}$/.test(codeStr)) {
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const codeHash = await sha256Hex(`${codeStr}:${organizationId}:${normalizedEmail}`);

    const { data: otp, error: lookupErr } = await supabase
      .from("two_factor_otps")
      .select("id, attempts, expires_at, consumed_at, code_hash")
      .eq("email", normalizedEmail)
      .eq("organization_id", organizationId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lookupErr || !otp) {
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (new Date(otp.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ error: "expired" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if ((otp.attempts ?? 0) >= 5) {
      await supabase
        .from("two_factor_otps")
        .update({ consumed_at: new Date().toISOString() })
        .eq("id", otp.id);
      return new Response(JSON.stringify({ error: "too_many_attempts" }), {
        status: 429, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Constant-time comparison
    const a = new TextEncoder().encode(otp.code_hash);
    const b = new TextEncoder().encode(codeHash);
    let match = a.length === b.length ? 1 : 0;
    const len = Math.max(a.length, b.length);
    for (let i = 0; i < len; i++) match &= (a[i] ?? 0) === (b[i] ?? 0) ? 1 : 0;

    if (!match) {
      await supabase
        .from("two_factor_otps")
        .update({ attempts: (otp.attempts ?? 0) + 1 })
        .eq("id", otp.id);
      return new Response(JSON.stringify({ error: "invalid_code" }), {
        status: 400, headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    await supabase
      .from("two_factor_otps")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", otp.id);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e: any) {
    console.error("verify-otp error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "internal_error" }), {
      status: 500, headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
