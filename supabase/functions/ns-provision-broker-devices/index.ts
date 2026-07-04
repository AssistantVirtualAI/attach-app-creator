// ns-provision-broker-devices — single + bulk broker device provisioning.
// Uses SERVICE_ROLE for all DB writes (bypasses RLS on planipret_profiles).
// Verifies caller is an admin before performing bulk operations.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
  const NS_API_KEY = Deno.env.get("NS_API_KEY");
  const NS_API_BASE_URL = Deno.env.get("NS_API_BASE_URL") ?? "https://voice.ava-telecom.ca/ns-api/v2";
  const NS_DEFAULT_DOMAIN = Deno.env.get("NS_DEFAULT_DOMAIN") ?? "planipret.ca";

  if (!SUPABASE_URL || !SERVICE_ROLE || !NS_API_KEY) {
    return json({ error: "missing_config", detail: "SUPABASE_SERVICE_ROLE_KEY / NS_API_KEY required" }, 500);
  }

  try {
    const body: any = await req.json().catch(() => ({}));
    const broker_id: string | null = body?.broker_id ?? null;
    const bulk: boolean = !!body?.bulk;
    const batch_size: number = Math.max(1, Math.min(20, Number(body?.batch_size ?? 8)));

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, ANON_KEY ?? SERVICE_ROLE, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    const caller = userData?.user;
    if (!caller) return json({ error: "not_authenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: callerProfile } = await admin
      .from("planipret_profiles").select("role,user_id").eq("user_id", caller.id).maybeSingle();
    const isAdmin = ["admin", "super_admin", "owner"].includes(String(callerProfile?.role ?? "").toLowerCase());
    // Allow self-provisioning: caller may provision their OWN broker record without admin role
    const selfOnly = !isAdmin && !bulk && broker_id && callerProfile?.user_id === caller.id;
    if (!isAdmin && !selfOnly) return json({ error: "forbidden", detail: "admin role required for this operation" }, 403);

    const nsHeaders = { Authorization: `Bearer ${NS_API_KEY}`, "Content-Type": "application/json", Accept: "application/json" };

    const genPassword = async (userId: string) => {
      const enc = new TextEncoder().encode(userId + "planipret-sip-2026");
      const h = await crypto.subtle.digest("SHA-256", enc);
      const hex = Array.from(new Uint8Array(h)).map((b) => b.toString(16).padStart(2, "0")).join("");
      return `Pp${hex.substring(0, 12)}!`;
    };

    const provision = async (broker: any) => {
      const ext = broker.ns_extension;
      const domain = broker.ns_domain || NS_DEFAULT_DOMAIN;
      if (!ext) return { broker_id: broker.user_id, success: false, error: "no_extension" };

      const sipPassword = await genPassword(broker.user_id);
      const mobileId = `${ext}_mobile`;
      const widgetId = `${ext}_web`;
      const base = `${NS_API_BASE_URL}/domains/${encodeURIComponent(domain)}/users/${encodeURIComponent(ext)}/devices`;

      const listRes = await fetch(base, { headers: nsHeaders });
      const existing: any[] = listRes.ok ? (await listRes.json().catch(() => [])) : [];
      const arr = Array.isArray(existing) ? existing : [];
      const hasDev = (needle: string) => arr.some((d: any) => (d?.device ?? d?.aor ?? "").toString().toLowerCase().includes(needle));

      const create = async (id: string, model: string, needle: string) => {
        if (hasDev(needle)) return { existed: true, id };
        const r = await fetch(base, {
          method: "POST", headers: nsHeaders,
          body: JSON.stringify({ device: id, "authentication-key": sipPassword, "device-provisioning-protocol": "sip", "device-model": model }),
        });
        const data = await r.json().catch(() => ({}));
        return { created: r.ok, status: r.status, id, data };
      };

      const mobile = await create(mobileId, "Mobile Softphone", "_mobile");
      const widget = await create(widgetId, "Web Softphone", "_web");

      const { error: uErr } = await admin.from("planipret_profiles").update({
        ns_mobile_device_id: mobileId,
        ns_widget_device_id: widgetId,
        ns_linked: true,
        ns_linked_at: new Date().toISOString(),
      }).eq("user_id", broker.user_id);

      return {
        broker_id: broker.user_id,
        broker_name: broker.full_name,
        extension: ext,
        success: !uErr && (mobile.created || mobile.existed) && (widget.created || widget.existed),
        db_error: uErr?.message,
        mobile, widget,
        sip_credentials: { mobile_device_id: mobileId, widget_device_id: widgetId, password: sipPassword },
      };
    };

    // Single mode
    if (broker_id && !bulk) {
      const { data: broker } = await admin.from("planipret_profiles")
        .select("user_id, full_name, ns_extension, ns_domain")
        .eq("user_id", broker_id).maybeSingle();
      if (!broker) return json({ error: "broker_not_found", broker_id }, 404);
      const result = await provision(broker);
      return json({ success: result.success, result });
    }

    // Bulk mode
    if (bulk) {
      const { data: brokers } = await admin.from("planipret_profiles")
        .select("user_id, full_name, ns_extension, ns_domain, ns_mobile_device_id, ns_widget_device_id")
        .not("ns_extension", "is", null)
        .or("ns_mobile_device_id.is.null,ns_widget_device_id.is.null");
      const list = brokers ?? [];
      if (list.length === 0) return json({ success: true, message: "Aucun courtier à provisionner", count: 0 });

      const all: any[] = [];
      let succeeded = 0, failed = 0;
      for (let i = 0; i < list.length; i += batch_size) {
        const batch = list.slice(i, i + batch_size);
        const res = await Promise.all(batch.map((b) => provision(b)));
        all.push(...res);
        succeeded += res.filter((r) => r.success).length;
        failed += res.filter((r) => !r.success).length;
        if (i + batch_size < list.length) await new Promise((r) => setTimeout(r, 500));
      }
      return json({ success: true, total: list.length, processed: all.length, succeeded, failed, results: all });
    }

    return json({ error: "provide broker_id or bulk:true" }, 400);
  } catch (e: any) {
    console.error("ns-provision-broker-devices RUNTIME", e?.message, e?.stack);
    return json({ error: e?.message ?? String(e), stack: e?.stack }, 500);
  }
});
