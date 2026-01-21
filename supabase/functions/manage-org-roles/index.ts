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

    const token = authHeader.replace("Bearer ", "");

    // Use anon client for auth verification (scoped to user)
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

    // Service client for privileged DB ops (we enforce access checks below)
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const callingUser = userRes.user;
    const body = await req.json().catch(() => ({}));
    const action = (body?.action as string | undefined) ?? "list";
    const organization_id = body?.organization_id as string | undefined;

    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine caller permissions in org
    const [{ data: isSuperAdmin }, { data: callerRole }] = await Promise.all([
      supabase.rpc("is_super_admin", { _user_id: callingUser.id }),
      supabase
        .from("user_roles")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", callingUser.id)
        .maybeSingle(),
    ]);

    const callerOrgRole = (callerRole?.role as AppRole | undefined) ?? undefined;
    const canView = Boolean(isSuperAdmin) || callerOrgRole === "org_admin" || callerOrgRole === "manager";
    const canManage = Boolean(isSuperAdmin) || callerOrgRole === "org_admin";

    if (action === "list") {
      if (!canView) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: members, error: membersError } = await supabase
        .from("organization_members")
        .select("user_id, invited_at, accepted_at")
        .eq("organization_id", organization_id);

      if (membersError) throw membersError;

      const memberIds = (members ?? []).map((m) => m.user_id);
      if (memberIds.length === 0) {
        return new Response(JSON.stringify({ members: [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("id, email, full_name, avatar_url").in("id", memberIds),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("organization_id", organization_id)
          .in("user_id", memberIds),
      ]);

      const profilesMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]));
      const rolesMap = new Map((rolesRes.data ?? []).map((r) => [r.user_id, r]));

      const result = (members ?? []).map((m) => ({
        user_id: m.user_id,
        invited_at: m.invited_at,
        accepted_at: m.accepted_at,
        profile: profilesMap.get(m.user_id) ?? null,
        role: rolesMap.get(m.user_id)?.role ?? "viewer",
      }));

      return new Response(JSON.stringify({ members: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      if (!canManage) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const user_id = body?.user_id as string | undefined;
      const new_role = body?.new_role as AppRole | undefined;

      if (!user_id || !new_role) {
        return new Response(JSON.stringify({ error: "user_id and new_role are required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (new_role === "super_admin") {
        return new Response(JSON.stringify({ error: "Cannot assign super_admin at org level" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: currentRoleRow, error: currentRoleErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("organization_id", organization_id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (currentRoleErr) throw currentRoleErr;

      const currentRole = (currentRoleRow?.role as AppRole | undefined) ?? "viewer";

      // Prevent demoting the last org admin
      if (currentRole === "org_admin" && new_role !== "org_admin") {
        const { count: adminCount, error: adminCountErr } = await supabase
          .from("user_roles")
          .select("user_id", { count: "exact", head: true })
          .eq("organization_id", organization_id)
          .eq("role", "org_admin");

        if (adminCountErr) throw adminCountErr;

        if ((adminCount ?? 0) <= 1) {
          return new Response(JSON.stringify({ error: "Cannot remove the last organization admin" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error: updateErr } = await supabase
        .from("user_roles")
        .update({ role: new_role })
        .eq("organization_id", organization_id)
        .eq("user_id", user_id);

      if (updateErr) throw updateErr;

      // Audit log
      await supabase.from("audit_logs").insert({
        organization_id,
        user_id: callingUser.id,
        action: "update",
        resource_type: "user_roles",
        resource_id: user_id,
        metadata: {
          actor_user_id: callingUser.id,
          target_user_id: user_id,
          old_role: currentRole,
          new_role,
        },
      });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("manage-org-roles error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
