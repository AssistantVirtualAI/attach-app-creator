import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import webpush from "npm:web-push@3.6.7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY");
    const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY");
    const SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "mailto:noreply@avastatistic.ca";
    if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: "vapid_not_configured" }, 503);
    webpush.setVapidDetails(SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

    const body = await req.json().catch(() => ({}));
    const { user_id, title, body: text, data, icon } = body ?? {};
    if (!user_id || !title) return json({ error: "missing_fields" }, 400);

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: subs } = await admin.from("planipret_push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", user_id);
    if (!subs?.length) return json({ delivered: 0 });

    const payload = JSON.stringify({ title, body: text ?? "", data: data ?? {}, icon: icon ?? "/icon-192.png" });
    let delivered = 0;
    const expired: string[] = [];
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
        delivered++;
      } catch (err: any) {
        const code = err?.statusCode;
        if (code === 404 || code === 410) expired.push(s.id);
      }
    }
    if (expired.length) await admin.from("planipret_push_subscriptions").delete().in("id", expired);
    return json({ delivered, expired: expired.length });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
