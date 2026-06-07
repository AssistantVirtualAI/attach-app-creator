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
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) return json({ error: "unauthorized" }, 401);

    const { data: sp } = await supabase
      .from("pbx_softphone_users")
      .select("extension, organization_id, extension_id, display_name, sip_password, wss_url")
      .eq("portal_user_id", user.id)
      .maybeSingle();

    if (!sp) return json({ error: "NO_SOFTPHONE_ACCOUNT", message: "Contact your administrator to enable softphone" }, 404);

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
