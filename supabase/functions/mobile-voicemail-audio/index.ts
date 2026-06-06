// mobile-voicemail-audio: signed playback URL for a voicemail recording.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) return json({ error: "missing_id" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: u } = await sb.auth.getUser();
    if (!u?.user) return json({ error: "unauthorized" }, 401);

    const { data: sp } = await sb.from("pbx_softphone_users")
      .select("organization_id").eq("portal_user_id", u.user.id).maybeSingle();
    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT" }, 404);

    const { data: rec } = await sb.from("pbx_call_records")
      .select("id, organization_id, recording_path, voicemail_path")
      .eq("id", id).maybeSingle();
    if (!rec || rec.organization_id !== sp.organization_id) return json({ error: "not_found" }, 404);

    const path = (rec as any).voicemail_path || (rec as any).recording_path;
    if (!path) return json({ error: "no_recording" }, 404);

    const { data: signed, error } = await sb.storage.from("lemtel-recordings").createSignedUrl(path, 60 * 10);
    if (error || !signed?.signedUrl) return json({ error: error?.message || "sign_failed" }, 500);

    return json({ url: signed.signedUrl, expiresInSec: 600 });
  } catch (e) {
    console.error("[mobile-voicemail-audio]", e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
