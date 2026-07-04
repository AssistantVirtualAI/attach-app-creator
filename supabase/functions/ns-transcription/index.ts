import { authBroker, corsHeaders, jsonResponse, logAudit, nsBrokerFetch, nsEnv } from "../_shared/ns-broker.ts";

type Seg = { speaker: string; text: string; start?: number; end?: number };

function parseSegments(input: any): Seg[] {
  if (!input) return [];
  if (typeof input === "string") {
    return input.split("\n").filter((l) => l.trim()).map((line) => {
      const colon = line.indexOf(":");
      if (colon > 0 && colon < 30) {
        return { speaker: line.substring(0, colon).trim(), text: line.substring(colon + 1).trim() };
      }
      return { speaker: "Unknown", text: line.trim() };
    });
  }
  if (Array.isArray(input)) {
    return input.map((s: any) => ({
      speaker: s.speaker ?? s.speaker_label ?? s.role ?? "Speaker",
      text: s.text ?? s.content ?? s.transcript ?? "",
      start: s.start_time ?? s.start ?? undefined,
      end: s.end_time ?? s.end ?? undefined,
    }));
  }
  if (typeof input === "object") {
    if (Array.isArray((input as any).segments)) return parseSegments((input as any).segments);
    if (Array.isArray((input as any).words)) return parseSegments((input as any).words);
    if (typeof (input as any).transcript === "string" || typeof (input as any).text === "string") {
      return parseSegments((input as any).transcript ?? (input as any).text);
    }
  }
  return [];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  console.log("=== ns-transcription called ===", req.method);
  try {
    const auth = await authBroker(req);
    if ("error" in auth) { console.log("authBroker failed"); return auth.error; }
    const { admin, profile } = auth;
    const env = nsEnv();
    console.log("auth ok — extension:", profile.extension, "domain:", env.domain);

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const url = new URL(req.url);
    const callId: string = body.call_id ?? body.callId ?? body.cdr_id ?? url.searchParams.get("call_id") ?? "";
    if (!callId) return jsonResponse({ success: false, error: "call_id requis" }, 200);
    console.log("callId:", callId);

    const attempts: Array<{ label: string; path: string }> = [
      { label: "cdr_transcription_endpoint", path: `/domains/${encodeURIComponent(env.domain)}/cdrs/${encodeURIComponent(callId)}/transcription` },
      { label: "user_recording_transcription", path: `/domains/${encodeURIComponent(env.domain)}/users/${encodeURIComponent(profile.extension)}/recordings/${encodeURIComponent(callId)}/transcription` },
      { label: "transcriptions_collection", path: `/domains/${encodeURIComponent(env.domain)}/transcriptions?callId=${encodeURIComponent(callId)}` },
      { label: "cdr_field", path: `/domains/${encodeURIComponent(env.domain)}/cdrs/${encodeURIComponent(callId)}` },
    ];

    let source: string | null = null;
    let raw: any = null;
    let segments: Seg[] = [];
    const debug: Array<{ label: string; status: number; keys?: string[] }> = [];

    for (const a of attempts) {
      const res = await nsBrokerFetch(admin, profile, a.path);
      const data = res.ok ? await res.json().catch(() => null) : null;
      const keys = data && typeof data === "object" && !Array.isArray(data) ? Object.keys(data).slice(0, 20) : undefined;
      debug.push({ label: a.label, status: res.status, keys });
      console.log(`attempt ${a.label} → ${res.status}`, keys ? `keys=${keys.join(",")}` : "");
      if (!res.ok || !data) continue;
      let candidate: any = data;
      if (a.label === "cdr_field") {
        candidate = data.transcript ?? data.transcription ?? data["transcript-text"] ?? data["call-transcript"] ?? null;
      } else if (Array.isArray(data)) {
        candidate = data[0] ?? null;
      }
      const segs = parseSegments(candidate);
      if (segs.length > 0) {
        source = a.label;
        raw = candidate;
        segments = segs;
        break;
      }
    }

    if (segments.length === 0) {
      console.log("no transcript found");
      return jsonResponse({
        success: false,
        error: "Transcription non disponible pour cet appel",
        hint: "Contacter NetSapiens pour activer PORTAL_VOICE_TRANSCRIPTION_SENTIMENT = yes sur le domaine.",
        possible_reasons: [
          "PORTAL_VOICE_TRANSCRIPTION_SENTIMENT n'est pas activé sur le domaine NetSapiens.",
          "L'appel n'a pas été enregistré (la transcription requiert un enregistrement).",
          "La transcription est encore en cours (peut prendre 2-5 minutes après l'appel).",
          "Le token NS-API n'a pas accès aux transcriptions pour ce domaine.",
        ],
        action_required: "Contacter l'admin NetSapiens pour activer la transcription.",
        call_id: callId,
        extension: profile.extension,
        attempts: debug,
      }, 200);
    }

    const transcriptText = segments.map((s) => `${s.speaker}: ${s.text}`).join("\n");

    // Persist on planipret_phone_calls (best-effort — call_id might match ns_call_id or id)
    await admin.from("planipret_phone_calls")
      .update({ transcript: transcriptText, transcript_segments: segments })
      .or(`ns_call_id.eq.${callId},id.eq.${callId}`);

    await logAudit(admin, req, {
      user_id: profile.id, action: "TRANSCRIPT_ACCESS",
      resource_type: "transcript", resource_id: callId,
    });

    return jsonResponse({
      success: true,
      call_id: callId,
      raw_source: source,
      segments,
      transcript: transcriptText,
      word_count: segments.reduce((n, s) => n + s.text.split(/\s+/).filter(Boolean).length, 0),
      debug,
    });
  } catch (e) {
    console.error("ns-transcription error", e);
    return jsonResponse({ success: false, error: (e as Error).message ?? "Erreur inconnue" }, 500);
  }
});
