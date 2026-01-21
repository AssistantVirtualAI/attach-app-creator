import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type AppRole = "super_admin" | "org_admin" | "manager" | "agent" | "viewer";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authorization required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authClient = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userRes, error: userErr } = await authClient.auth.getUser();
    if (userErr || !userRes.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json().catch(() => ({}));
    const organization_id = body?.organization_id as string | undefined;
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: isSuperAdmin }, { data: roleRow }] = await Promise.all([
      supabase.rpc("is_super_admin", { _user_id: userRes.user.id }),
      supabase
        .from("user_roles")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", userRes.user.id)
        .maybeSingle(),
    ]);

    const callerRole = (roleRow?.role as AppRole | undefined) ?? undefined;
    const canRun = Boolean(isSuperAdmin) || callerRole === "org_admin" || callerRole === "manager";
    if (!canRun) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: results, error: rpcErr } = await supabase.rpc("run_security_audit", { _org_id: organization_id });
    if (rpcErr) throw rpcErr;

    const { data: runRow, error: insertErr } = await supabase
      .from("security_audit_runs")
      .insert({
        organization_id,
        run_by: userRes.user.id,
        results: results ?? {},
      })
      .select("id, organization_id, run_by, results, created_at")
      .single();

    if (insertErr) throw insertErr;

    // Audit log
    await supabase.from("audit_logs").insert({
      organization_id,
      user_id: userRes.user.id,
      action: "create",
      resource_type: "security_audit",
      resource_id: runRow.id,
      metadata: { results },
    });

    return new Response(JSON.stringify({ run: runRow }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("security-audit-run error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
