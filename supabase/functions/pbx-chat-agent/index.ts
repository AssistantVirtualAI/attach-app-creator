// pbx-chat-agent: AI chatbot that controls the phone system via fusionpbx-proxy.
// Calls Lovable AI Gateway directly (OpenAI-compatible) with tool calling.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const LEMTEL_ORG = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

type ChatMsg = { role: "system" | "user" | "assistant" | "tool"; content: string; tool_calls?: any[]; tool_call_id?: string; name?: string };

const TOOLS = [
  { type: "function", function: { name: "list_extensions", description: "List phone extensions.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_devices", description: "List SIP devices.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_queues", description: "List call queues.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "list_phone_numbers", description: "List DIDs / phone numbers.", parameters: { type: "object", properties: {} } } },
  { type: "function", function: { name: "recent_calls", description: "Get most recent calls.", parameters: { type: "object", properties: { limit: { type: "integer", minimum: 1, maximum: 50 } } } } },
  { type: "function", function: { name: "create_extension", description: "Create a phone extension (admin only).", parameters: { type: "object", required: ["extension", "display_name"], properties: { extension: { type: "string" }, display_name: { type: "string" }, password: { type: "string" } } } } },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), { status: 500, headers: corsHeaders });

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { messages: incoming, organization_id }: { messages: { role: string; content: string }[]; organization_id?: string } = await req.json();
    const orgId = organization_id || LEMTEL_ORG;

    const { data: roleRow } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("organization_id", orgId).maybeSingle();
    const role = roleRow?.role || "agent";
    const isAdmin = role === "super_admin" || role === "org_admin";

    const callPbx = async (action: string, params: Record<string, any> = {}) => {
      const res = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/fusionpbx-proxy`, {
        method: "POST",
        headers: { Authorization: authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: orgId, action, params }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.ok === false) return { ok: false, error: data?.message || `${action} failed (${res.status})` };
      return { ok: true, data: data?.data ?? data };
    };

    const runTool = async (name: string, args: any) => {
      try {
        switch (name) {
          case "list_extensions": return await callPbx("list-extensions");
          case "list_devices":    return await callPbx("list-devices");
          case "list_queues":     return await callPbx("list-queues");
          case "list_phone_numbers": {
            const { data } = await sb.from("phone_numbers").select("e164, assigned_to, kind").eq("organization_id", orgId);
            return { ok: true, data };
          }
          case "recent_calls": {
            const lim = Math.min(50, Math.max(1, args?.limit || 10));
            const { data } = await sb.from("pbx_call_records")
              .select("caller_number, destination_number, direction, call_status, start_at, duration_seconds")
              .eq("organization_id", orgId).order("start_at", { ascending: false }).limit(lim);
            return { ok: true, data };
          }
          case "create_extension":
            if (!isAdmin) return { ok: false, error: "Admin role required" };
            return await callPbx("create-extension", args);
          default: return { ok: false, error: `Unknown tool: ${name}` };
        }
      } catch (e: any) { return { ok: false, error: e?.message || String(e) }; }
    };

    const conv: ChatMsg[] = [
      { role: "system", content: `You are AVA, the Lemtel Telecom phone-system assistant. The user's role is "${role}". You can read PBX state and (if admin) make changes via tools. Be concise. Reply in the user's language (French or English).` },
      ...incoming.map((m) => ({ role: m.role as any, content: m.content })),
    ];

    const toolCalls: { name: string; input: any }[] = [];

    for (let step = 0; step < 6; step++) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Lovable-API-Key": lovableKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: conv,
          tools: TOOLS,
          tool_choice: "auto",
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        if (res.status === 429) return new Response(JSON.stringify({ error: "Rate limit exceeded, please retry later." }), { status: 429, headers: corsHeaders });
        if (res.status === 402) return new Response(JSON.stringify({ error: "Workspace credits exhausted." }), { status: 402, headers: corsHeaders });
        return new Response(JSON.stringify({ error: `AI gateway ${res.status}: ${errText.slice(0, 300)}` }), { status: 500, headers: corsHeaders });
      }
      const data = await res.json();
      const choice = data.choices?.[0];
      const msg = choice?.message;
      if (!msg) break;

      if (msg.tool_calls?.length) {
        conv.push({ role: "assistant", content: msg.content || "", tool_calls: msg.tool_calls });
        for (const tc of msg.tool_calls) {
          const name = tc.function?.name;
          let args: any = {};
          try { args = JSON.parse(tc.function?.arguments || "{}"); } catch {}
          const result = await runTool(name, args);
          toolCalls.push({ name, input: args });
          conv.push({ role: "tool", tool_call_id: tc.id, name, content: JSON.stringify(result).slice(0, 8000) });
        }
        continue;
      }

      return new Response(JSON.stringify({ text: msg.content || "", toolCalls }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text: "(Max tool-call iterations reached.)", toolCalls }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[pbx-chat-agent]", e);
    return new Response(JSON.stringify({ error: e?.message || String(e) }), { status: 500, headers: corsHeaders });
  }
});
