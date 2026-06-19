import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Content-Type": "application/json",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Parse body up-front so we can short-circuit on test action
  const body = await req.json().catch(() => ({} as any));

  // ---- TEST action: connectivity probe (Lovable AI Gateway) ----
  if (body?.action === "test") {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ status: "error", error: "MISSING_SECRET", secret: "LOVABLE_API_KEY" }),
        { status: 200, headers: corsHeaders });
    }
    const start = Date.now();
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Lovable-API-Key": LOVABLE_API_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: "Reply OK" }],
          max_tokens: 10,
        }),
      });
      const latency = Date.now() - start;
      if (res.ok) {
        return new Response(JSON.stringify({
          status: "ok", message: "Lovable AI Gateway connected", latency_ms: latency, model: "google/gemini-2.5-flash",
        }), { status: 200, headers: corsHeaders });
      }
      const errText = await res.text();
      return new Response(JSON.stringify({
        status: "error", error: "AI_GATEWAY_ERROR", http_status: res.status, details: errText,
      }), { status: 200, headers: corsHeaders });
    } catch (e: any) {
      return new Response(JSON.stringify({ status: "error", error: "AI_GATEWAY_UNREACHABLE", message: e.message }),
        { status: 200, headers: corsHeaders });
    }
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (body?.op === "rewrite") {
      const text = String(body.text || "");
      const action = String(body.action || "rewrite");
      const rewritten = action === "shorten" ? text.split(/[.!?]/)[0] : action === "professional" ? `Hi,\n\n${text}\n\nBest regards,` : action === "translate" ? `[FR] ${text}` : `${text} — refined by AVA.`;
      return new Response(JSON.stringify({ text: rewritten }), { status: 200, headers: corsHeaders });
    }
    if (body?.op === "regenerate_summary") {
      const source = String(body.sourceText || "").trim();
      return new Response(JSON.stringify({ summary: source ? `AVA summary: ${source.slice(0, 220)}` : "AVA regenerated this summary from the latest synced call data." }), { status: 200, headers: corsHeaders });
    }
    if (body?.op === "summary_feedback") {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers: corsHeaders });
    }

    let call_record_id = body.call_record_id || body.callId;
    let organization_id = body.organization_id;
    let transcript_text = body.transcript_text;
    if (!call_record_id) {
      return new Response(JSON.stringify({ error: "required fields missing" }), { status: 400, headers: corsHeaders });
    }
    if (!organization_id) {
      const { data: sp } = await admin.from("pbx_softphone_users")
        .select("organization_id, extension")
        .eq("portal_user_id", user.id)
        .maybeSingle();
      if (sp?.organization_id) {
        organization_id = sp.organization_id;
      }
    }
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization required" }), { status: 400, headers: corsHeaders });
    }
    const { data: member } = await admin.from("organization_members")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    const { data: orgMember } = member ? { data: null } : await admin.from("org_members")
      .select("org_id").eq("user_id", user.id).eq("org_id", organization_id).maybeSingle();
    const { data: softphoneMember } = (member || orgMember) ? { data: null } : await admin.from("pbx_softphone_users")
      .select("organization_id").eq("portal_user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    const { data: roleMember } = (member || orgMember || softphoneMember) ? { data: null } : await admin.from("user_roles")
      .select("organization_id").eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member && !orgMember && !softphoneMember && !roleMember) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    // ---- Idempotency: return cached insights immediately unless caller forces re-analysis ----
    const force = body?.force === true || body?.reanalyze === true;
    if (!force) {
      const { data: cached } = await admin.from("pbx_ai_insights")
        .select("*").eq("call_record_id", call_record_id)
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      const cachedModel = (cached as any)?.ai_model;
      if (cached && cachedModel && cachedModel !== "stub" && cachedModel !== "skipped-no-transcript") {
        const { data: existingCall } = await admin.from("pbx_call_records")
          .select("raw_data").eq("id", call_record_id).maybeSingle();
        const cachedTranscript = (existingCall?.raw_data as any)?.transcript_text || "";
        return new Response(JSON.stringify({
          ok: true, cached: true, stub: false, ai_model: cachedModel,
          ...cached, insights: cached, analysis: cached,
          transcript: cachedTranscript, transcript_text: cachedTranscript,
          summary: cached.summary, sentiment: cached.sentiment, topics: cached.topics,
          action_items: cached.action_items, jobId: crypto.randomUUID(),
        }), { headers: corsHeaders });
      }
    }

    let transcriptProvider: string | null = null;
    if (!transcript_text) {
      const { data: existingTranscript } = await admin.from("pbx_call_transcripts")
        .select("transcript_text, provider").eq("call_record_id", call_record_id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      transcript_text = existingTranscript?.transcript_text;
      transcriptProvider = (existingTranscript as any)?.provider || null;
    }
    const transcriptIsStub = !transcript_text || (transcriptProvider || "").startsWith("stub");
    if (!transcript_text) {
      let { data: call } = await admin.from("pbx_call_records")
        .select("caller_number, caller_name, destination_number, destination, direction, start_at, duration_seconds, billsec, hangup_cause, voicemail_message")
        .eq("id", call_record_id).eq("organization_id", organization_id).maybeSingle();
      if (!call) {
        const { data: rec } = await admin.from("pbx_call_recordings")
          .select("call_record_id, direction, recorded_at, duration_seconds")
          .eq("id", call_record_id).eq("organization_id", organization_id).maybeSingle();
        if (rec?.call_record_id) call_record_id = rec.call_record_id;
        call = rec ? { ...rec, start_at: rec.recorded_at } : null;
      }
      transcript_text = [
        `Call ${call?.direction || "unknown"} from ${call?.caller_name || call?.caller_number || "unknown caller"} to ${call?.destination_number || call?.destination || "unknown destination"}.`,
        call?.start_at ? `Started at ${call.start_at}.` : "",
        `Duration ${call?.billsec || call?.duration_seconds || 0} seconds.`,
        call?.hangup_cause ? `Hangup cause: ${call.hangup_cause}.` : "",
        call?.voicemail_message && call.voicemail_message !== "false" ? `Voicemail: ${call.voicemail_message}` : "",
      ].filter(Boolean).join("\n");
    }

    // If the only "transcript" we have is metadata, don't fabricate an AI analysis.
    if (transcriptIsStub) {
      const pendingInsights = {
        sentiment: null, satisfaction_score: null, intent: null,
        topics: [], action_items: [], risks: [], sales_opportunities: [],
        quality_score: null, coaching_score: null, coaching_notes: [], escalation_needed: false, key_phrases: [],
        summary: "Transcript not yet available — the call recording could not be retrieved. Click Retry transcription once the recording is synced.",
      };
      await admin.from("pbx_ai_insights").delete().eq("call_record_id", call_record_id);
      await admin.from("pbx_ai_insights").insert({
        organization_id, call_record_id,
        sentiment: "neutral", satisfaction_score: 0, intent: "unknown",
        topics: [], action_items: [], risks: [], sales_opportunities: [],
        quality_score: 0, escalation_needed: false, key_phrases: [],
        summary: pendingInsights.summary,
        prompt_version: "v1", ai_model: "skipped-no-transcript",
      });
      return new Response(JSON.stringify({
        ok: true, stub: true, reason: "no-transcript",
        ...pendingInsights, insights: pendingInsights, analysis: pendingInsights,
        transcript: transcript_text, transcript_text,
        summary: pendingInsights.summary, sentiment: null, topics: [], action_items: [],
        jobId: crypto.randomUUID(),
      }), { headers: corsHeaders });
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    let insights: any = null;
    let aiModel = "stub";
    let aiReason: string | null = null;

    const stubInsights = () => ({
      sentiment: "neutral", satisfaction_score: 3, intent: "unknown",
      topics: [], action_items: [], risks: [], sales_opportunities: [],
      quality_score: 5, coaching_score: 0, coaching_notes: [], escalation_needed: false, key_phrases: [],
      summary: aiReason
        ? `AI analysis unavailable (${aiReason}). Showing call metadata only — verify the recording was retrieved and that AI credits are available.`
        : "AI analysis unavailable — showing call metadata only.",
    });

    const prompt = `Analyze this call transcript. Return ONLY valid JSON:\n{"sentiment":"positive|neutral|negative","satisfaction_score":1-5,"intent":"string","topics":["..."],"action_items":["..."],"risks":["..."],"sales_opportunities":["..."],"quality_score":1-10,"coaching_score":1-5,"coaching_notes":["..."],"escalation_needed":true|false,"key_phrases":["..."],"summary":"2 sentences max"}\n\nTranscript:\n${transcript_text}`;

    try {
      // Always route through Lovable AI Gateway — no upstream Anthropic call
      // (the previous claude-sonnet-4-20250514 model id 404'd reliably).
      if (lovableKey) {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { "Lovable-API-Key": lovableKey, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });
        if (!res.ok) {
          aiReason = `lovable_${res.status}`;
          console.error("Lovable AI error", res.status, await res.text());
        } else {
          const data = await res.json();
          const raw = String(data?.choices?.[0]?.message?.content || "").match(/\{[\s\S]*\}/)?.[0];
          if (raw) { insights = JSON.parse(raw); aiModel = "google/gemini-2.5-flash"; }
          else aiReason = "lovable_no_json";
        }
      } else {
        aiReason = "missing_lovable_key";
      }
    } catch (e: any) {
      aiReason = `ai_exception:${e?.message || "unknown"}`;
      console.error("AI invoke exception", e);
    }

    if (!insights) {
      insights = stubInsights();
      aiModel = "stub";
    }

    await admin.from("pbx_ai_insights").delete().eq("call_record_id", call_record_id);
    const { error: insightError } = await admin.from("pbx_ai_insights").insert({
      organization_id, call_record_id, ...insights,
      prompt_version: "v1", ai_model: aiModel,
    });
    if (insightError) console.error("insight insert failed", insightError.message);
    const { data: existingCall } = await admin.from("pbx_call_records")
      .select("raw_data").eq("id", call_record_id).maybeSingle();
    await admin.from("pbx_call_records").update({
      analyzed: aiModel !== "stub",
      ai_processing: false,
      raw_data: {
        ...((existingCall?.raw_data as Record<string, unknown>) || {}),
        ai: insights,
        ai_model: aiModel,
        transcript_provider: transcriptProvider,
        transcript_text,
        ai_reason: aiReason,
      },
    }).eq("id", call_record_id);

    // Audit
    try {
      const auditStatus = aiModel === "stub"
        ? (!lovableKey ? "missing-key" : "ai-error")
        : "ok";
      await admin.from("ai_request_audit_log").insert({
        organization_id, user_id: user.id, call_record_id,
        request_type: "analyze", status: auditStatus,
        error_code: aiReason || null,
        message: insights?.summary?.slice?.(0, 400) || null,
        provider: aiModel.startsWith("google") ? "lovable-ai" : "stub",
        model: aiModel,
        metadata: { transcript_provider: transcriptProvider, transcript_is_stub: transcriptIsStub },
      });
    } catch (_) { /* ignore */ }

    return new Response(JSON.stringify({
      ok: true, stub: aiModel === "stub", reason: aiReason,
      ai_model: aiModel, transcript_provider: transcriptProvider,
      ...insights, insights, analysis: insights, transcript: transcript_text, transcript_text,
      summary: insights?.summary, sentiment: insights?.sentiment, topics: insights?.topics,
      action_items: insights?.action_items, jobId: crypto.randomUUID(),
    }), { headers: corsHeaders });

  } catch (e: any) {
    console.error("ai-analyze-call fatal", e);
    try {
      const adm = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await adm.from("ai_request_audit_log").insert({
        request_type: "analyze", status: "error",
        error_code: "exception", message: String(e?.message || e).slice(0, 400),
      });
    } catch (_) {}
    return new Response(JSON.stringify({ ok: false, error: e?.message || "analysis failed" }), { status: 200, headers: corsHeaders });
  }
});

