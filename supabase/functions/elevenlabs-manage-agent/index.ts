// ElevenLabs Management API — admin-only edge function used by the
// Planiprêt admin "Intégrations" page to create, configure, and sync
// the AVA conversational agent without touching the ElevenLabs dashboard.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { buildAvaToolsArray } from "../_shared/ava-tools.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const EL_API = "https://api.elevenlabs.io/v1";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function elFetch(apiKey: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${EL_API}${path}`, {
    ...init,
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  const text = await r.text();
  let data: any = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { raw: text }; }
  if (!r.ok) {
    return { ok: false, status: r.status, error: data?.detail?.message || data?.message || data?.detail || text || `HTTP ${r.status}`, data };
  }
  return { ok: true, status: r.status, data };
}

async function getConfig(admin: any, key: string): Promise<string | null> {
  const { data } = await admin.from("planipret_elevenlabs_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function setConfig(admin: any, key: string, value: string, userId: string) {
  await admin.from("planipret_elevenlabs_config").upsert(
    { key, value, updated_by: userId, updated_at: new Date().toISOString() },
    { onConflict: "key" },
  );
}

async function broadcastSetup(admin: any, userId: string, payload: any) {
  try {
    const channel = admin.channel(`elevenlabs-setup:${userId}`);
    await channel.send({ type: "broadcast", event: "progress", payload });
    await admin.removeChannel(channel);
  } catch {/* noop */}
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "method_not_allowed" }, 405);

  // Auth + admin check
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await userClient.auth.getUser();
  if (authErr || !user) return json({ success: false, error: "unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const { data: isAdmin } = await admin.rpc("is_planipret_admin", { _user_id: user.id });
  if (!isAdmin) return json({ success: false, error: "forbidden_admin_only" }, 403);

  const apiKey = Deno.env.get("ELEVENLABS_API_KEY") ?? "";
  if (!apiKey) return json({ success: false, error: "elevenlabs_api_key_missing" }, 500);

  const body = await req.json().catch(() => ({}));
  const { action, payload } = body ?? {};
  if (!action) return json({ success: false, error: "action_required" }, 400);

  let agentId = await getConfig(admin, "agent_id") || Deno.env.get("ELEVENLABS_DEFAULT_AGENT_ID") || "";

  try {
    switch (action) {
      case "test_connection": {
        const r = await elFetch(apiKey, "/user");
        if (!r.ok) return json({ success: false, error: r.error, status: r.status });
        return json({ success: true, user: r.data });
      }

      case "get_all_voices": {
        const r = await elFetch(apiKey, "/voices");
        if (!r.ok) return json({ success: false, error: r.error });
        const voices = (r.data?.voices ?? []).map((v: any) => ({
          voice_id: v.voice_id, name: v.name, preview_url: v.preview_url,
          category: v.category, labels: v.labels,
        }));
        return json({ success: true, voices });
      }

      case "get_agent": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`);
        if (!r.ok) return json({ success: false, error: r.error, status: r.status });
        return json({ success: true, agent: r.data, agent_id: agentId });
      }

      case "list_llms": {
        const r = await elFetch(apiKey, "/convai/llm-prices");
        if (!r.ok) return json({ success: false, error: r.error, status: r.status });
        const llms = (r.data?.llm_prices ?? r.data?.llms ?? []).map((x: any) => x.llm ?? x.model ?? x).filter(Boolean);
        return json({ success: true, llms });
      }

      case "create_agent": {
        // Pick a supported Claude model dynamically (the old "claude-3-5-sonnet" is deprecated by ElevenLabs).
        let chosenLlm = payload?.llm as string | undefined;
        if (!chosenLlm) {
          const pricesRes = await elFetch(apiKey, "/convai/llm-prices");
          const llms: string[] = ((pricesRes.data?.llm_prices ?? pricesRes.data?.llms ?? []) as any[])
            .map((x) => x.llm ?? x.model ?? x).filter(Boolean);
          chosenLlm = llms.find((m) => /claude.*sonnet/i.test(m))
            || llms.find((m) => /claude/i.test(m))
            || llms.find((m) => /gemini.*flash/i.test(m))
            || llms[0]
            || "gemini-2.0-flash-001";
        }

        const createBody = {
          name: payload?.name || "AVA — Planiprêt AI Portal",
          conversation_config: {
            agent: {
              prompt: {
                prompt: payload?.system_prompt || "Tu es AVA, l'assistante vocale IA de Planiprêt. Tu aides les courtiers hypothécaires à gérer leurs appels, SMS, emails et tâches CRM. Tu parles en français canadien. Tu es professionnelle et efficace.",
                llm: chosenLlm,
                temperature: payload?.temperature ?? 0.7,
                max_tokens: payload?.max_tokens ?? 500,
                tools: [],
              },
              first_message: payload?.first_message || "Bonjour! Je suis AVA, votre assistante IA Planiprêt. Comment puis-je vous aider?",
              language: payload?.language || "fr",
            },
            tts: {
              model_id: "eleven_turbo_v2_5",
              voice_id: payload?.voice_id || "XB0fDUnXU5powFXDhCwa",
              agent_output_audio_format: "pcm_16000",
              optimize_streaming_latency: 4,
              stability: 0.6, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true,
            },
            conversation: {
              max_duration_seconds: 1800,
              client_events: ["audio","interruption","user_transcript","agent_response","agent_response_correction"],
            },
          },
          platform_settings: { widget: { is_disabled: true } },
        };
        let r = await elFetch(apiKey, "/convai/agents/create", { method: "POST", body: JSON.stringify(createBody) });

        // Retry once with a guaranteed-available fallback if the LLM was rejected.
        if (!r.ok && /llm|model/i.test(String(r.error))) {
          await broadcastSetup(admin, user.id, { type: "setup_error", step: "create_agent", error: `LLM ${chosenLlm} refusé — retry avec gemini-2.0-flash-001` });
          createBody.conversation_config.agent.prompt.llm = "gemini-2.0-flash-001";
          r = await elFetch(apiKey, "/convai/agents/create", { method: "POST", body: JSON.stringify(createBody) });
        }

        if (!r.ok) {
          const hint = /llm|model/i.test(String(r.error))
            ? `Modèle LLM rejeté par ElevenLabs (${chosenLlm}). La clé Claude (ANTHROPIC_API_KEY) n'est pas utilisée ici — c'est ElevenLabs qui choisit le modèle.`
            : r.error;
          return json({ success: false, error: hint, status: r.status, raw: r.data });
        }
        const newId = r.data?.agent_id;
        if (newId) {
          await setConfig(admin, "agent_id", newId, user.id);
          await setConfig(admin, "voice_id", createBody.conversation_config.tts.voice_id, user.id);
          await setConfig(admin, "llm", createBody.conversation_config.agent.prompt.llm, user.id);
          await setConfig(admin, "setup_completed", "true", user.id);
        }
        return json({ success: true, agent_id: newId, llm_used: createBody.conversation_config.agent.prompt.llm });
      }

      case "update_agent": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, { method: "PATCH", body: JSON.stringify(payload || {}) });
        if (!r.ok) return json({ success: false, error: r.error, status: r.status });
        return json({ success: true, agent: r.data });
      }

      case "sync_all_tools": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const tools = buildAvaToolsArray(SUPABASE_URL, SUPABASE_ANON_KEY);
        // Broadcast progress per tool (optimistic — real PATCH is single call).
        for (let i = 0; i < tools.length; i++) {
          await broadcastSetup(admin, user.id, { type: "tool_added", tool_name: tools[i].name, count: i + 1, total: tools.length });
        }
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify({ conversation_config: { agent: { prompt: { tools } } } }),
        });
        if (!r.ok) {
          await broadcastSetup(admin, user.id, { type: "setup_error", step: "sync_all_tools", error: r.error });
          return json({ success: false, error: r.error, status: r.status });
        }
        await setConfig(admin, "tools_count", String(tools.length), user.id);
        await setConfig(admin, "tools_synced_at", new Date().toISOString(), user.id);
        await broadcastSetup(admin, user.id, { type: "setup_complete", agent_id: agentId, tools_count: tools.length });
        return json({ success: true, tools_synced: tools.length, agent_id: agentId, message: `${tools.length} outils synchronisés avec succès` });
      }

      case "update_voice": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const ts = payload?.tts_settings || {};
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify({
            conversation_config: {
              tts: {
                voice_id: payload.voice_id,
                model_id: "eleven_turbo_v2_5",
                stability: ts.stability ?? 0.6,
                similarity_boost: ts.similarity_boost ?? 0.8,
                style: ts.style ?? 0.3,
                use_speaker_boost: true,
                optimize_streaming_latency: 4,
              },
            },
          }),
        });
        if (!r.ok) return json({ success: false, error: r.error });
        await setConfig(admin, "voice_id", payload.voice_id, user.id);
        return json({ success: true });
      }

      case "update_system_prompt": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify({ conversation_config: { agent: { prompt: { prompt: payload.system_prompt } } } }),
        });
        if (!r.ok) return json({ success: false, error: r.error });
        return json({ success: true });
      }

      case "update_llm": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify({ conversation_config: { agent: { prompt: { llm: payload.llm, temperature: payload.temperature, max_tokens: payload.max_tokens } } } }),
        });
        if (!r.ok) return json({ success: false, error: r.error });
        await setConfig(admin, "llm", payload.llm, user.id);
        return json({ success: true });
      }

      case "get_agent_stats": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const r = await elFetch(apiKey, `/convai/conversations?agent_id=${agentId}&page_size=100`);
        if (!r.ok) return json({ success: false, error: r.error });
        const conversations = r.data?.conversations ?? [];
        const total = conversations.length;
        const avgDuration = total ? conversations.reduce((s: number, c: any) => s + (c.call_duration_secs ?? 0), 0) / total : 0;
        const errors = conversations.filter((c: any) => c.status === "failed").length;
        return json({
          success: true,
          stats: {
            total_conversations: total,
            avg_duration_seconds: Math.round(avgDuration),
            error_rate: total ? Math.round((errors / total) * 100) : 0,
          },
        });
      }

      case "test_agent": {
        // ElevenLabs does not expose a simple /test endpoint — return a 501-style hint.
        return json({ success: false, error: "Tester via la session vocale dans l'app mobile (AVA)." });
      }

      case "delete_tool": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const cur = await elFetch(apiKey, `/convai/agents/${agentId}`);
        if (!cur.ok) return json({ success: false, error: cur.error });
        const existing: any[] = cur.data?.conversation_config?.agent?.prompt?.tools ?? [];
        const filtered = existing.filter((t) => t.name !== payload?.tool_name);
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify({ conversation_config: { agent: { prompt: { tools: filtered } } } }),
        });
        if (!r.ok) return json({ success: false, error: r.error });
        return json({ success: true, remaining: filtered.length });
      }

      case "add_single_tool": {
        if (!agentId) return json({ success: false, error: "no_agent_configured" });
        const cur = await elFetch(apiKey, `/convai/agents/${agentId}`);
        if (!cur.ok) return json({ success: false, error: cur.error });
        const existing: any[] = cur.data?.conversation_config?.agent?.prompt?.tools ?? [];
        const next = [...existing, payload.tool];
        const r = await elFetch(apiKey, `/convai/agents/${agentId}`, {
          method: "PATCH",
          body: JSON.stringify({ conversation_config: { agent: { prompt: { tools: next } } } }),
        });
        if (!r.ok) return json({ success: false, error: r.error });
        return json({ success: true, count: next.length });
      }

      case "list_expected_tools": {
        const tools = buildAvaToolsArray(SUPABASE_URL, SUPABASE_ANON_KEY);
        return json({ success: true, tools: tools.map((t) => ({ name: t.name, description: t.description })) });
      }

      case "get_config": {
        const { data } = await admin.from("planipret_elevenlabs_config").select("key, value, updated_at");
        return json({ success: true, config: data ?? [] });
      }

      default:
        return json({ success: false, error: `unknown_action: ${action}` }, 400);
    }
  } catch (e) {
    return json({ success: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
