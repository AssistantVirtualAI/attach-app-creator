import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function friendly(status: number, raw: string): string {
  if (status === 401 || status === 403) return "FusionPBX rejected the credentials. Verify Username and API Key in Settings.";
  if (status === 404) return "FusionPBX endpoint not found. Check the base URL and endpoint path.";
  if (status === 0) return "Could not reach FusionPBX server. Check the base URL or network.";
  if (status >= 500) return "FusionPBX server error. Try again shortly or check PBX logs.";
  return raw?.slice(0, 240) || `Request failed with status ${status}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  let organization_id: string | undefined;
  let endpoint = "", method = "GET";
  let userId: string | null = null;

  const logFailure = async (error: string, status: number, extra: Record<string, unknown> = {}) => {
    try {
      if (organization_id) {
        await admin.from("audit_logs").insert({
          organization_id,
          user_id: userId,
          action: "fusionpbx_proxy_error",
          resource_type: "pbx",
          metadata: { endpoint, method, status, error, ...extra },
        });
      }
    } catch (_) { /* swallow */ }
  };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    userId = user.id;

    const body = await req.json();
    endpoint = body.endpoint;
    method = body.method || "GET";
    organization_id = body.organization_id;
    const params = body.params;
    const reqBody = body.body;
    const action: string | undefined = body.action;

    // ---- Action-based dispatcher ----
    if (action) {
      if (action === "ping") {
        return new Response(
          JSON.stringify({ status: "ok", function: "fusionpbx-proxy", ts: Date.now() }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const requireSecret = (name: string) => {
        const v = Deno.env.get(name);
        if (!v) throw new Response(
          JSON.stringify({ error: "MISSING_SECRET", secret: name, message: `Configure ${name} in Supabase Vault` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
        return v;
      };

      try {
        const FUSIONPBX_API_URL = requireSecret("FUSIONPBX_API_URL");
        const FUSIONPBX_USERNAME = requireSecret("FUSIONPBX_USERNAME");
        const FUSIONPBX_API_KEY = requireSecret("FUSIONPBX_API_KEY");
        const FUSIONPBX_DOMAIN_UUID = Deno.env.get("FUSIONPBX_DOMAIN_UUID") || "";
        const basicAuth = `Basic ${btoa(`${FUSIONPBX_USERNAME}:${FUSIONPBX_API_KEY}`)}`;

        const pbxFetch = async (path: string, init: RequestInit = {}) => {
          const sep = path.includes("?") ? "&" : "?";
          const url = `${FUSIONPBX_API_URL}${path}${sep}key=${encodeURIComponent(FUSIONPBX_API_KEY)}&username=${encodeURIComponent(FUSIONPBX_USERNAME)}`;
          const r = await fetch(url, { ...init, headers: { Authorization: basicAuth, "Content-Type": "application/json", ...(init.headers || {}) } });
          const t = await r.text();
          if (r.status === 401 || r.status === 403) return { ok: false, status: r.status, error: "FUSIONPBX_AUTH_FAILED", message: "Invalid FusionPBX credentials" };
          if (r.status === 404) return { ok: false, status: 404, error: "NOT_FOUND", message: `Endpoint not found: ${path}` };
          let data: any; try { data = JSON.parse(t); } catch { data = { raw: t }; }
          return { ok: r.ok, status: r.status, data };
        };

        const domainQ = FUSIONPBX_DOMAIN_UUID ? `?domain_uuid=${FUSIONPBX_DOMAIN_UUID}` : "";
        const endpointMap: Record<string, { path: string }> = {
          "list-extensions":     { path: `/app/api/extensions${domainQ}` },
          "list-devices":        { path: `/app/api/devices${domainQ}` },
          "list-ivrs":           { path: `/app/api/ivr_menus${domainQ}` },
          "list-queues":         { path: `/app/api/call_center_queues${domainQ}` },
          "list-ring-groups":    { path: `/app/api/ring_groups${domainQ}` },
          "list-destinations":   { path: `/app/api/destinations${domainQ}` },
          "list-registrations":  { path: `/app/api/registrations${domainQ}` },
          "list-voicemails":     { path: `/app/api/voicemails${domainQ}` },
          "list-recordings":     { path: `/app/recordings/recordings.php${domainQ}` },
        };

        if (endpointMap[action]) {
          const started = Date.now();
          const r = await pbxFetch(endpointMap[action].path);
          return new Response(
            JSON.stringify({ ...r, latency_ms: Date.now() - started }),
            { status: r.ok ? 200 : (r.status || 500), headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        if (action === "get-cdrs" || action === "sync-cdrs") {
          const filterParams = new URLSearchParams({ order: "desc", limit: String(params?.limit || 100) });
          if (params?.extension) filterParams.set("extension", params.extension);
          if (params?.start_date) filterParams.set("start_date", params.start_date);
          if (params?.end_date) filterParams.set("end_date", params.end_date);
          if (params?.direction) filterParams.set("direction", params.direction);
          const r = await pbxFetch(`/app/xml_cdr/xml_cdr.php?${filterParams.toString()}`);
          if (!r.ok) {
            if (organization_id) await admin.from("pbx_sync_jobs").insert({
              organization_id, job_type: action, status: "failed",
              error_message: r.message || r.error, stats: {},
            });
            return new Response(JSON.stringify(r), { status: r.status || 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          }
          const cdrs: any[] = Array.isArray(r.data) ? r.data : (r.data?.data || []);
          let upserted = 0;
          if (organization_id && cdrs.length > 0) {
            const rows = cdrs.map((c: any) => ({
              organization_id,
              pbx_uuid: c.xml_cdr_uuid,
              direction: c.direction,
              caller_number: c.caller_id_number,
              destination: c.caller_destination,
              start_at: c.start_stamp,
              duration_seconds: c.duration ? parseInt(c.duration) : 0,
              billsec: c.billsec ? parseInt(c.billsec) : 0,
              mos: c.rtp_audio_in_mos ? parseFloat(c.rtp_audio_in_mos) : null,
              missed_call: c.missed_call === "true" || c.missed_call === true,
              has_recording: !!(c.record_name && c.record_name !== ""),
              recording_url: c.record_name ? `${c.record_path || ""}/${c.record_name}` : null,
              raw_data: c,
            }));
            const { error: upErr, count } = await admin.from("pbx_call_records").upsert(rows, { onConflict: "pbx_uuid", count: "exact" });
            if (!upErr) upserted = count || rows.length;
          }
          if (organization_id) await admin.from("pbx_sync_jobs").insert({
            organization_id, job_type: action, status: "completed",
            stats: { cdrs: upserted, fetched: cdrs.length },
          });
          return new Response(JSON.stringify({ ok: true, data: cdrs, stats: { cdrs: upserted } }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "sync-all") {
          const stats: Record<string, number> = {};
          const errors: string[] = [];
          for (const [name, m] of Object.entries(endpointMap)) {
            if (name === "list-registrations" || name === "list-recordings" || name === "list-voicemails") continue;
            try {
              const r = await pbxFetch(m.path);
              const arr = Array.isArray(r.data) ? r.data : (r.data?.data || []);
              stats[name.replace("list-", "")] = arr.length;
            } catch (e: any) { errors.push(`${name}: ${e.message}`); }
          }
          if (organization_id) {
            await admin.from("pbx_sync_jobs").insert({
              organization_id, job_type: "full-sync",
              status: errors.length ? "completed_with_errors" : "completed",
              stats, error_message: errors.length ? errors.join("; ") : null,
            });
            await admin.from("pbx_integrations").update({ last_sync_at: new Date().toISOString() }).eq("organization_id", organization_id);
          }
          return new Response(JSON.stringify({ success: true, stats, errors }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        if (action === "get-recording-url") {
          const { record_path, record_name } = params || {};
          if (!record_path || !record_name) return new Response(JSON.stringify({ error: "record_path and record_name required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          const url = `${FUSIONPBX_API_URL}/${record_path}/${record_name}?key=${encodeURIComponent(FUSIONPBX_API_KEY)}&username=${encodeURIComponent(FUSIONPBX_USERNAME)}`;
          const r = await fetch(url, { headers: { Authorization: basicAuth } });
          if (!r.ok) return new Response(JSON.stringify({ error: "FETCH_FAILED", status: r.status }), { status: r.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
          return new Response(r.body, { headers: { ...corsHeaders, "Content-Type": "audio/wav" } });
        }

        return new Response(JSON.stringify({ error: "UNKNOWN_ACTION", action }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      } catch (e) {
        if (e instanceof Response) return e;
        const msg = (e as Error)?.message || String(e);
        return new Response(JSON.stringify({ error: "FUSIONPBX_UNREACHABLE", message: msg }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    if (!endpoint || !organization_id) {
      return new Response(JSON.stringify({ error: "endpoint and organization_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: member } = await admin
      .from("organization_members").select("organization_id")
      .eq("user_id", user.id).eq("organization_id", organization_id).maybeSingle();
    if (!member) {
      await logFailure("Forbidden: user not a member of organization", 403);
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: integ } = await admin.from("pbx_integrations").select("*").eq("organization_id", organization_id).maybeSingle();
    if (!integ) {
      await logFailure("PBX integration not configured", 404);
      return new Response(JSON.stringify({ error: "PBX integration is not configured for this organization. Open Lemtel Settings to set the FusionPBX URL and credentials." }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (integ.config?.mock_mode) {
      return new Response(JSON.stringify({ data: [], mock: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!integ.base_url) {
      await logFailure("Missing base_url", 400);
      return new Response(JSON.stringify({ error: "FusionPBX base URL is missing. Set it in Lemtel Settings." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: cfgRows } = await admin.from("lemtel_config").select("key, value")
      .in("key", ["FUSIONPBX_USERNAME", "FUSIONPBX_API_KEY"]);
    const cfg = Object.fromEntries((cfgRows || []).map((r: any) => [r.key, r.value]));
    const username = integ.config?.username || cfg.FUSIONPBX_USERNAME;
    const apiKey = cfg.FUSIONPBX_API_KEY;
    if (!username || !apiKey) {
      await logFailure("Missing FusionPBX credentials", 500);
      return new Response(JSON.stringify({ error: "FusionPBX credentials missing. Add FUSIONPBX_USERNAME and FUSIONPBX_API_KEY in Lemtel Settings." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const sep = endpoint.includes("?") ? "&" : "?";
    const extra = new URLSearchParams({ username, key: apiKey, ...(params || {}) }).toString();
    const url = `${integ.base_url}${endpoint}${sep}${extra}`;
    const basic = btoa(`${username}:${apiKey}`);

    let res: Response;
    let text = "";
    try {
      res = await fetch(url, {
        method,
        body: reqBody ? (typeof reqBody === "string" ? reqBody : JSON.stringify(reqBody)) : undefined,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Basic ${basic}`,
        },
      });
      text = await res.text();
    } catch (netErr: any) {
      const errMsg = `Network error reaching FusionPBX: ${netErr?.message ?? String(netErr)}`;
      await logFailure(errMsg, 0);
      return new Response(JSON.stringify({ error: friendly(0, errMsg) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let json: any; try { json = JSON.parse(text); } catch { json = { raw: text }; }

    if (!res.ok) {
      const userMsg = friendly(res.status, text);
      await logFailure(userMsg, res.status, { response_preview: text.slice(0, 500) });
      return new Response(JSON.stringify({ error: userMsg, status: res.status }), {
        status: res.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("audit_logs").insert({
      organization_id, user_id: user.id,
      action: "fusionpbx_proxy", resource_type: "pbx",
      metadata: { endpoint, method, status: res.status },
    });

    return new Response(JSON.stringify({ data: json, status: res.status }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    await logFailure(e?.message ?? String(e), 500);
    return new Response(JSON.stringify({ error: e?.message ?? "Internal error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
