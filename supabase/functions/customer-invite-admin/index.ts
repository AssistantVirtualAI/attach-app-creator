// Invite a user as org_admin to a tenant org. Lemtel/super admin only.
// Body: { organizationId, email, fullName? }
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { organizationId, email, fullName, role: roleInput } = await req.json();
    if (!organizationId || !email) {
      return new Response(JSON.stringify({ error: "organizationId and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const role = roleInput === 'manager' ? 'manager' : 'org_admin';

    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    // verify caller is super_admin or lemtel_admin
    const caller = createClient(url, anon, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData } = await caller.auth.getUser();
    const callerId = userData?.user?.id;
    if (!callerId) {
      return new Response(JSON.stringify({ error: "not authenticated" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(url, service, { auth: { persistSession: false } });
    const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: callerId });
    const { data: isLemtel } = await admin.rpc("is_lemtel_admin", { _user_id: callerId });
    if (!isSuper && !isLemtel) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ensure auth user exists; invite if missing
    let inviteUrl: string | null = null;
    const { data: existing } = await admin.from("profiles").select("id").eq("email", String(email).toLowerCase()).maybeSingle();
    if (existing?.id) {
      targetId = existing.id;
    } else {
      const redirectTo = `${req.headers.get("origin") || ""}/auth`;
      const { data: invited, error: invErr } = await admin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: fullName ? { full_name: fullName } : undefined,
      });
      if (invErr) {
        return new Response(JSON.stringify({ error: invErr.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      targetId = invited?.user?.id ?? null;
      inviteUrl = (invited as any)?.properties?.action_link ?? null;
    }
    if (!targetId) {
      return new Response(JSON.stringify({ error: "could not resolve user" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("organization_members").upsert(
      { user_id: targetId, organization_id: organizationId, accepted_at: new Date().toISOString() },
      { onConflict: "user_id,organization_id" },
    );
    await admin.from("user_roles").upsert(
      { user_id: targetId, organization_id: organizationId, role },
      { onConflict: "user_id,organization_id,role" },
    );

    return new Response(JSON.stringify({ ok: true, user_id: targetId, role, invite_url: inviteUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
