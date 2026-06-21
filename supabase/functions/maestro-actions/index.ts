import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

async function getMaestroConfig(admin: any) {
  const { data } = await admin.from("planipret_integration_secrets").select("config").eq("provider", "maestro").maybeSingle();
  const c = (data?.config ?? {}) as Record<string, string>;
  return {
    url: (c.api_url ?? Deno.env.get("MAESTRO_API_URL") ?? "").replace(/\/$/, ""),
    key: c.api_key ?? Deno.env.get("MAESTRO_API_KEY") ?? "",
    accountId: c.account_id ?? Deno.env.get("MAESTRO_ACCOUNT_ID") ?? "",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { action, payload = {} } = await req.json();
    const cfg = await getMaestroConfig(admin);
    if (!cfg.url || !cfg.key) {
      return new Response(JSON.stringify({ success: false, error: "Maestro non configuré" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const h = { Authorization: `Bearer ${cfg.key}`, "Content-Type": "application/json", "X-Account-Id": cfg.accountId };
    const j = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    switch (action) {
      case "create_task": {
        const r = await fetch(`${cfg.url}/tasks`, { method: "POST", headers: h, body: JSON.stringify(payload) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return j({ success: false, error: "Maestro create_task failed", details: d }, 500);
        if (payload.call_id) {
          const { data: call } = await admin.from("planipret_phone_calls").select("metadata").eq("id", payload.call_id).maybeSingle();
          const meta = { ...(call?.metadata ?? {}), maestro_task_id: d.id ?? d.task_id };
          await admin.from("planipret_phone_calls").update({ metadata: meta }).eq("id", payload.call_id);
        }
        return j({ success: true, task_id: d.id ?? d.task_id });
      }
      case "create_event": {
        const r = await fetch(`${cfg.url}/calendar`, { method: "POST", headers: h, body: JSON.stringify(payload) });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) return j({ success: false, error: "Maestro create_event failed", details: d }, 500);
        if (payload.call_id) {
          const { data: call } = await admin.from("planipret_phone_calls").select("metadata").eq("id", payload.call_id).maybeSingle();
          const meta = { ...(call?.metadata ?? {}), maestro_event_id: d.id ?? d.event_id };
          await admin.from("planipret_phone_calls").update({ metadata: meta }).eq("id", payload.call_id);
        }
        return j({ success: true, event_id: d.id ?? d.event_id });
      }
      case "list_contacts": {
        const q = payload.query ?? "";
        const r = await fetch(`${cfg.url}/contacts?search=${encodeURIComponent(q)}`, { headers: h });
        const d = await r.json().catch(() => ({}));
        return j({ success: r.ok, contacts: d.contacts ?? d ?? [] }, r.ok ? 200 : 500);
      }
      case "list_tasks": {
        const r = await fetch(`${cfg.url}/tasks?assigned_to=${encodeURIComponent(payload.broker_email ?? "")}`, { headers: h });
        const d = await r.json().catch(() => ({}));
        return j({ success: r.ok, tasks: d.tasks ?? d ?? [] }, r.ok ? 200 : 500);
      }
      case "list_events": {
        const r = await fetch(`${cfg.url}/calendar?start=${encodeURIComponent(payload.start ?? "")}&end=${encodeURIComponent(payload.end ?? "")}`, { headers: h });
        const d = await r.json().catch(() => ({}));
        return j({ success: r.ok, events: d.events ?? d ?? [] }, r.ok ? 200 : 500);
      }
      case "test": {
        const r = await fetch(`${cfg.url}/contacts?limit=1`, { headers: h });
        return j({ success: r.ok, status: r.status });
      }
      default:
        return j({ success: false, error: "Action inconnue" }, 400);
    }
  } catch (e: any) {
    console.error("maestro-actions error", e);
    return new Response(JSON.stringify({ success: false, error: e?.message ?? "Erreur serveur", code: 0 }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
