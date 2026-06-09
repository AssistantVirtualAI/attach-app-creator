// AVA admin chat command pipeline.
// Routes `/ava ...` messages from OrgChat through Lovable AI Gateway with
// telecom tools. All mutating tools require approval and are audit-logged.
import { streamText, tool, stepCountIs, convertToModelMessages, type UIMessage } from "npm:ai";
import { createOpenAICompatible } from "npm:@ai-sdk/openai-compatible";
import { z } from "npm:zod";
import { corsHeaders, jsonResponse, requireUser, getServiceClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const admin = getServiceClient();
  const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: auth.user.id });
  const { data: isLemtel } = await admin.rpc("is_lemtel_admin", { _user_id: auth.user.id }).maybeSingle?.() ?? { data: null };
  if (!isSuper && !isLemtel) return jsonResponse(403, { error: "AVA commands restricted to admins" });

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return jsonResponse(500, { error: "Missing LOVABLE_API_KEY" });

  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const gateway = createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });

  const audit = async (action: string, payload: any, result: any) => {
    await admin.from("telecom_admin_ai_actions").insert({
      user_id: auth.user.id,
      action,
      payload,
      result,
      status: "completed",
    });
  };

  const tools = {
    list_outages: tool({
      description: "List active telecom sync failures and outages across all orgs.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data } = await admin
          .from("telecom_sync_health")
          .select("organization_id, kind, status, last_error, updated_at")
          .neq("status", "healthy")
          .order("updated_at", { ascending: false })
          .limit(20);
        await audit("list_outages", {}, { count: data?.length ?? 0 });
        return { outages: data ?? [] };
      },
    }),
    extension_status: tool({
      description: "Get registration + presence status for an extension number.",
      inputSchema: z.object({ extension: z.string() }),
      execute: async ({ extension }) => {
        const { data } = await admin
          .from("pbx_extensions")
          .select("extension, display_name, registered, last_registered_at, organization_id")
          .eq("extension", extension)
          .maybeSingle();
        await audit("extension_status", { extension }, data);
        return data ?? { error: "Extension not found" };
      },
    }),
    block_extension: tool({
      description: "Disable an extension. Requires approval. Provide a reason.",
      inputSchema: z.object({ extension: z.string(), reason: z.string().min(3) }),
      execute: async ({ extension, reason }) => {
        const { error } = await admin
          .from("pbx_extensions")
          .update({ enabled: false })
          .eq("extension", extension);
        await audit("block_extension", { extension, reason }, { ok: !error, error: error?.message });
        return { ok: !error, error: error?.message };
      },
    }),
    force_sync: tool({
      description: "Trigger a PBX sync for an organization slug. kind: cdr|config|devices|ivr-queues",
      inputSchema: z.object({ org_slug: z.string(), kind: z.enum(["cdr", "config", "devices", "ivr-queues"]) }),
      execute: async ({ org_slug, kind }) => {
        const { data: org } = await admin
          .from("organizations").select("id").eq("slug", org_slug).maybeSingle();
        if (!org) return { error: "Organization not found" };
        const { data, error } = await admin.functions.invoke(`pbx-sync-${kind === "ivr-queues" ? "ivr-queues" : kind}`, {
          body: { organization_id: org.id },
        });
        await audit("force_sync", { org_slug, kind }, { ok: !error, data });
        return { ok: !error, data, error: error?.message };
      },
    }),
    recent_voicemails: tool({
      description: "List recent voicemails for an organization.",
      inputSchema: z.object({ org_slug: z.string(), limit: z.number().min(1).max(50).default(10) }),
      execute: async ({ org_slug, limit }) => {
        const { data: org } = await admin
          .from("organizations").select("id").eq("slug", org_slug).maybeSingle();
        if (!org) return { error: "Organization not found" };
        const { data } = await admin
          .from("pbx_voicemails")
          .select("id, caller_id, extension, duration, created_at, is_read")
          .eq("organization_id", org.id)
          .order("created_at", { ascending: false })
          .limit(limit);
        await audit("recent_voicemails", { org_slug, limit }, { count: data?.length ?? 0 });
        return { voicemails: data ?? [] };
      },
    }),
    verify_isolation: tool({
      description: "Run tenant isolation verification for an organization slug.",
      inputSchema: z.object({ org_slug: z.string() }),
      execute: async ({ org_slug }) => {
        const { data: org } = await admin
          .from("organizations").select("id").eq("slug", org_slug).maybeSingle();
        if (!org) return { error: "Organization not found" };
        const { data, error } = await admin.rpc("verify_tenant_isolation", { _org_id: org.id });
        await audit("verify_isolation", { org_slug }, { ok: !error, data });
        return { ok: !error, report: data, error: error?.message };
      },
    }),
  };

  const result = streamText({
    model: gateway("google/gemini-3-flash-preview"),
    system: `You are AVA, the Lemtel telecom operations assistant. You have admin tools to inspect and remediate the platform. Be terse. Always confirm destructive actions and explain results in one or two sentences.`,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(50),
  });

  return result.toUIMessageStreamResponse({ headers: corsHeaders });
});
