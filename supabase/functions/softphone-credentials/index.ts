// Returns SIP credentials for the authenticated softphone user.
// Reads the SIP password from pbx_softphone_users.sip_password (or
// pbx_extensions.raw_data.password as fallback) and returns the fixed
// Lemtel FusionPBX SIP/WSS endpoint.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const te = new TextEncoder();
const td = new TextDecoder();
const b64 = {
  enc: (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)),
  dec: (value: string) => Uint8Array.from(atob(value), (c) => c.charCodeAt(0)),
};
async function importAesKey(secret: string) {
  const material = await crypto.subtle.digest("SHA-256", te.encode(secret));
  return crypto.subtle.importKey("raw", material, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}
async function encryptSecret(value: string) {
  const secret = Deno.env.get("PBX_SECRETS_KEY") || Deno.env.get("PBX_ENCRYPTION_KEY") || "";
  if (!secret || !value) return null;
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await importAesKey(secret), te.encode(value)));
  return `aesgcm:${b64.enc(iv)}:${b64.enc(cipher)}`;
}
async function decryptSecret(value?: string | null) {
  if (!value?.startsWith("aesgcm:")) return value || "";
  const secret = Deno.env.get("PBX_SECRETS_KEY") || Deno.env.get("PBX_ENCRYPTION_KEY") || "";
  if (!secret) return "";
  const [, ivB64, cipherB64] = value.split(":");
  try {
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.dec(ivB64) }, await importAesKey(secret), b64.dec(cipherB64));
    return td.decode(plain);
  } catch (_e) {
    return "";
  }
}
async function safeAudit(client: any, row: Record<string, unknown>) {
  try { await client.from("audit_logs").insert(row); } catch { /* non-fatal */ }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const reqId = crypto.randomUUID().slice(0, 8);
  const log = (...args: unknown[]) => console.log(`[softphone-credentials ${reqId}]`, ...args);
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error(`[softphone-credentials ${reqId}] missing env`, {
        hasUrl: !!SUPABASE_URL,
        hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return json({
        error: "MISSING_ENV",
        message: "Server misconfigured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
        details: { hasUrl: !!SUPABASE_URL, hasServiceKey: !!SUPABASE_SERVICE_ROLE_KEY },
      }, 500);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      log("missing Authorization header");
      return json({ error: "unauthorized" }, 401);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    // Admin client without auth header for sensitive reads (bypasses RLS).
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    const user = userData?.user;
    if (userErr) log("auth.getUser error", userErr.message);
    if (!user) {
      log("no authenticated user");
      return json({ error: "unauthorized" }, 401);
    }
    log("authenticated user", { id: user.id, email: user.email });

    const { data: sp, error: spErr } = await supabaseAdmin
      .from("pbx_softphone_users")
      .select("extension, organization_id, extension_id, display_name, sip_password, sip_password_encrypted, sip_domain, wss_url")
      .eq("portal_user_id", user.id)
      .maybeSingle();
    if (spErr) log("lookup by portal_user_id error", spErr.message);
    log("lookup by portal_user_id", { found: !!sp, extension: sp?.extension });

    // SECURITY: removed extension-300 fallback that leaked SIP credentials to unrelated users.

    if (!sp) {
      log("NO_SOFTPHONE_ACCOUNT");
      return json({ error: "NO_SOFTPHONE_ACCOUNT", message: "Contact your administrator to enable softphone" }, 404);
    }

    const { data: org } = await supabaseAdmin
      .from("organizations")
      .select("name, sip_domain, fusionpbx_domain_uuid")
      .eq("id", sp.organization_id)
      .maybeSingle();
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("organization_id", sp.organization_id)
      .maybeSingle();
    const role = roleRow?.role || "agent";
    const admin = role === "org_admin" || role === "super_admin" || role === "manager";

    // Per-domain endpoints. A softphone user can override the SIP/WSS host, otherwise the organization domain is used.
    const sipDomain = sp.sip_domain || org?.sip_domain || Deno.env.get("FUSIONPBX_SIP_DOMAIN") || "lemtel.lemtel.tel";
    const wssUrl = sp.wss_url || Deno.env.get("FUSIONPBX_WSS_URL") || `wss://${sipDomain}:7443`;
    const wssUrls = Array.from(new Set([
      wssUrl,
      `wss://${sipDomain}:7443`,
    ]));

    let password = await decryptSecret((sp as any).sip_password_encrypted) || await decryptSecret(sp.sip_password) || "";
    if (!password && sp.extension_id) {
      const { data: ext } = await supabase
        .from("pbx_extensions").select("raw_data").eq("id", sp.extension_id).maybeSingle();
      password = (ext?.raw_data as any)?.password || (ext?.raw_data as any)?.sip_password || "";
    }

    // Fallback: ask FusionPBX directly via proxy, then persist for next time.
    if (!password) {
      try {
        const { data: fp } = await supabase.functions.invoke("fusionpbx-proxy", {
          body: { action: "get-extension", extension: sp.extension },
        });
        const fpExtension = (fp as any)?.extension || (fp as any)?.extensions?.[0] || (fp as any)?.data?.extensions?.[0] || (Array.isArray(fp) ? (fp as any)[0] : null);
        const fpPwd = fpExtension?.password
          || fpExtension?.sip_password
          || (fp as any)?.password
          || (fp as any)?.data?.password
          || "";
        if (fpPwd) {
          password = fpPwd;
          const encrypted = await encryptSecret(fpPwd);
          const updatePayload: Record<string, unknown> = encrypted
            ? { sip_password_encrypted: encrypted, sip_password: null }
            : { sip_password: fpPwd };
          await supabaseAdmin
            .from("pbx_softphone_users")
            .update(updatePayload)
            .eq("portal_user_id", user.id);
        }
      } catch (_e) { /* non-fatal */ }
    }

    if (!password) {
      return json({
        error: "NO_SIP_PASSWORD",
        message: "Your extension is missing a SIP password. Contact your administrator or open the portal to configure it.",
      }, 424);
    }


    await safeAudit(supabaseAdmin, {
      organization_id: sp.organization_id,
      user_id: user.id,
      action: "softphone_credentials_accessed",
      resource_type: "pbx_softphone",
      metadata: { extension: sp.extension, credential_source: (sp as any).sip_password_encrypted ? "encrypted" : "legacy" },
    });

    return json({
      // SIP
      extension: sp.extension,
      display_name: sp.display_name || sp.extension,
      displayName: sp.display_name || sp.extension,
      sip_domain: sipDomain,
      sipDomain,
      wss_url: wssUrl,
      wssUrl,
      wss_urls: wssUrls,
      wssUrls,
      sip_password: password,
      password,
      // App config
      portal_url: Deno.env.get("AVA_PORTAL_URL") || "https://avastatistic.ca",
      organization_id: sp.organization_id,
      organization_name: org?.name || undefined,
      fusionpbx_domain_uuid: org?.fusionpbx_domain_uuid || undefined,
      role,
      data_scope: admin ? "domain_admin" : "extension_user",
      permissions: { admin, can_manage_numbers: admin, can_manage_agents: admin, can_manage_users: role === "org_admin" || role === "super_admin", can_manage_routing: admin, can_view_domain_reports: admin },
      // User
      email: user.email,
      user_id: user.id,
      // Flags
      can_record: true,
      can_sms: true,
      can_ai: true,
      mock: false,
    });
  } catch (err) {
    console.error("softphone-credentials error", err);
    return json({ error: String(err) }, 500);
  }
});
