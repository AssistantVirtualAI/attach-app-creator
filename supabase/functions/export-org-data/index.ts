import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

type ExportType = "topics" | "prompt_templates" | "both";
type ExportFormat = "json" | "csv";

function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return `"${s.replaceAll('"', '""')}"`;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => escape(r[h])).join(","))].join("\n");
}

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

    const { organization_id, export_type, format } = await req.json();

    const orgId = organization_id as string | undefined;
    const exportType = (export_type as ExportType | undefined) ?? "both";
    const exportFormat = (format as ExportFormat | undefined) ?? "json";

    if (!orgId) {
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
        .eq("organization_id", orgId)
        .eq("user_id", userRes.user.id)
        .maybeSingle(),
    ]);

    const isOrgAdmin = roleRow?.role === "org_admin";
    if (!isSuperAdmin && !isOrgAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const stamp = now.toISOString().slice(0, 10);

    const payload: Record<string, unknown> = {
      export_date: now.toISOString(),
      organization_id: orgId,
    };

    if (exportType === "topics" || exportType === "both") {
      const { data: topics, error } = await supabase
        .from("topic_aggregates")
        .select("id, topic, category, total_mentions, avg_sentiment, last_mentioned_at, created_at, updated_at")
        .eq("organization_id", orgId)
        .order("total_mentions", { ascending: false })
        .limit(1000);

      if (error) throw error;
      payload.topics = topics ?? [];
    }

    if (exportType === "prompt_templates" || exportType === "both") {
      const { data: templates, error } = await supabase
        .from("prompt_templates")
        .select(
          "id, organization_id, name, description, system_prompt, first_message, temperature, max_tokens, tags, is_default, created_at, updated_at",
        )
        .or(`organization_id.eq.${orgId},and(organization_id.is.null,is_default.eq.true)`)
        .order("is_default", { ascending: false })
        .order("name")
        .limit(1000);

      if (error) throw error;
      payload.prompt_templates = templates ?? [];
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: userRes.user.id,
      action: "export",
      resource_type: "organization_data",
      metadata: {
        export_type: exportType,
        format: exportFormat,
      },
    });

    if (exportFormat === "csv") {
      // For CSV, return a single CSV by flattening keys (best-effort)
      const rows: Record<string, unknown>[] = [];
      if (Array.isArray(payload.topics)) {
        (payload.topics as Record<string, unknown>[]).forEach((r) => rows.push({ kind: "topic", ...r }));
      }
      if (Array.isArray(payload.prompt_templates)) {
        (payload.prompt_templates as Record<string, unknown>[]).forEach((r) => rows.push({ kind: "prompt_template", ...r }));
      }

      const csv = toCsv(rows);
      const filename = `org-export-${stamp}.csv`;
      return new Response(JSON.stringify({ filename, mime: "text/csv", content: csv }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const filename = `org-export-${stamp}.json`;
    return new Response(JSON.stringify({ filename, mime: "application/json", content: JSON.stringify(payload, null, 2) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("export-org-data error", err);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
