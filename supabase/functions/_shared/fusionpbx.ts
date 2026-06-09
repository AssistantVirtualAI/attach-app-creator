// Shared FusionPBX helpers for sync edge functions
import { createClient } from "npm:@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export const FUSIONPBX_API_URL = Deno.env.get("FUSIONPBX_API_URL") || "";
export const FUSIONPBX_API_KEY = Deno.env.get("FUSIONPBX_API_KEY") || "";
export const FUSIONPBX_DOMAIN_UUID = Deno.env.get("FUSIONPBX_DOMAIN_UUID") || "";
export const FUSIONPBX_SIP_DOMAIN = Deno.env.get("FUSIONPBX_SIP_DOMAIN") || "";
export const FUSIONPBX_USERNAME = Deno.env.get("FUSIONPBX_USERNAME") || "";

export function adminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export async function fpbxFetch(path: string, init: RequestInit = {}): Promise<Response> {
  if (!FUSIONPBX_API_URL || !FUSIONPBX_API_KEY) {
    throw new Error("FusionPBX credentials not configured");
  }
  const url = `${FUSIONPBX_API_URL.replace(/\/$/, "")}${path}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      "Authorization": `Bearer ${FUSIONPBX_API_KEY}`,
      "X-Domain-Uuid": FUSIONPBX_DOMAIN_UUID,
      "Accept": "application/json",
      ...(init.headers || {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`FusionPBX ${path} -> ${res.status}: ${body.slice(0, 300)}`);
  }
  return res;
}

export async function fpbxJson<T = any>(path: string): Promise<T> {
  const res = await fpbxFetch(path);
  return await res.json() as T;
}

export type SyncRunResult = {
  rows_synced: number;
  ok: boolean;
  error?: string;
};

export async function runSync(
  source: string,
  organization_id: string,
  worker: () => Promise<{ rows_synced: number }>,
): Promise<SyncRunResult> {
  const supa = adminClient();
  const started = new Date().toISOString();
  const { data: job } = await supa
    .from("telecom_sync_jobs")
    .insert({ organization_id, source, status: "running", started_at: started })
    .select("id").single();

  try {
    const { rows_synced } = await worker();
    const finished = new Date().toISOString();
    if (job?.id) {
      await supa.from("telecom_sync_jobs").update({
        status: "ok", finished_at: finished, rows_synced,
      }).eq("id", job.id);
    }
    await supa.from("telecom_sync_health").upsert({
      organization_id, source,
      status: "ok",
      last_run_at: finished,
      last_heartbeat_at: finished,
      last_error: null,
      consecutive_failures: 0,
      rows_synced,
    }, { onConflict: "organization_id,source" });
    return { rows_synced, ok: true };
  } catch (e: any) {
    const finished = new Date().toISOString();
    const msg = String(e?.message || e).slice(0, 1000);
    if (job?.id) {
      await supa.from("telecom_sync_jobs").update({
        status: "failed", finished_at: finished, error_message: msg,
      }).eq("id", job.id);
    }
    const { data: prev } = await supa.from("telecom_sync_health")
      .select("consecutive_failures").eq("organization_id", organization_id).eq("source", source).maybeSingle();
    await supa.from("telecom_sync_health").upsert({
      organization_id, source,
      status: "failed",
      last_run_at: finished,
      last_heartbeat_at: finished,
      last_error: msg,
      consecutive_failures: (prev?.consecutive_failures || 0) + 1,
    }, { onConflict: "organization_id,source" });
    return { rows_synced: 0, ok: false, error: msg };
  }
}

export async function resolveOrgIds(body: any): Promise<string[]> {
  if (body?.organization_id) return [body.organization_id];
  const supa = adminClient();
  const { data } = await supa.from("organizations").select("id").eq("is_active", true);
  return (data || []).map((o: any) => o.id);
}
