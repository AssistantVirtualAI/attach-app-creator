// pp-ava-chat: Planipret AVA chatbot with structured suggestions.
// Returns { reply, suggestions[], openCoach?, openVoice? } for the mobile UI.
// Uses Lovable AI Gateway. Does NOT alter pp-ava-proactive (cron push) or any other function.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { generateText, Output } from "npm:ai";
import { z } from "npm:zod";
import { createLovableAiGatewayProvider } from "../_shared/ai-gateway.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const SuggestionSchema = z.object({
  id: z.string(),
  label: z.string(),
  kind: z.enum(["call", "sms", "email", "reminder", "maestro_action", "open_voice", "open_coach"]),
  payload: z.record(z.string(), z.any()).optional(),
});

const OutputSchema = z.object({
  reply: z.string(),
  suggestions: z.array(SuggestionSchema).max(4).optional(),
  openCoach: z.boolean().optional(),
  openVoice: z.boolean().optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const mode: string = String(body?.mode ?? "chat"); // chat | summarize | recommend
    const userMessage: string = String(body?.user_message ?? body?.message ?? "").slice(0, 6000);
    const sessionId: string | null = body?.session_id ? String(body.session_id) : null;
    let history: { role: "user" | "assistant"; content: string }[] = Array.isArray(body?.history)
      ? body.history.slice(-10).map((h: any) => ({ role: h.role === "assistant" ? "assistant" : "user", content: String(h.content ?? "").slice(0, 4000) }))
      : [];
    const context: Record<string, unknown> = (body?.context && typeof body.context === "object") ? body.context : {};
    const level: string = String(body?.level ?? "standard"); // short | standard | detailed

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);
    const { data: lemtelOnly } = await sb.rpc("is_lemtel_only", { _user_id: u.user.id });
    if (lemtelOnly === true) return json({ error: "forbidden_wrong_app", app: "lemtel" }, 403);

    // Light Planipret context
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: profile } = await admin.from("planipret_profiles")
      .select("id, full_name, role, extension")
      .eq("user_id", u.user.id).maybeSingle();

    let appContext = "";
    if (mode === "recommend" && profile?.id) {
      const startDay = new Date(); startDay.setHours(0, 0, 0, 0);
      const [{ data: hot }, { data: missed }, { count: smsUnread }] = await Promise.all([
        admin.from("planipret_phone_calls").select("id, caller_number, started_at, lead_score")
          .eq("user_id", profile.id).gte("lead_score", 7)
          .order("started_at", { ascending: false }).limit(3),
        admin.from("planipret_phone_calls").select("id, caller_number, started_at")
          .eq("user_id", profile.id).eq("status", "missed")
          .order("started_at", { ascending: false }).limit(3),
        admin.from("planipret_phone_messages").select("id", { count: "exact", head: true })
          .eq("user_id", u.user.id).eq("direction", "inbound").is("read_at", null),
      ]);
      appContext = `Contexte courtier: ${profile.full_name ?? ""} (ext ${profile.extension ?? "?"}).
Hot leads récents: ${JSON.stringify(hot ?? [])}
Appels manqués récents: ${JSON.stringify(missed ?? [])}
SMS non lus: ${smsUnread ?? 0}`;
    }

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) return json({ reply: "(Lovable AI non configuré)", suggestions: [] });

    const gateway = createLovableAiGatewayProvider(lovableKey);

    let system = `Tu es AVA, l'assistante d'un courtier hypothécaire au Québec.
Réponds en français, court et actionnable. Tu peux proposer jusqu'à 4 suggestions (kind: call/sms/email/reminder/maestro_action/open_voice/open_coach).
Pour 'call'/'sms' mets payload.number. Pour 'email' payload.to/subject. Pour 'reminder' payload.title/due_at. Pour 'maestro_action' payload.action et payload.* requis.
Mets openVoice=true seulement si l'utilisateur demande explicitement de parler. Mets openCoach=true si une action de coaching multi-étapes serait utile.`;

    if (mode === "summarize") {
      const len = level === "short" ? "1 phrase" : level === "detailed" ? "résumé détaillé + points clés + prochaine étape" : "3 phrases + une action recommandée";
      system = `Tu es AVA. Résume le contenu fourni en ${len}, en français, professionnel. Ne propose pas de suggestions sauf si pertinent (max 2).`;
    }

    const prompt = [
      appContext && `[Contexte]\n${appContext}`,
      context && Object.keys(context).length ? `[Données]\n${JSON.stringify(context).slice(0, 4000)}` : "",
      history.length ? `[Historique]\n${history.map(h => `${h.role}: ${h.content}`).join("\n")}` : "",
      userMessage ? `[Demande]\n${userMessage}` : (mode === "recommend" ? "[Demande]\nDonne-moi 3 recommandations actionnables pour les prochaines heures." : ""),
    ].filter(Boolean).join("\n\n");

    let result: any = { reply: "", suggestions: [] };
    try {
      const r = await generateText({
        model: gateway("google/gemini-3-flash-preview"),
        system,
        prompt,
        experimental_output: Output.object({ schema: OutputSchema }),
      });
      const out = (r as any).experimental_output ?? (r as any).output;
      result = OutputSchema.parse(out);
    } catch (e) {
      console.error("pp-ava-chat parse fail", e);
      // Fallback: plain text
      try {
        const r2 = await generateText({
          model: gateway("google/gemini-3-flash-preview"),
          system,
          prompt,
        });
        result = { reply: r2.text ?? "Désolé, je n'ai pas pu répondre.", suggestions: [] };
      } catch (e2) {
        return json({ reply: "Désolé, je rencontre un problème. Réessayez.", suggestions: [], error: String(e2) }, 200);
      }
    }

    return json(result);
  } catch (e) {
    console.error("pp-ava-chat error", e);
    return json({ error: String(e) }, 500);
  }
});
