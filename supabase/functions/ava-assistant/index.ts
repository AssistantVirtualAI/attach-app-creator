// ava-assistant: unified agentic chatbot for Mobile, Desktop, and Web.
// - Read tools: calls, recordings, voicemails, sms, contacts, presence, extensions
// - Analyze tools: recording transcript + ai summary
// - Report tool: aggregate volume / missed / talk-time / per extension
// - Action tools (require confirm:true): send_sms, click_to_call, blind_transfer
//
// All data is scoped to the caller's PBX domain (organization_id resolved from
// pbx_softphone_users for the authenticated user). Admins see whole domain;
// regular users still see whole domain per product decision.
import { generateText, tool, stepCountIs } from "npm:ai";
import { z } from "npm:zod";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type ChatMsg = { role: "user" | "assistant" | "system"; content: string };

function normalizeBody(body: any): ChatMsg[] {
  // Accept either {messages:[{role,content}]} or {message,history}
  if (Array.isArray(body?.messages)) {
    return body.messages
      .filter((m: any) => m && typeof m.content === "string" && (m.role === "user" || m.role === "assistant" || m.role === "system"))
      .slice(-24)
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, 8000) }));
  }
  const out: ChatMsg[] = [];
  if (Array.isArray(body?.history)) {
    for (const h of body.history.slice(-12)) {
      if (h?.role === "user" || h?.role === "assistant") {
        out.push({ role: h.role, content: String(h.content || "").slice(0, 8000) });
      }
    }
  }
  if (typeof body?.message === "string" && body.message.trim()) {
    out.push({ role: "user", content: body.message.slice(0, 8000) });
  }
  return out;
}

const e164 = (n: string) => {
  const d = String(n).replace(/[^\d+]/g, "");
  if (d.startsWith("+")) return d;
  if (d.length === 10) return "+1" + d;
  if (d.length === 11 && d.startsWith("1")) return "+" + d;
  return d;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const rid = crypto.randomUUID().slice(0, 8);
  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) return json({ answer: "AVA is not configured yet (missing AI key)." });

    const body = await req.json().catch(() => ({}));
    const messages = normalizeBody(body);
    if (messages.length === 0) return json({ error: "no_messages" }, 400);

    // Resolve caller scope
    const { data: spu } = await admin
      .from("pbx_softphone_users")
      .select("organization_id, extension, display_name, sip_domain, domain_uuid")
      .eq("portal_user_id", u.user.id)
      .maybeSingle();

    const orgId: string | null = spu?.organization_id ?? null;
    const myExt: string | null = spu?.extension ?? null;
    const domainUuid: string | null = spu?.domain_uuid ?? null;
    const sipDomain: string | null = spu?.sip_domain ?? null;

    if (!orgId) {
      // Still answer, but with no tools.
      const gateway = createLovableAiGatewayProvider(apiKey);
      const { text } = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system: "You are AVA, the in-app AI assistant. The user has no PBX extension linked yet, so you cannot read their calls or SMS. Answer concisely and tell them to link a softphone extension first.",
        messages,
      });
      return json({ answer: text });
    }

    // Audit helper
    const audit = (action: string, payload: any, result: any, ok = true) =>
      admin.from("telecom_admin_ai_actions").insert({
        user_id: u.user.id,
        action,
        payload,
        result,
        status: ok ? "completed" : "failed",
      }).then(() => {}, () => {});

    const domainScope = <T>(q: any) =>
      domainUuid
        ? (q.eq("organization_id", orgId).or(`domain_uuid.eq.${domainUuid},domain_uuid.is.null`) as T)
        : (q.eq("organization_id", orgId) as T);

    const tools: Record<string, any> = {
      // -------- READ TOOLS --------
      list_calls: tool({
        description: "List recent call records in the caller's PBX domain. Filters: extension number, days (1-30), direction, missed only.",
        inputSchema: z.object({
          days: z.number().int().min(1).max(30).default(7),
          extension: z.string().optional(),
          direction: z.enum(["inbound", "outbound", "any"]).default("any"),
          missed_only: z.boolean().default(false),
          limit: z.number().int().min(1).max(100).default(25),
        }),
        execute: async ({ days, extension, direction, missed_only, limit }) => {
          const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
          let q: any = admin.from("pbx_call_records")
            .select("id, direction, missed_call, caller_number, caller_name, destination_number, extension, start_at, duration_seconds, has_recording, ai_summary")
            .gte("start_at", since.toISOString());
          q = domainScope(q);
          if (extension) q = q.or(`extension.eq.${extension},caller_number.eq.${extension},destination_number.eq.${extension}`);
          if (direction !== "any") q = q.eq("direction", direction);
          if (missed_only) q = q.eq("missed_call", true);
          const { data, error } = await q.order("start_at", { ascending: false }).limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, calls: data ?? [] };
        },
      }),

      list_recordings: tool({
        description: "List call recordings with metadata. Use analyze_recording to read transcript + summary.",
        inputSchema: z.object({
          days: z.number().int().min(1).max(30).default(7),
          extension: z.string().optional(),
          limit: z.number().int().min(1).max(50).default(20),
        }),
        execute: async ({ days, extension, limit }) => {
          const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
          let q: any = admin.from("pbx_call_records")
            .select("id, pbx_uuid, caller_number, caller_name, destination_number, extension, start_at, duration_seconds, transcribed, ai_summary, has_recording")
            .eq("has_recording", true).gte("start_at", since.toISOString());
          q = domainScope(q);
          if (extension) q = q.or(`extension.eq.${extension},caller_number.eq.${extension},destination_number.eq.${extension}`);
          const { data, error } = await q.order("start_at", { ascending: false }).limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, recordings: data ?? [] };
        },
      }),

      analyze_recording: tool({
        description: "Fetch transcript and AI summary/sentiment for a call recording by call id (pbx_call_records.id).",
        inputSchema: z.object({ call_id: z.string().uuid() }),
        execute: async ({ call_id }) => {
          const { data: rec } = await admin.from("pbx_call_records")
            .select("id, organization_id, ai_summary, sentiment, transcribed, has_recording")
            .eq("id", call_id).maybeSingle();
          if (!rec || rec.organization_id !== orgId) return { error: "call_not_found_in_domain" };
          const { data: tr } = await admin.from("pbx_call_transcripts")
            .select("text, language, created_at").eq("call_record_id", call_id).maybeSingle();
          const { data: ins } = await admin.from("pbx_ai_insights")
            .select("summary, sentiment, action_items, topics, intents, key_phrases, created_at")
            .eq("call_record_id", call_id).maybeSingle();
          if (!tr && !ins && rec.has_recording && !rec.transcribed) {
            await admin.from("pbx_ai_jobs").insert({
              organization_id: orgId, call_record_id: call_id, kind: "process_recording", status: "pending"
            }).then(() => {}, () => {});
            return { status: "queued_for_processing", call_id };
          }
          return {
            call_id,
            transcript: tr?.text ?? null,
            ai_summary: ins?.summary ?? rec.ai_summary ?? null,
            sentiment: ins?.sentiment ?? rec.sentiment ?? null,
            action_items: ins?.action_items ?? null,
            topics: ins?.topics ?? null,
          };
        },
      }),

      list_voicemails: tool({
        description: "List voicemails for an extension (defaults to caller's extension).",
        inputSchema: z.object({
          extension: z.string().optional(),
          unread_only: z.boolean().default(false),
          limit: z.number().int().min(1).max(50).default(20),
        }),
        execute: async ({ extension, unread_only, limit }) => {
          const ext = extension || myExt;
          let q: any = admin.from("pbx_voicemails")
            .select("id, extension, caller_number, caller_name, duration, created_at, read_at")
            .eq("organization_id", orgId);
          if (ext) q = q.eq("extension", ext);
          if (unread_only) q = q.is("read_at", null);
          const { data, error } = await q.order("created_at", { ascending: false }).limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, voicemails: data ?? [] };
        },
      }),

      list_sms_threads: tool({
        description: "List SMS threads in the domain.",
        inputSchema: z.object({ limit: z.number().int().min(1).max(50).default(20) }),
        execute: async ({ limit }) => {
          const { data, error } = await admin.from("pbx_sms_threads")
            .select("id, contact_number, contact_name, last_message_at, unread_count")
            .eq("organization_id", orgId).order("last_message_at", { ascending: false }).limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, threads: data ?? [] };
        },
      }),

      list_sms_messages: tool({
        description: "Read messages in an SMS thread.",
        inputSchema: z.object({ thread_id: z.string().uuid(), limit: z.number().int().min(1).max(100).default(40) }),
        execute: async ({ thread_id, limit }) => {
          const { data: t } = await admin.from("pbx_sms_threads").select("organization_id").eq("id", thread_id).maybeSingle();
          if (!t || t.organization_id !== orgId) return { error: "thread_not_found_in_domain" };
          const { data, error } = await admin.from("pbx_sms_messages")
            .select("id, direction, body, from_number, to_number, status, created_at")
            .eq("thread_id", thread_id).order("created_at", { ascending: true }).limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, messages: data ?? [] };
        },
      }),

      list_contacts: tool({
        description: "Search organization contacts by name or phone.",
        inputSchema: z.object({ query: z.string().min(1).max(100), limit: z.number().int().min(1).max(30).default(10) }),
        execute: async ({ query, limit }) => {
          const { data, error } = await admin.from("org_contacts")
            .select("id, full_name, primary_number, email, company")
            .eq("organization_id", orgId)
            .or(`full_name.ilike.%${query}%,primary_number.ilike.%${query}%,email.ilike.%${query}%,company.ilike.%${query}%`)
            .limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, contacts: data ?? [] };
        },
      }),

      list_extensions: tool({
        description: "List PBX extensions in the domain (number, display name, status).",
        inputSchema: z.object({ limit: z.number().int().min(1).max(100).default(50) }),
        execute: async ({ limit }) => {
          const { data, error } = await admin.from("pbx_extensions")
            .select("extension, effective_cid_name, enabled, registered, last_registered_at")
            .eq("organization_id", orgId).order("extension").limit(limit);
          return error ? { error: error.message } : { count: data?.length ?? 0, extensions: data ?? [] };
        },
      }),

      presence_directory: tool({
        description: "Show who is online / busy / away in the domain.",
        inputSchema: z.object({}),
        execute: async () => {
          const { data, error } = await admin.from("user_presence")
            .select("user_id, extension, status, status_message, call_state, last_seen_at")
            .eq("organization_id", orgId).order("status").limit(100);
          return error ? { error: error.message } : { count: data?.length ?? 0, presence: data ?? [] };
        },
      }),

      run_report: tool({
        description: "Aggregate call metrics. group_by: 'day' or 'extension'. metrics: total / answered / missed / talk-minutes.",
        inputSchema: z.object({
          days: z.number().int().min(1).max(30).default(7),
          group_by: z.enum(["day", "extension"]).default("day"),
          extension: z.string().optional(),
        }),
        execute: async ({ days, group_by, extension }) => {
          const since = new Date(); since.setDate(since.getDate() - days); since.setHours(0,0,0,0);
          let q: any = admin.from("pbx_call_records")
            .select("id, direction, missed_call, extension, start_at, duration_seconds")
            .gte("start_at", since.toISOString()).eq("organization_id", orgId);
          if (extension) q = q.or(`extension.eq.${extension},caller_number.eq.${extension},destination_number.eq.${extension}`);
          const { data, error } = await q.limit(5000);
          if (error) return { error: error.message };
          const rows = data ?? [];
          const bucket = new Map<string, { total: number; answered: number; missed: number; talk_minutes: number }>();
          for (const r of rows) {
            const key = group_by === "day"
              ? new Date(r.start_at).toISOString().slice(0, 10)
              : (r.extension || "—");
            const b = bucket.get(key) || { total: 0, answered: 0, missed: 0, talk_minutes: 0 };
            b.total += 1;
            if (r.missed_call) b.missed += 1; else b.answered += 1;
            b.talk_minutes += Math.round(((r.duration_seconds || 0) / 60) * 10) / 10;
            bucket.set(key, b);
          }
          const out = Array.from(bucket.entries()).map(([k, v]) => ({ key: k, ...v }))
            .sort((a, b) => group_by === "day" ? a.key.localeCompare(b.key) : b.total - a.total);
          return { days, group_by, extension: extension || null, rows: out };
        },
      }),

      // -------- ACTION TOOLS (require confirm:true) --------
      send_sms: tool({
        description: "Send an SMS in a thread. Pass confirm:false (default) first to preview; reply with confirm:true after the user approves.",
        inputSchema: z.object({
          thread_id: z.string().uuid(),
          body: z.string().min(1).max(1000),
          confirm: z.boolean().default(false),
        }),
        execute: async ({ thread_id, body, confirm }) => {
          const { data: t } = await admin.from("pbx_sms_threads")
            .select("organization_id, contact_number, contact_name").eq("id", thread_id).maybeSingle();
          if (!t || t.organization_id !== orgId) return { error: "thread_not_found_in_domain" };
          if (!confirm) {
            return { requires_confirmation: true, preview: { action: "send_sms", to: t.contact_number, contact: t.contact_name, body } };
          }
          const { data, error } = await admin.functions.invoke("mobile-sms", {
            body: { threadId: thread_id, body },
            headers: { Authorization: authHeader },
          });
          audit("send_sms", { thread_id, body }, { ok: !error, data, err: error?.message }, !error);
          return error ? { error: error.message } : { ok: true, result: data };
        },
      }),

      click_to_call: tool({
        description: "Place an outbound call from the caller's extension to a phone number. Pass confirm:false (default) first to preview; reply with confirm:true after user approves.",
        inputSchema: z.object({
          to: z.string().min(3).max(20),
          mode: z.enum(["webrtc", "click_to_call"]).default("click_to_call"),
          confirm: z.boolean().default(false),
        }),
        execute: async ({ to, mode, confirm }) => {
          const target = e164(to);
          if (!confirm) return { requires_confirmation: true, preview: { action: "click_to_call", from_extension: myExt, to: target, mode } };
          const { data, error } = await admin.functions.invoke("mobile-calls-start", {
            body: { to: target, mode },
            headers: { Authorization: authHeader },
          });
          audit("click_to_call", { to: target, mode }, { ok: !error, data, err: error?.message }, !error);
          return error ? { error: error.message } : { ok: true, result: data };
        },
      }),

      get_recording_url: tool({
        description: "Issue a short-lived signed URL to play a recording for a given call id.",
        inputSchema: z.object({ call_id: z.string().uuid() }),
        execute: async ({ call_id }) => {
          const { data: rec } = await admin.from("pbx_call_records")
            .select("organization_id, recording_path, recording_name")
            .eq("id", call_id).maybeSingle();
          if (!rec || rec.organization_id !== orgId) return { error: "call_not_found_in_domain" };
          if (!rec.recording_path) return { error: "no_recording" };
          const { data, error } = await admin.storage.from("recordings").createSignedUrl(rec.recording_path, 300);
          return error ? { error: error.message } : { url: data?.signedUrl, name: rec.recording_name };
        },
      }),

      mark_voicemail_read: tool({
        description: "Mark a voicemail as read.",
        inputSchema: z.object({ voicemail_id: z.string().uuid() }),
        execute: async ({ voicemail_id }) => {
          const { error } = await admin.rpc("mark_voicemail_read", { _id: voicemail_id });
          return error ? { error: error.message } : { ok: true };
        },
      }),
    };

    const system = `You are AVA, the AI assistant inside the AVA Softphone (mobile, desktop, and web).
You can read and reason about the user's phone system across their entire PBX domain.
- Caller display name: ${spu?.display_name || "user"}
- Caller extension: ${myExt || "n/a"}
- SIP domain: ${sipDomain || "n/a"}

Rules:
1. Always use tools for live data; never invent calls, voicemails, contacts, or numbers.
2. For mutating actions (send_sms, click_to_call), FIRST call the tool with confirm:false to get a preview, repeat the preview to the user in one short sentence, and ask "Reply 'confirm' to proceed." Only call again with confirm:true after the user explicitly confirms.
3. Be terse — 1-4 sentences unless the user asks for detail. Use bullet lists for multi-row results. Format numbers, dates, and extensions clearly.
4. If a tool returns an error, explain it plainly and suggest the next step.`;

    const gateway = createLovableAiGatewayProvider(apiKey);
    const { text, toolCalls, toolResults, finishReason, usage } = await generateText({
      model: gateway("google/gemini-3-flash-preview"),
      system,
      messages,
      tools,
      stopWhen: stepCountIs(50),
    });

    console.log(JSON.stringify({ fn: "ava-assistant", rid, uid: u.user.id, org: orgId, finishReason, steps: toolCalls?.length ?? 0, usage }));

    return json({
      answer: text || "(no response)",
      toolCalls: (toolCalls || []).map((tc: any) => ({ name: tc.toolName, input: tc.input })),
      toolResults: (toolResults || []).map((tr: any) => ({ name: tr.toolName, output: tr.output })),
    });
  } catch (e: any) {
    console.error("[ava-assistant]", rid, e?.message, e?.stack);
    return json({ error: e?.message || "internal_error" }, 500);
  }
});
