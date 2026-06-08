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
  // Only the service-role key constitutes a trusted server-side call.
  // The anon key is public (shipped to the client) and must NOT bypass auth.
  const isServiceCall =
    authHeader === `Bearer ${serviceKey}` ||
    apiKeyHeader === serviceKey;

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
    const recName = c.record_name ?? null;
    const hasRec = !!(recName && recName !== "");
    let answer = c.answer_stamp ?? null;
    if (!answer || answer === "1969-12-31 19:00:00-05" || c.answer_epoch === "0" || c.answer_epoch === 0) {
      answer = null;
    }
    const billsec = c.billsec != null ? parseInt(c.billsec) : 0;
    const direction = c.direction ?? null;
    let missed: boolean | null = null;
    if (c.missed_call === "true" || c.missed_call === true) missed = true;
    else if (c.missed_call === "false" || c.missed_call === false) missed = false;
    else missed = (billsec === 0 && direction === "inbound");
    return {
      organization_id,
      pbx_uuid: c.xml_cdr_uuid ?? c.cdr_uuid ?? c.uuid,
      extension_uuid: c.extension_uuid ?? null,
      domain_uuid: c.domain_uuid ?? null,
      domain_name: c.domain_name ?? null,
      direction,
      caller_name: c.caller_id_name ?? null,
      caller_number: c.caller_id_number ?? null,
      destination: c.caller_destination ?? c.destination_number ?? null,
      source_number: c.source_number ?? null,
      destination_number: c.destination_number ?? null,
      start_at: c.start_stamp ?? null,
      answer_at: answer,
      end_at: c.end_stamp ?? null,
      duration_seconds: c.duration ? parseInt(c.duration) : 0,
      billsec,
      mos: c.rtp_audio_in_mos ? parseFloat(c.rtp_audio_in_mos) : null,
      missed_call: missed,
      voicemail_message: c.voicemail_message ?? null,
      has_recording: hasRec,
      recording_path: c.record_path ?? null,
      recording_name: recName,
      hangup_cause: c.hangup_cause ?? null,
      sip_call_id: c.sip_call_id ?? null,
      call_status: c.status ?? null,
      ivr_menu_uuid: c.ivr_menu_uuid ?? null,
      ring_group_uuid: c.ring_group_uuid ?? null,
      waitsec: c.waitsec != null ? parseInt(c.waitsec) : null,
      pdd_ms: c.pdd_ms != null ? parseInt(c.pdd_ms) : null,
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
    // FusionPBX API v7 requires QUERY-PARAM auth (?key=...&username=...) for
    // POST/PUT/DELETE — the Authorization header returns 403 on writes.
    async function pbxWrite(path: string, method: "POST" | "PUT" | "DELETE", payload?: unknown) {
      const url = new URL(`${FUSIONPBX_API_URL}/app/api/7/${path}`);
      url.searchParams.set("key", FUSIONPBX_API_KEY);
      url.searchParams.set("username", FUSIONPBX_USERNAME);
      const started = Date.now();
      let res: Response;
      try {
        res = await fetch(url.toString(), {
          method,
          headers: { "Content-Type": "application/json", Accept: "application/json" },
          body: payload !== undefined ? JSON.stringify(payload) : undefined,
        });
      } catch (e: any) {
        return { ok: false, status: 0, error: "FUSIONPBX_UNREACHABLE", message: e?.message || String(e), latency_ms: Date.now() - started };
      }
      const text = await res.text();
      const latency_ms = Date.now() - started;
      let data: any = {};
      try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
      const embeddedCode = data?.code || data?.details?.[0]?.code;
      const embeddedMessage = data?.details?.[0]?.message || data?.message || (typeof data?.raw === "string" ? data.raw : null);
      const failed = !res.ok || (embeddedCode && String(embeddedCode) !== "200");
      return { ok: !failed, status: res.status, data, latency_ms, embeddedCode: embeddedCode ?? null, message: embeddedMessage };
    }

    async function writeCollection(path: string, key: string, payload: any) {
      return pbxWrite(path, "POST", { [key]: [{ ...payload, domain_uuid: FUSIONPBX_DOMAIN_UUID }] });
    }

    // ---- DOMAIN management (multi-tenant provisioning) ----
    if (action === "create-domain" || action === "createDomain") {
      const domain_name = body.domain_name || params.domain_name;
      const description = body.domain_description || params.domain_description || `Customer domain`;
      if (!domain_name) return json({ ok: false, error: "domain_name required" }, 400);
      const r = await pbxWrite("domains", "POST", {
        domains: [{ domain_name, domain_description: description, domain_enabled: "true" }],
      });
      if (!r.ok) return json(r, r.status || 500);
      // Try to read back the UUID
      const list = await pbxFetch(`domains?domain_name=${encodeURIComponent(domain_name)}`);
      const arr = collection(list.data, "domains");
      const created = arr.find((d: any) => d.domain_name === domain_name) || arr[0];
      return json({ ok: true, domain_uuid: created?.domain_uuid || null, domain_name, raw: r.data });
    }

    if (action === "delete-domain") {
      const id = body.domain_uuid || params.domain_uuid;
      if (!id) return json({ ok: false, error: "domain_uuid required" }, 400);
      return json(await pbxWrite(`domains/${id}`, "DELETE"));
    }

    if (action === "get-registrations") {
      const r = await pbxFetch(`registrations?${domainQ}`);
      if (!r.ok) return json(r, r.status || 500);
      return json({ ok: true, data: collection(r.data, "registrations") });
    }


    if (action === "get-extension") {
      const id = body.extension_uuid || params.extension_uuid;
      const extNum = body.extension || params.extension;
      const domId = body.domain_uuid || params.domain_uuid || FUSIONPBX_DOMAIN_UUID;
      let url: URL;
      if (id) {
        url = new URL(`${FUSIONPBX_API_URL}/app/api/7/extensions/${id}`);
      } else if (extNum) {
        url = new URL(`${FUSIONPBX_API_URL}/app/api/7/extensions`);
        url.searchParams.set("extension", String(extNum));
        url.searchParams.set("domain_uuid", domId);
      } else {
        return json({ error: "Need extension_uuid or extension" }, 400);
      }
      url.searchParams.set("key", FUSIONPBX_API_KEY);
      url.searchParams.set("username", FUSIONPBX_USERNAME);
      try {
        const res = await fetch(url.toString(), { headers: { Authorization: basicHeader, Accept: "application/json" } });
        const text = await res.text();
        let data: any;
        try { data = JSON.parse(text); } catch { return json({ error: "PARSE_ERROR", raw: text.slice(0, 400) }, 200); }
        return json(data, 200);
      } catch (e: any) {
        return json({ error: "FETCH_FAILED", message: e?.message || String(e) }, 200);
      }
    }

    if (action === "create-extension") {

      const extData = body.data || params || {};
      const attemptAt = new Date().toISOString();

      const requestBody = {
        extensions: [{
          domain_uuid: extData.domain_uuid || FUSIONPBX_DOMAIN_UUID,
          extension: String(extData.extension),
          password: extData.password,
          effective_caller_id_name: extData.effective_caller_id_name,
          effective_caller_id_number: String(extData.extension),
          outbound_caller_id_name: extData.outbound_caller_id_name || extData.effective_caller_id_name,
          outbound_caller_id_number: extData.outbound_caller_id_number || "15144942888",
          emergency_caller_id_name: "Lemtel",
          emergency_caller_id_number: "5144942888",
          call_timeout: String(extData.call_timeout || "30"),
          call_group: extData.call_group || "",
          user_record: extData.user_record || "none",
          enabled: "true",
          description: extData.description || extData.effective_caller_id_name,
          user_context: "lemtel.lemtel.tel",
          accountcode: "lemtel.lemtel.tel",
          limit_max: "5",
          limit_destination: "!USER_BUSY",
        }],
      };

      const extStarted = Date.now();
      const writeUrl = new URL(`${FUSIONPBX_API_URL}/app/api/7/extensions`);
      writeUrl.searchParams.set("key", FUSIONPBX_API_KEY);
      writeUrl.searchParams.set("username", FUSIONPBX_USERNAME);
      const res = await fetch(writeUrl.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(requestBody),
      });
      const extLatency = Date.now() - extStarted;
      const responseText = await res.text();
      console.log("FusionPBX create-extension status=", res.status, "body=", responseText.slice(0, 500));

      let responseData: any = {};
      try { responseData = JSON.parse(responseText); } catch { responseData = { raw: responseText }; }

      // FusionPBX often returns HTTP 200 with an embedded error code. Detect both.
      const embeddedCode = responseData?.code || responseData?.details?.[0]?.code;
      const embeddedMessage =
        responseData?.details?.[0]?.message || responseData?.message ||
        (typeof responseData?.raw === "string" ? responseData.raw : null);
      const failed = !res.ok || (embeddedCode && String(embeddedCode) !== "200");
      const extensionResult = {
        ok: !failed,
        http_status: res.status,
        embedded_code: embeddedCode ?? null,
        message: embeddedMessage,
        latency_ms: extLatency,
        attempted_at: attemptAt,
        response: responseData,
      };

      if (failed) {
        return json({
          error: "CREATE_FAILED",
          message: embeddedMessage || `HTTP ${res.status}`,
          status: res.status,
          embeddedCode,
          details: responseData,
          extension_result: extensionResult,
        }, 200);
      }

      const extensionUuid =
        responseData?.extensions?.[0]?.extension_uuid ||
        responseData?.extension_uuid ||
        responseData?.[0]?.extension_uuid || null;

      // Dedicated voicemail provisioning step (/voicemails endpoint)
      let voicemailResult: any = { skipped: true };
      if (extData.voicemail_enabled === "true" || extData.voicemail_enabled === true) {
        const vmStarted = Date.now();
        try {
          const vmUrl = new URL(`${FUSIONPBX_API_URL}/app/api/7/voicemails`);
          vmUrl.searchParams.set("key", FUSIONPBX_API_KEY);
          vmUrl.searchParams.set("username", FUSIONPBX_USERNAME);
          const vmRes = await fetch(vmUrl.toString(), {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ voicemails: [{
              domain_uuid: extData.domain_uuid || FUSIONPBX_DOMAIN_UUID,
              voicemail_id: String(extData.extension),
              voicemail_password: extData.voicemail_password || String(extData.extension),
              voicemail_mail_to: extData.voicemail_mail_to || "",
              voicemail_attach_file: "true",
              voicemail_local_after_email: "true",
              voicemail_enabled: "true",
              voicemail_description: extData.description || "",
            }]}),
          });
          const vmText = await vmRes.text();
          let vmData: any = {}; try { vmData = JSON.parse(vmText); } catch { vmData = { raw: vmText }; }
          const vmCode = vmData?.code || vmData?.details?.[0]?.code;
          const vmMsg = vmData?.details?.[0]?.message || vmData?.message || (typeof vmData?.raw === "string" ? vmData.raw : null);
          const vmFailed = !vmRes.ok || (vmCode && String(vmCode) !== "200");
          voicemailResult = {
            ok: !vmFailed,
            http_status: vmRes.status,
            embedded_code: vmCode ?? null,
            message: vmMsg,
            latency_ms: Date.now() - vmStarted,
            attempted_at: new Date().toISOString(),
            response: vmData,
          };
        } catch (e: any) {
          voicemailResult = { ok: false, error: e?.message || String(e), attempted_at: new Date().toISOString() };
        }
      }

      return json({
        success: true,
        extension: extData.extension,
        extension_uuid: extensionUuid,
        raw_response: responseData,
        extension_result: extensionResult,
        voicemail_result: voicemailResult,
      }, 200);
    }
    if (action === "update-extension") return json(await writeCollection("extensions", "extensions", params), 200);
    if (action === "delete-extension") {
      const id = params.extension_uuid;
      if (!id) return json({ error: "extension_uuid required" }, 400);
      return json(await pbxWrite(`extensions/${id}`, "DELETE"));
    }
    if (action === "create-device") return json(await writeCollection("devices", "devices", params));
    if (action === "update-device") return json(await writeCollection("devices", "devices", params));
    if (action === "delete-device") {
      const id = params.device_uuid;
      if (!id) return json({ error: "device_uuid required" }, 400);
      return json(await pbxWrite(`devices/${id}`, "DELETE"));
    }
    if (action === "create-ivr") return json(await writeCollection("ivr_menus", "ivr_menus", params));
    if (action === "update-ivr") return json(await writeCollection("ivr_menus", "ivr_menus", params));
    if (action === "delete-ivr") {
      const id = params.ivr_menu_uuid;
      if (!id) return json({ error: "ivr_menu_uuid required" }, 400);
      return json(await pbxWrite(`ivr_menus/${id}`, "DELETE"));
    }
    if (action === "create-queue") return json(await writeCollection("call_center_queues", "call_center_queues", params));
    if (action === "update-queue") return json(await writeCollection("call_center_queues", "call_center_queues", params));
    if (action === "create-ring-group") return json(await writeCollection("ring_groups", "ring_groups", params));

    // ---- Business Hours / Time Conditions (FusionPBX dialplans) ----
    // params: { name, schedule: [{ day:0-6, start:'HH:MM', end:'HH:MM' }], open_destination, closed_destination, dialplan_uuid? }
    if (action === "upsert-time-condition") {
      const { name, schedule = [], open_destination, closed_destination, dialplan_uuid } = params;
      if (!name || !open_destination || !closed_destination) {
        return json({ error: "name, open_destination, closed_destination required" }, 400);
      }
      const dpUuid = dialplan_uuid || crypto.randomUUID();
      // Build dialplan body
      const dp = {
        dialplan_uuid: dpUuid,
        domain_uuid: FUSIONPBX_DOMAIN_UUID,
        dialplan_name: name,
        dialplan_number: "",
        dialplan_context: (Deno.env.get("FUSIONPBX_SIP_DOMAIN") || "default"),
        dialplan_continue: "false",
        dialplan_order: 100,
        dialplan_enabled: "true",
        dialplan_description: `Business hours: ${name}`,
      };
      const dpRes = await pbxFetch("dialplans", {
        method: "POST",
        body: JSON.stringify(dp),
        headers: { "Content-Type": "application/json" },
      });
      const details: any[] = [];
      let order = 10;
      for (const slot of schedule) {
        details.push({
          dialplan_detail_uuid: crypto.randomUUID(),
          dialplan_uuid: dpUuid,
          dialplan_detail_tag: "condition",
          dialplan_detail_type: "wday",
          dialplan_detail_data: String((slot.day ?? 0) + 1),
          dialplan_detail_order: order++,
        });
        details.push({
          dialplan_detail_uuid: crypto.randomUUID(),
          dialplan_uuid: dpUuid,
          dialplan_detail_tag: "condition",
          dialplan_detail_type: "time-of-day",
          dialplan_detail_data: `${slot.start}-${slot.end}`,
          dialplan_detail_order: order++,
        });
        details.push({
          dialplan_detail_uuid: crypto.randomUUID(),
          dialplan_uuid: dpUuid,
          dialplan_detail_tag: "action",
          dialplan_detail_type: "transfer",
          dialplan_detail_data: open_destination,
          dialplan_detail_order: order++,
        });
      }
      details.push({
        dialplan_detail_uuid: crypto.randomUUID(),
        dialplan_uuid: dpUuid,
        dialplan_detail_tag: "action",
        dialplan_detail_type: "transfer",
        dialplan_detail_data: closed_destination,
        dialplan_detail_order: 9999,
      });
      for (const d of details) {
        await pbxFetch("dialplan_details", {
          method: "POST",
          body: JSON.stringify(d),
          headers: { "Content-Type": "application/json" },
        }).catch(() => null);
      }
      return json({ ok: true, dialplan_uuid: dpUuid, dialplan: dpRes });
    }

    if (action === "list-time-conditions") {
      const r = await pbxFetch(`dialplans?${domainQ}`);
      return json(r);
    }

    if (action === "delete-time-condition") {
      const id = params.dialplan_uuid;
      if (!id) return json({ error: "dialplan_uuid required" }, 400);
      return json(await pbxFetch(`dialplans/${id}`, { method: "DELETE" }));
    }



    // ---- CDR endpoint fallback helper ----
    const CDR_ENDPOINTS = [
      "/app/api/7/xml_cdr",
      "/app/api/7/xml_cdrs",
      "/app/api/7/cdrs",
      "/app/api/7/cdr",
      "/app/xml_cdr/xml_cdr.php",
    ];

    async function fetchCdrsWithFallback(extraQp: Record<string, string> = {}) {
      // Try cached endpoint first
      const { data: integ } = await admin.from("pbx_integrations")
        .select("id, config").eq("organization_id", organization_id).maybeSingle();
      const cachedEp: string | undefined = (integ?.config as any)?.cdr_endpoint;
      const ordered = cachedEp
        ? [cachedEp, ...CDR_ENDPOINTS.filter((e) => e !== cachedEp)]
        : CDR_ENDPOINTS;
      const attempts: { endpoint: string; status: number; error?: string; sample?: string }[] = [];

      for (const ep of ordered) {
        const isPhp = ep.endsWith(".php");
        // NOTE: 'order' must NOT be passed — it conflicts with the PostgreSQL reserved word
        // inside the FusionPBX API handler and causes "syntax error at order".
        const qp = new URLSearchParams({ domain_uuid: FUSIONPBX_DOMAIN_UUID, limit: "100", ...extraQp });
        if (isPhp) {
          qp.set("key", FUSIONPBX_API_KEY);
          qp.set("username", FUSIONPBX_USERNAME);
        }
        const url = `${FUSIONPBX_API_URL}${ep}?${qp.toString()}`;
        const started = Date.now();
        try {
          const res = await fetch(url, { headers: { Authorization: basicHeader, Accept: "application/json" } });
          const text = await res.text();
          if (!res.ok) {
            attempts.push({ endpoint: ep, status: res.status, sample: text.slice(0, 200) });
            continue;
          }
          let parsed: any;
          try { parsed = JSON.parse(text); }
          catch { attempts.push({ endpoint: ep, status: res.status, error: "invalid_json", sample: text.slice(0, 200) }); continue; }
          const records =
            parsed?.xml_cdr || parsed?.xml_cdrs || parsed?.cdrs || parsed?.cdr ||
            (Array.isArray(parsed) ? parsed : null);
          if (Array.isArray(records)) {
            if (integ && cachedEp !== ep) {
              await admin.from("pbx_integrations")
                .update({ config: { ...(integ.config as any || {}), cdr_endpoint: ep } })
                .eq("id", integ.id);
            }
            return { ok: true, endpoint: ep, records, latency_ms: Date.now() - started, attempts };
          }
          attempts.push({ endpoint: ep, status: res.status, error: "no_array_in_response", sample: text.slice(0, 200) });
        } catch (e: any) {
          attempts.push({ endpoint: ep, status: 0, error: e?.message || String(e) });
        }
      }
      return { ok: false, endpoint: null, records: [] as any[], attempts };
    }

    // ---- CDR endpoint diagnostic ----
    if (action === "test-cdr-endpoint") {
      const r = await fetchCdrsWithFallback({ limit: "1" });
      return json({
        ok: r.ok,
        endpoint: r.endpoint,
        record_count: r.records.length,
        attempts: r.attempts,
      });
    }

    // ---- CDRs (list / sync) ----
    if (action === "list-cdrs" || action === "sync-cdrs" || action === "get-cdrs") {
      const b: any = body;
      const extension: string | undefined = params.extension ?? b.extension;
      // FusionPBX xml_cdr API does not accept start_date/end_date or operators
      // in querystring filters — it triggers internal SQL errors. We always
      // pull the latest N rows and rely on upsert to dedupe.
      const extra: Record<string, string> = { limit: String(params.limit ?? b.limit ?? 100) };
      if (extension) extra.extension = extension;



      const r = await fetchCdrsWithFallback(extra);
      if (!r.ok) {
        await admin.from("pbx_sync_jobs").insert({
          organization_id, job_type: action, status: "failed",
          error: `No working CDR endpoint. Attempts: ${JSON.stringify(r.attempts).slice(0, 1500)}`,
          stats: {},
        });
        return json({ error: "NO_CDR_ENDPOINT", attempts: r.attempts }, 502);
      }
      const cdrs = r.records;
      let upserted = 0;
      if (cdrs.length > 0) {
        const rows = cdrs.map(mapCdr).filter((x) => x.pbx_uuid);
        const { error, count } = await admin.from("pbx_call_records").upsert(rows, { onConflict: "pbx_uuid", count: "exact" });
        if (!error) upserted = count ?? rows.length;
      }
      await admin.from("pbx_sync_jobs").insert({
        organization_id, job_type: action, status: "completed",
        completed_at: new Date().toISOString(),
        stats: { cdrs: upserted, fetched: cdrs.length, endpoint: r.endpoint, duration_ms: r.latency_ms },
      });
      try {
        await admin.from("audit_logs").insert({
          organization_id, action: "pbx_sync_completed", resource_type: "pbx_integration",
          metadata: { job_type: action, stats: { cdrs: upserted, fetched: cdrs.length, endpoint: r.endpoint }, duration_ms: r.latency_ms, timestamp: new Date().toISOString() },
        });
      } catch (auditErr: any) { console.warn("Audit log failed:", auditErr?.message); }
      return json({ ok: true, endpoint: r.endpoint, data: action === "list-cdrs" ? cdrs : undefined, stats: { cdrs: upserted, fetched: cdrs.length } });
    }

    // ---- Full sync ----
    if (action === "sync-all") {
      const t0 = Date.now();
      // Optional resources filter: ['extensions','devices','ivrs','queues','ring_groups','destinations','cdrs']
      const requested: string[] | null = Array.isArray((body as any).resources) ? (body as any).resources : null;
      const want = (k: string) => !requested || requested.includes(k);
      const tasks: Promise<{ k: string; r: any }>[] = [];
      if (want("extensions"))   tasks.push(pbxFetch(`extensions?${domainQ}`).then((r) => ({ k: "extensions", r })));
      if (want("devices"))      tasks.push(pbxFetch(`devices?${domainQ}`).then((r) => ({ k: "devices", r })));
      if (want("ivrs"))         tasks.push(pbxFetch(`ivr_menus?${domainQ}`).then((r) => ({ k: "ivr_menus", r })));
      if (want("queues"))       tasks.push(pbxFetch(`call_center_queues?${domainQ}`).then((r) => ({ k: "call_center_queues", r })));
      if (want("ring_groups"))  tasks.push(pbxFetch(`ring_groups?${domainQ}`).then((r) => ({ k: "ring_groups", r })));
      const results = await Promise.all(tasks);
      const cdrResult = want("cdrs") ? await fetchCdrsWithFallback({ limit: "200" }) : null;
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
        }
      }
      if (cdrResult?.ok) {
        const rows = cdrResult.records.map(mapCdr).filter((x: any) => x.pbx_uuid);
        await doUpsert("pbx_call_records", rows, "pbx_uuid", "cdrs");
      } else if (cdrResult) {
        errors.push(`cdrs: no working endpoint (tried ${cdrResult.attempts.length})`);
        stats["cdrs"] = 0;
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
      try {
        await admin.from("audit_logs").insert({
          organization_id, action: "pbx_sync_completed", resource_type: "pbx_integration",
          metadata: { job_type: "sync-all", stats, duration_ms, errors: errors.length, timestamp: new Date().toISOString() },
        });
      } catch (auditErr: any) { console.warn("Audit log failed:", auditErr?.message); }
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
