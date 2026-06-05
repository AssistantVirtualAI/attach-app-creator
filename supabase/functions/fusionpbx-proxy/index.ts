// FusionPBX v7 REST proxy for the AVA Statistic / Lemtel app.
// All client calls authenticate via Supabase JWT; the FusionPBX credentials
// (URL, username, API key, domain UUID) live only in Vault.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", ...extraHeaders },
  });

const LEMTEL_ORG = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Identify caller (JWT in Authorization header OR service-role for pg_cron)
  let userId: string | null = null;
  let organization_id: string | undefined;
  const authHeader = req.headers.get("Authorization") || "";
  const apiKeyHeader = req.headers.get("apikey") || "";
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  // pg_cron calls send only `apikey` header (anon or service) — treat as trusted server-side call
  const isServiceCall =
    authHeader === `Bearer ${serviceKey}` ||
    apiKeyHeader === serviceKey ||
    apiKeyHeader === anonKey;

  if (!isServiceCall) {
    if (!authHeader) return json({ error: "Unauthorized" }, 401);
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);
    userId = user.id;
  }

  let body: any = {};
  try { body = await req.json(); } catch { /* allow empty */ }
  const action: string = body.action || "ping";
  organization_id = body.organization_id || LEMTEL_ORG;
  const params = body.params || {};

  // Secrets
  const required = (n: string) => {
    const v = Deno.env.get(n);
    if (!v) throw { error: "MISSING_SECRET", secret: n, message: `Configure ${n} in Supabase Vault` };
    return v;
  };

  let FUSIONPBX_API_URL: string, FUSIONPBX_USERNAME: string, FUSIONPBX_API_KEY: string, FUSIONPBX_DOMAIN_UUID: string;
  try {
    FUSIONPBX_API_URL = required("FUSIONPBX_API_URL").replace(/\/+$/, "").replace(/\/app\/api(\/\d+)?$/, "");
    FUSIONPBX_USERNAME = required("FUSIONPBX_USERNAME");
    FUSIONPBX_API_KEY = required("FUSIONPBX_API_KEY");
    FUSIONPBX_DOMAIN_UUID = required("FUSIONPBX_DOMAIN_UUID");
  } catch (e: any) {
    return json(e, 400);
  }

  // FusionPBX returns Basic auth with the raw API key as the password value
  // when called with "Authorization: Basic <api_key>" (the API key already
  // encodes the credentials). We support both styles, defaulting to the
  // confirmed-working pattern: Basic <FUSIONPBX_API_KEY>.
  const basicHeader = `Basic ${FUSIONPBX_API_KEY}`;

  const domainQ = `domain_uuid=${FUSIONPBX_DOMAIN_UUID}`;

  async function pbxFetch(path: string, init: RequestInit = {}) {
    const url = `${FUSIONPBX_API_URL}/app/api/7/${path}`;
    const started = Date.now();
    let res: Response;
    try {
      res = await fetch(url, {
        ...init,
        headers: {
          Authorization: basicHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(init.headers || {}),
        },
      });
    } catch (e: any) {
      return { ok: false, status: 0, error: "FUSIONPBX_UNREACHABLE", message: `Cannot reach ${FUSIONPBX_API_URL}: ${e?.message || e}`, latency_ms: Date.now() - started };
    }
    const text = await res.text();
    const latency_ms = Date.now() - started;
    if (res.status === 401 || res.status === 403)
      return { ok: false, status: res.status, error: "FUSIONPBX_AUTH_FAILED", message: "Check FUSIONPBX_API_KEY in Vault", latency_ms, raw: text.slice(0, 500) };
    if (res.status === 404)
      return { ok: false, status: 404, error: "ENDPOINT_NOT_FOUND", resource: path, latency_ms, raw: text.slice(0, 500) };
    let data: any;
    try { data = text ? JSON.parse(text) : {}; }
    catch { return { ok: false, status: res.status, error: "INVALID_RESPONSE", body: text.slice(0, 500), latency_ms }; }
    return { ok: res.ok, status: res.status, data, latency_ms };
  }

  // Normalise a FusionPBX collection response. Endpoints return either an
  // object keyed by the resource (e.g. { extensions: [...] }) or a bare array.
  function collection(data: any, key: string): any[] {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data[key])) return data[key];
    if (Array.isArray(data.data)) return data.data;
    return [];
  }

  function mapExtension(e: any) {
    return {
      organization_id,
      pbx_uuid: e.extension_uuid,
      extension: String(e.extension ?? ""),
      effective_cid_name: e.effective_caller_id_name ?? null,
      effective_cid_number: e.effective_caller_id_number ?? null,
      call_group: e.call_group ?? null,
      voicemail_enabled: e.voicemail_enabled === "true" || e.voicemail_enabled === true,
      call_recording: e.user_record ?? "none",
      do_not_disturb: e.do_not_disturb === "true" || e.do_not_disturb === true,
      forward_all_destination: e.forward_all_destination ?? null,
      enabled: e.enabled === "true" || e.enabled === true || e.enabled === undefined,
      description: e.description ?? null,
      raw_data: e,
      synced_at: new Date().toISOString(),
    };
  }

  function mapDevice(d: any) {
    return {
      organization_id,
      pbx_uuid: d.device_uuid,
      mac_address: d.device_mac_address ?? d.mac_address ?? null,
      label: d.device_label ?? null,
      vendor: d.device_vendor ?? null,
      template: d.device_template ?? null,
      profile: d.device_profile_uuid ?? null,
      enabled: d.device_enabled === "true" || d.device_enabled === true || d.enabled === true,
      raw_data: d,
    };
  }

  function mapIvr(i: any) {
    return {
      organization_id,
      pbx_uuid: i.ivr_menu_uuid,
      name: i.ivr_menu_name ?? i.name ?? "IVR",
      extension: i.ivr_menu_extension ?? null,
      greet_long: i.ivr_menu_greet_long ?? null,
      greet_short: i.ivr_menu_greet_short ?? null,
      timeout_ms: i.ivr_menu_timeout ? parseInt(i.ivr_menu_timeout) : null,
      exit_action: i.ivr_menu_exit_action ?? null,
      direct_dial: i.ivr_menu_direct_dial === "true",
      ringback: i.ivr_menu_ringback ?? null,
      enabled: i.ivr_menu_enabled === "true" || i.ivr_menu_enabled === true,
      description: i.ivr_menu_description ?? null,
      raw_data: i,
    };
  }

  function mapQueue(q: any) {
    return {
      organization_id,
      pbx_uuid: q.call_center_queue_uuid ?? q.queue_uuid,
      name: q.queue_name ?? q.name ?? "Queue",
      extension: q.queue_extension ?? null,
      strategy: q.queue_strategy ?? null,
      music_on_hold: q.queue_moh_sound ?? null,
      record_enabled: q.queue_record_template ? true : false,
      max_wait_time: q.queue_max_wait_time ? parseInt(q.queue_max_wait_time) : null,
      timeout_action: q.queue_timeout_action ?? null,
      enabled: q.queue_enabled === "true" || q.queue_enabled === true,
      description: q.queue_description ?? null,
      raw_data: q,
    };
  }

  function mapRingGroup(r: any) {
    return {
      organization_id,
      pbx_uuid: r.ring_group_uuid,
      name: r.ring_group_name ?? "Ring Group",
      extension: r.ring_group_extension ?? null,
      strategy: r.ring_group_strategy ?? null,
      forwarding: r.ring_group_forward_destination ?? null,
      enabled: r.ring_group_enabled === "true" || r.ring_group_enabled === true,
      description: r.ring_group_description ?? null,
      raw_data: r,
    };
  }

  function mapCdr(c: any) {
    const rec = c.record_name && c.record_name !== "";
    return {
      organization_id,
      pbx_uuid: c.xml_cdr_uuid,
      direction: c.direction,
      call_status: c.hangup_cause ?? null,
      extension: c.extension ?? null,
      caller_name: c.caller_id_name ?? null,
      caller_number: c.caller_id_number ?? null,
      destination: c.caller_destination ?? null,
      start_at: c.start_stamp ?? null,
      answer_at: c.answer_stamp ?? null,
      end_at: c.end_stamp ?? null,
      duration_seconds: c.duration ? parseInt(c.duration) : 0,
      billsec: c.billsec ? parseInt(c.billsec) : 0,
      mos: c.rtp_audio_in_mos ? parseFloat(c.rtp_audio_in_mos) : null,
      missed_call: c.missed_call === "true" || c.missed_call === true,
      has_recording: !!rec,
      recording_url: rec ? `${c.record_path || ""}/${c.record_name}` : null,
      raw_data: c,
    };
  }

  // -------- Actions --------
  try {
    if (action === "ping") {
      const r = await pbxFetch(`extensions?${domainQ}&limit=1`);
      if (!r.ok) return json(r, r.status || 500);
      const exts = collection(r.data, "extensions");
      return json({ status: "ok", latency_ms: r.latency_ms, extensions_count: exts.length });
    }

    // ---- LIST actions ----
    const listMap: Record<string, { path: string; key: string }> = {
      "list-extensions":    { path: `extensions?${domainQ}`,          key: "extensions" },
      "list-devices":       { path: `devices?${domainQ}`,             key: "devices" },
      "list-ivrs":          { path: `ivr_menus?${domainQ}`,           key: "ivr_menus" },
      "list-queues":        { path: `call_center_queues?${domainQ}`,  key: "call_center_queues" },
      "list-ring-groups":   { path: `ring_groups?${domainQ}`,         key: "ring_groups" },
      "list-destinations":  { path: `destinations?${domainQ}`,        key: "destinations" },
      "list-voicemails":    { path: `voicemails?${domainQ}`,          key: "voicemails" },
      "list-registrations": { path: `registrations?${domainQ}`,       key: "registrations" },
    };
    if (listMap[action]) {
      const m = listMap[action];
      const r = await pbxFetch(m.path);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, m.key), latency_ms: r.latency_ms });
    }

    // ---- CREATE / UPDATE / DELETE helpers ----
    async function writeCollection(path: string, key: string, payload: any) {
      return pbxFetch(path, { method: "POST", body: JSON.stringify({ [key]: [{ ...payload, domain_uuid: FUSIONPBX_DOMAIN_UUID }] }) });
    }

    if (action === "create-extension") return json(await writeCollection("extensions", "extensions", params), 200);
    if (action === "update-extension") return json(await writeCollection("extensions", "extensions", params), 200);
    if (action === "delete-extension") {
      const id = params.extension_uuid;
      if (!id) return json({ error: "extension_uuid required" }, 400);
      return json(await pbxFetch(`extensions/${id}`, { method: "DELETE" }));
    }
    if (action === "create-device") return json(await writeCollection("devices", "devices", params));
    if (action === "update-device") return json(await writeCollection("devices", "devices", params));
    if (action === "delete-device") {
      const id = params.device_uuid;
      if (!id) return json({ error: "device_uuid required" }, 400);
      return json(await pbxFetch(`devices/${id}`, { method: "DELETE" }));
    }
    if (action === "create-ivr") return json(await writeCollection("ivr_menus", "ivr_menus", params));
    if (action === "update-ivr") return json(await writeCollection("ivr_menus", "ivr_menus", params));
    if (action === "delete-ivr") {
      const id = params.ivr_menu_uuid;
      if (!id) return json({ error: "ivr_menu_uuid required" }, 400);
      return json(await pbxFetch(`ivr_menus/${id}`, { method: "DELETE" }));
    }
    if (action === "create-queue") return json(await writeCollection("call_center_queues", "call_center_queues", params));
    if (action === "update-queue") return json(await writeCollection("call_center_queues", "call_center_queues", params));
    if (action === "create-ring-group") return json(await writeCollection("ring_groups", "ring_groups", params));

    // ---- CDRs ----
    if (action === "list-cdrs" || action === "sync-cdrs" || action === "get-cdrs") {
      // Find last sync timestamp when doing incremental sync
      let startDate: string | undefined = params.start_date;
      if (action === "sync-cdrs" && !startDate) {
        const { data: last } = await admin.from("pbx_sync_jobs")
          .select("completed_at").eq("job_type", "sync-cdrs").eq("status", "completed")
          .order("completed_at", { ascending: false }).limit(1).maybeSingle();
        if (last?.completed_at) startDate = last.completed_at;
      }
      const qp = new URLSearchParams({ [`domain_uuid`]: FUSIONPBX_DOMAIN_UUID, order: "desc", limit: String(params.limit || 100) });
      if (startDate) qp.set("start_date", startDate);
      if (params.end_date) qp.set("end_date", params.end_date);
      if (params.extension) qp.set("extension", params.extension);

      const r = await pbxFetch(`xml_cdrs?${qp.toString()}`);
      if (!r.ok) {
        await admin.from("pbx_sync_jobs").insert({ organization_id, job_type: action, status: "failed", error_message: (r as any).message || (r as any).error, stats: {} });
        return json(r, r.status || 500);
      }
      const cdrs = collection(r.data, "xml_cdrs");
      let upserted = 0;
      if (cdrs.length > 0) {
        const rows = cdrs.map(mapCdr).filter((x) => x.pbx_uuid);
        const { error, count } = await admin.from("pbx_call_records").upsert(rows, { onConflict: "pbx_uuid", count: "exact" });
        if (!error) upserted = count ?? rows.length;
      }
      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: action, status: "completed",
        completed_at: new Date().toISOString(),
        stats: { cdrs: upserted, fetched: cdrs.length, duration_ms: r.latency_ms },
      });
      return json({ ok: true, data: action === "list-cdrs" ? cdrs : undefined, stats: { cdrs: upserted, fetched: cdrs.length } });
    }

    // ---- Full sync ----
    if (action === "sync-all") {
      const t0 = Date.now();
      const results = await Promise.all([
        pbxFetch(`extensions?${domainQ}`).then((r) => ({ k: "extensions", r })),
        pbxFetch(`devices?${domainQ}`).then((r) => ({ k: "devices", r })),
        pbxFetch(`ivr_menus?${domainQ}`).then((r) => ({ k: "ivr_menus", r })),
        pbxFetch(`call_center_queues?${domainQ}`).then((r) => ({ k: "call_center_queues", r })),
        pbxFetch(`ring_groups?${domainQ}`).then((r) => ({ k: "ring_groups", r })),
        pbxFetch(`xml_cdrs?${domainQ}&order=desc&limit=200`).then((r) => ({ k: "xml_cdrs", r })),
      ]);
      const stats: Record<string, number> = {};
      const errors: string[] = [];
      const doUpsert = async (table: string, rows: any[], conflict: string, k: string) => {
        if (!rows.length) { stats[k] = 0; return; }
        const { error, count, data } = await admin.from(table).upsert(rows, { onConflict: conflict, count: "exact" }).select("id");
        if (error) { errors.push(`${table}: ${error.message}`); stats[k] = 0; }
        else stats[k] = count ?? (data?.length ?? rows.length);
      };
      for (const { k, r } of results) {
        if (!r.ok) { errors.push(`${k}: ${(r as any).message || (r as any).error}`); stats[k] = 0; continue; }
        const list = collection(r.data, k);
        if (k === "extensions") {
          const rows = list.map(mapExtension).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_extensions", rows, "organization_id,pbx_uuid", "extensions");
        } else if (k === "devices") {
          const rows = list.map(mapDevice).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_devices", rows, "organization_id,pbx_uuid", "devices");
        } else if (k === "ivr_menus") {
          const rows = list.map(mapIvr).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_ivrs", rows, "organization_id,pbx_uuid", "ivrs");
        } else if (k === "call_center_queues") {
          const rows = list.map(mapQueue).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_call_queues", rows, "organization_id,pbx_uuid", "queues");
        } else if (k === "ring_groups") {
          const rows = list.map(mapRingGroup).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_ring_groups", rows, "organization_id,pbx_uuid", "ring_groups");
        } else if (k === "xml_cdrs") {
          const rows = list.map(mapCdr).filter((x) => x.pbx_uuid);
          await doUpsert("pbx_call_records", rows, "pbx_uuid", "cdrs");
        }
      }
      const duration_ms = Date.now() - t0;
      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: "sync-all",
        status: errors.length ? "completed_with_errors" : "completed",
        completed_at: new Date().toISOString(),
        stats: { ...stats, duration_ms },
        error: errors.length ? errors.join("; ").slice(0, 2000) : null,
      });
      await admin.from("pbx_integrations").update({ last_sync_at: new Date().toISOString() }).eq("organization_id", organization_id);
      return json({ success: errors.length === 0, stats: { ...stats, duration_ms }, errors });
    }

    // ---- Recording proxy ----
    if (action === "get-recording") {
      const { record_path, record_name } = params;
      if (!record_path || !record_name) return json({ error: "record_path and record_name required" }, 400);
      const cleanPath = String(record_path).replace(/^\/+/, "");
      const url = `${FUSIONPBX_API_URL}/${cleanPath}/${encodeURIComponent(record_name)}`;
      const r = await fetch(url, { headers: { Authorization: basicHeader } });
      if (!r.ok) return json({ error: "FETCH_FAILED", status: r.status }, r.status);
      const ct = record_name.toLowerCase().endsWith(".mp3") ? "audio/mpeg" : "audio/wav";
      return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": ct, "Cache-Control": "private, max-age=300" } });
    }

    return json({ error: "UNKNOWN_ACTION", action }, 400);
  } catch (e: any) {
    if (organization_id) {
      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: action, status: "failed",
        error_message: e?.message || String(e),
      });
    }
    return json({ error: "INTERNAL", message: e?.message || String(e) }, 500);
  }
});
