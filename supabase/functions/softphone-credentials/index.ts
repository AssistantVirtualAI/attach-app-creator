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
      .select("extension, organization_id, extension_id, display_name, sip_password, wss_url")
      .eq("portal_user_id", user.id)
      .maybeSingle();
    if (spErr) log("lookup by portal_user_id error", spErr.message);
    log("lookup by portal_user_id", { found: !!sp, extension: sp?.extension });

    // SECURITY: removed extension-300 fallback that leaked SIP credentials to unrelated users.
    // Users without a linked softphone account receive NO_SOFTPHONE_ACCOUNT below.
    if (false) {
      const { data: byExt, error: extErr } = await supabaseAdmin
        .from("pbx_softphone_users")
        .select("extension, organization_id, extension_id, display_name, sip_password, wss_url")
        .eq("extension", "300")
        .maybeSingle();
      if (extErr) log("fallback ext 300 error", extErr.message);
      log("fallback to extension 300", { found: !!byExt });
      sp = byExt || null;
    }

    if (!sp) {
      log("NO_SOFTPHONE_ACCOUNT");
      return json({ error: "NO_SOFTPHONE_ACCOUNT", message: "Contact your administrator to enable softphone" }, 404);
    }

    // Fixed Lemtel endpoints — overridable via Vault for other tenants
    const sipDomain = Deno.env.get("FUSIONPBX_SIP_DOMAIN") || "lemtel.lemtel.tel";
    const wssUrl = sp.wss_url || Deno.env.get("FUSIONPBX_WSS_URL") || "wss://lemtel.lemtel.tel:7443";
    const wssUrls = Array.from(new Set([
      wssUrl,
      "wss://lemtel.lemtel.tel:7443",
      "wss://pbxnode.lemtel.tel:7443",
      "wss://170.39.199.132:7443",
    ]));

    let password = sp.sip_password || "";
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
        const fpPwd = (fp as any)?.extension?.password
          || (fp as any)?.password
          || (fp as any)?.data?.password
          || "";
        if (fpPwd) {
          password = fpPwd;
          await supabase
            .from("pbx_softphone_users")
            .update({ sip_password: fpPwd })
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


    // Audit
    try {
      await supabase.from("audit_logs").insert({
        organization_id: sp.organization_id,
        user_id: user.id,
        action: "softphone_credentials_accessed",
        resource_type: "pbx_softphone",
        metadata: { extension: sp.extension },
      });
    } catch { /* non-fatal */ }

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
      portal_url: "https://avastatistic.ca",
      organization_id: sp.organization_id,
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
