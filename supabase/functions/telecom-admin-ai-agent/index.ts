import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const SYSTEM_PROMPT = `You are AVA, an AI telecom admin assistant.
Translate the admin's request into ONE structured action proposal.

Return ONLY valid JSON with this shape:
{
  "interpreted_action": "short verb phrase, e.g. 'Create holiday schedule'",
  "changes": {
    "table": "business_hour_schedules" | "holiday_schedules" | "pbx_extensions" | "pbx_ivrs" | "pbx_call_queues" | "phone_numbers" | "info",
    "operation": "insert" | "update" | "delete" | "info",
    "row": { ... fields to insert/update ... },
    "where": { ... filter for update/delete ... },
    "human_summary": "1 sentence explanation of what will change"
  }
}

If the request is read-only (e.g. "show me stats"), use table="info" and put the answer in human_summary.
Never invent organization_id — leave it out; it is injected server-side.
For business_hour_schedules, use fields: name, timezone, schedule_json (object keyed by day_of_week 0-6 with start_time, end_time, is_open).
For holiday_schedules: name, start_date (YYYY-MM-DD), end_date, greeting_text, routing_action ('voicemail'|'forward'|'play_greeting'), routing_target.
If unsure or unsafe, return table="info" explaining what details are missing.`;

async function llmPropose(prompt: string): Promise<any> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!r.ok) {
    const t = await r.text();
    if (r.status === 429) throw new Error("ai_rate_limited");
    if (r.status === 402) throw new Error("ai_credits_exhausted");
    throw new Error(`ai_failed: ${t.slice(0, 200)}`);
  }
  const j = await r.json();
  const content = j.choices?.[0]?.message?.content ?? "{}";
  try { return JSON.parse(content); } catch { return { interpreted_action: "info", changes: { table: "info", operation: "info", human_summary: content } }; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization") ?? "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "missing_auth" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userRes } = await userClient.auth.getUser();
    if (!userRes?.user) return json({ error: "invalid_auth" }, 401);
    const userId = userRes.user.id;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Find admin's org
    const { data: roles } = await admin.from("user_roles")
      .select("organization_id, role").eq("user_id", userId)
      .in("role", ["org_admin", "super_admin"]);
    if (!roles?.length) return json({ error: "forbidden_not_admin" }, 403);
    const orgId = roles[0].organization_id;

    const body = await req.json().catch(() => ({}));
    const mode = body?.mode;

    if (mode === "propose") {
      const prompt = (body?.prompt as string ?? "").trim();
      if (!prompt) return json({ error: "missing_prompt" }, 400);
      const proposal = await llmPropose(prompt);

      const { data: row, error } = await admin.from("telecom_admin_ai_actions").insert({
        organization_id: orgId,
        admin_user_id: userId,
        prompt,
        interpreted_action: proposal.interpreted_action ?? null,
        proposed_changes_json: proposal.changes ?? {},
        confirmation_status: proposal.changes?.operation === "info" ? "confirmed" : "pending",
        execution_status: proposal.changes?.operation === "info" ? "success" : "pending",
        execution_result_json: proposal.changes?.operation === "info" ? { info: proposal.changes?.human_summary } : null,
        source: "desktop_app",
      }).select("*").single();
      if (error) return json({ error: "insert_failed", detail: error.message }, 500);
      return json({ action: row });
    }

    if (mode === "execute") {
      const actionId = body?.action_id;
      if (!actionId) return json({ error: "missing_action_id" }, 400);

      const { data: action, error: fetchErr } = await admin.from("telecom_admin_ai_actions")
        .select("*").eq("id", actionId).eq("admin_user_id", userId).maybeSingle();
      if (fetchErr || !action) return json({ error: "action_not_found" }, 404);
      if (action.confirmation_status !== "pending") return json({ error: "already_processed" }, 400);

      const ch = action.proposed_changes_json ?? {};
      let result: any = null;
      let execStatus: "success" | "failed" = "success";

      try {
        const allowed = new Set(["business_hour_schedules", "holiday_schedules"]);
        if (ch.operation === "insert" && allowed.has(ch.table)) {
          const row = { ...ch.row, organization_id: orgId, created_by: userId };
          const { data, error } = await admin.from(ch.table).insert(row).select("*").single();
          if (error) throw error;
          result = data;
        } else if (ch.operation === "update" && allowed.has(ch.table)) {
          const where = { ...ch.where, organization_id: orgId };
          let q = admin.from(ch.table).update(ch.row);
          for (const [k, v] of Object.entries(where)) q = q.eq(k, v as any);
          const { data, error } = await q.select("*");
          if (error) throw error;
          result = data;
        } else {
          result = { skipped: "operation_or_table_not_whitelisted", changes: ch };
        }
      } catch (e) {
        execStatus = "failed";
        result = { error: e instanceof Error ? e.message : String(e) };
      }

      const { data: updated } = await admin.from("telecom_admin_ai_actions").update({
        confirmation_status: "confirmed",
        execution_status: execStatus,
        execution_result_json: result,
        executed_at: new Date().toISOString(),
      }).eq("id", actionId).select("*").single();

      await admin.from("audit_logs").insert({
        organization_id: orgId,
        user_id: userId,
        action: `ai_admin.${ch.operation ?? "unknown"}`,
        resource_type: ch.table ?? "unknown",
        metadata: { source: "ai_admin_chat", proposed: ch, result },
      });

      return json({ action: updated });
    }

    return json({ error: "unknown_mode" }, 400);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: "internal", detail: msg }, 500);
  }
});
