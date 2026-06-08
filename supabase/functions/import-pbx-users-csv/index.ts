// Bulk-import users + extensions for a given customer organization.
// CSV columns (FusionPBX-compatible):
//   extension,password,voicemail_password,first_name,last_name,email,call_group,user_record,enabled,description
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

interface Row {
  extension: string;
  password?: string;
  voicemail_password?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  call_group?: string;
  user_record?: string;
  enabled?: string;
  description?: string;
}

function randomPassword(len = 14) {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader) return json({ error: "unauthenticated" }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "unauthenticated" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json();
    const organization_id: string = body.organization_id;
    const rows: Row[] = body.rows || [];
    const generatePasswords: boolean = body.generate_passwords !== false;
    if (!organization_id) return json({ error: "organization_id required" }, 400);
    if (!Array.isArray(rows) || !rows.length) return json({ error: "rows required" }, 400);

    // Authorization: caller must be master/super-admin or member of this org with can_manage_users
    const { data: isMaster } = await admin.rpc("is_master_admin", { _user_id: user.id });
    let allowed = !!isMaster;
    if (!allowed) {
      const { data: m } = await admin
        .from("org_members")
        .select("can_manage_users")
        .eq("user_id", user.id)
        .eq("org_id", organization_id)
        .eq("can_manage_users", true)
        .maybeSingle();
      allowed = !!m;
    }
    if (!allowed) return json({ error: "forbidden" }, 403);

    // Look up customer org for FusionPBX domain
    const { data: org } = await admin
      .from("organizations")
      .select("id, slug, fusionpbx_domain_uuid, fusionpbx_domain_name")
      .eq("id", organization_id)
      .maybeSingle();
    if (!org) return json({ error: "organization not found" }, 404);

    const results: Array<{ extension: string; ok: boolean; error?: string; user_id?: string }> = [];

    for (const row of rows) {
      const ext = String(row.extension || "").trim();
      if (!ext) {
        results.push({ extension: "(empty)", ok: false, error: "extension required" });
        continue;
      }
      const password = (!generatePasswords && row.password) ? row.password : randomPassword(14);
      const vmPassword = row.voicemail_password || ext;
      const fullName = `${row.first_name || ""} ${row.last_name || ""}`.trim() || ext;
      const email = (row.email || "").trim().toLowerCase();

      try {
        // 1. create extension via proxy
        const extRes = await admin.functions.invoke("fusionpbx-proxy", {
          body: {
            organization_id,
            action: "create-extension",
            data: {
              extension: ext,
              password,
              voicemail_password: vmPassword,
              effective_caller_id_name: fullName,
              outbound_caller_id_name: fullName,
              call_group: row.call_group || "",
              user_record: row.user_record || "none",
              description: row.description || fullName,
              voicemail_enabled: "true",
              voicemail_mail_to: email,
              domain_uuid: org.fusionpbx_domain_uuid || undefined,
            },
          },
        });
        if (extRes.error || extRes.data?.error) {
          throw new Error(extRes.data?.message || extRes.error?.message || "FusionPBX create-extension failed");
        }

        // 2. auth user (best-effort)
        let userId: string | undefined;
        if (email) {
          const { data: existing } = await admin
            .from("profiles").select("id").eq("email", email).maybeSingle();
          if (existing?.id) {
            userId = existing.id;
          } else {
            const { data: created, error: cErr } = await admin.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { full_name: fullName },
            });
            if (cErr) console.warn("auth.create:", cErr.message);
            userId = created?.user?.id;
          }
          if (userId) {
            await admin.from("organization_members").upsert({
              user_id: userId, organization_id, accepted_at: new Date().toISOString(),
            }, { onConflict: "user_id,organization_id" });
            await admin.from("user_roles").upsert({
              user_id: userId, organization_id, role: "user" as any,
            }, { onConflict: "user_id,organization_id,role" });
          }
        }

        // 3. softphone user
        await admin.from("pbx_softphone_users").upsert({
          organization_id,
          extension: ext,
          display_name: fullName,
          portal_user_id: userId || null,
          account_status: "active",
        }, { onConflict: "organization_id,extension" });

        results.push({ extension: ext, ok: true, user_id: userId });
      } catch (e: any) {
        results.push({ extension: ext, ok: false, error: e?.message || String(e) });
      }
    }

    // trigger a final sync
    try {
      await admin.functions.invoke("realtime-sync", {
        body: { organizationId: organization_id, kind: "extensions" },
      });
    } catch { /* ignore */ }

    const succeeded = results.filter((r) => r.ok).length;
    return json({ ok: true, total: rows.length, succeeded, failed: rows.length - succeeded, results });
  } catch (e: any) {
    console.error("import-pbx-users-csv:", e);
    return json({ error: e?.message || String(e) }, 500);
  }
});
