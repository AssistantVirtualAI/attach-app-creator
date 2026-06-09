// Shared FusionPBX helper for telecom sync edge functions.
// All secrets live server-side. Each call records a row in telecom_sync_jobs.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function getServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

export interface SyncJobLogger {
  jobId: string;
  finish: (status: "success" | "error", patch?: Record<string, unknown>) => Promise<void>;
}

export async function startSyncJob(
  supabase: SupabaseClient,
  organizationId: string | null,
  source: string,
  target: string,
): Promise<SyncJobLogger> {
  const { data, error } = await supabase
    .from("telecom_sync_jobs")
    .insert({ organization_id: organizationId, source, target, status: "running" })
    .select("id")
    .single();
  if (error) throw error;
  const jobId = data!.id as string;
  return {
    jobId,
    finish: async (status, patch = {}) => {
      await supabase
        .from("telecom_sync_jobs")
        .update({ status, finished_at: new Date().toISOString(), ...patch })
        .eq("id", jobId);
    },
  };
}

export async function heartbeat(
  supabase: SupabaseClient,
  organizationId: string | null,
  source: string,
  ok: boolean,
  details: Record<string, unknown> = {},
) {
  await supabase.from("telecom_sync_health").upsert(
    {
      organization_id: organizationId,
      source,
      last_heartbeat_at: new Date().toISOString(),
      status: ok ? "healthy" : "degraded",
      details,
    },
    { onConflict: "organization_id,source" },
  );
}

export async function callFusionPBX(action: string, body: Record<string, unknown> = {}) {
  const url = Deno.env.get("SUPABASE_URL")! + "/functions/v1/fusionpbx-proxy";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!}`,
      apikey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    },
    body: JSON.stringify({ action, ...body }),
  });
  if (!res.ok) throw new Error(`fusionpbx-proxy ${action}: ${res.status}`);
  return await res.json().catch(() => ({}));
}

const LEMTEL_ORG_ID = "71755d33-ed64-4ad5-a828-61c9d2029eb7";

export async function orgIdsToSync(supabase: SupabaseClient, body: Record<string, unknown>): Promise<string[]> {
  if (typeof body.organizationId === "string") return [body.organizationId];
  // default: lemtel + any org with FusionPBX enabled
  const { data } = await supabase
    .from("organizations")
    .select("id")
    .eq("is_active", true)
    .limit(50);
  const ids = (data ?? []).map((r: any) => r.id as string);
  if (!ids.includes(LEMTEL_ORG_ID)) ids.unshift(LEMTEL_ORG_ID);
  return ids;
}
