// pbx-chat-agent: AI chatbot that controls the phone system via fusionpbx-proxy.
// Streams responses through Lovable AI Gateway with tool calling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createOpenAICompatible } from "https://esm.sh/@ai-sdk/openai-compatible@0.2.14";
import { generateText, tool, stepCountIs } from "https://esm.sh/ai@5.0.0";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LEMTEL_ORG = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), { status: 500, headers: corsHeaders });

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { messages, organization_id }: { messages: { role: string; content: string }[]; organization_id?: string } = await req.json();
    const orgId = organization_id || LEMTEL_ORG;

    // Resolve caller's role for permission gating.
    const { data: roleRow } = await sb.from("user_roles")
      .select("role").eq("user_id", user.id).eq("organization_id", orgId).maybeSingle();
    const role = roleRow?.role || "agent";
    const isAdmin = role === "super_admin" || role === "org_admin";

    const callPbx = async (action: string, params: Record<string, any> = {}) => {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fusionpbx-proxy`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId, action, params }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) {
        return { ok: false, error: data?.message || `${action} failed (${res.status})` };
      }
      return { ok: true, data: data?.data ?? data };
    };

    const tools = {
      list_extensions: tool({
        description: "List phone extensions in the workspace.",
        inputSchema: z.object({}),
        execute: async () => callPbx("list-extensions"),
      }),
      create_extension: tool({
        description: "Create a new phone extension. Requires admin.",
        inputSchema: z.object({
          extension: z.string().describe("3-5 digit extension number"),
          display_name: z.string().describe("Caller ID display name"),
          password: z.string().optional().describe("SIP password (auto-generated if omitted)"),
        }),
        execute: async (p) => {
          if (!isAdmin) return { ok: false, error: "Admin role required" };
          return callPbx("create-extension", p);
        },
      }),
      list_devices: tool({
        description: "List provisioned SIP devices (desk phones, ATAs).",
        inputSchema: z.object({}),
        execute: async () => callPbx("list-devices"),
      }),
      list_queues: tool({
        description: "List call queues.",
        inputSchema: z.object({}),
        execute: async () => callPbx("list-queues"),
      }),
      list_phone_numbers: tool({
        description: "List DIDs / phone numbers and what they route to.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data } = await sb.from("phone_numbers")
            .select("e164, assigned_to, kind").eq("organization_id", orgId);
          return { ok: true, data };
        },
      }),
      recent_calls: tool({
        description: "Get the most recent calls (history).",
        inputSchema: z.object({ limit: z.number().min(1).max(50).default(10) }),
        execute: async ({ limit }) => {
          const { data } = await sb.from("pbx_call_records")
            .select("caller_number, destination_number, direction, call_status, start_at, duration_seconds")
            .eq("organization_id", orgId)
            .order("start_at", { ascending: false }).limit(limit);
          return { ok: true, data };
        },
      }),
      pause_queue_agent: tool({
        description: "Pause or unpause an agent in a queue.",
        inputSchema: z.object({
          queue_id: z.string(), paused: z.boolean(),
        }),
        execute: async ({ queue_id, paused }) => {
          await sb.rpc("toggle_queue_pause", { _queue_id: queue_id, _paused: paused });
          return { ok: true };
        },
      }),
    };

    const provider = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": lovableKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    });

    const result = await generateText({
      model: provider("google/gemini-2.5-flash"),
      system: `You are AVA, the Lemtel Telecom phone system assistant. The user's role is "${role}". \
You can read PBX state and (if they are admin) make changes via tools. \
Be concise. After tool calls, summarize the outcome in 1-2 sentences. Reply in the user's language (French or English).`,
      messages: messages.map((m) => ({ role: m.role as any, content: m.content })),
      tools,
      stopWhen: stepCountIs(8),
    });

    const toolCalls = (result.steps || []).flatMap((s: any) =>
      (s.toolCalls || []).map((tc: any) => ({ name: tc.toolName, input: tc.input })),
    );
    return new Response(JSON.stringify({ text: result.text, toolCalls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[pbx-chat-agent]", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: corsHeaders });
  }
});
