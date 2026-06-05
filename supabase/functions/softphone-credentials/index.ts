// Returns SIP credentials for the authenticated user's softphone extension.
// Reads sip_password from pbx_extensions.raw_data.password (synced from FusionPBX)
// or returns mock credentials if pbx_integrations.config.mock_mode is true.
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
      .select("extension, sip_domain, organization_id, extension_id, display_name")
      .eq("portal_user_id", user.id)
      .maybeSingle();

    if (!sp) return json({ error: "no_softphone_user" }, 404);

    const { data: integ } = await supabase
      .from("pbx_integrations")
      .select("base_url, domain, config")
      .eq("organization_id", sp.organization_id)
      .maybeSingle();

    const mock = integ?.config && (integ.config as any).mock_mode === true;
    const wssUrl = Deno.env.get("FUSIONPBX_WSS_URL") || (integ?.config as any)?.wss_url || "wss://portal.lemtel.tel:7443";
    const sipDomain = Deno.env.get("FUSIONPBX_SIP_DOMAIN") || sp.sip_domain || integ?.domain || "portal.lemtel.tel";


    let password = "";
    if (mock) {
      password = "mock-password";
    } else if (sp.extension_id) {
      const { data: ext } = await supabase
        .from("pbx_extensions")
        .select("raw_data")
        .eq("id", sp.extension_id)
        .maybeSingle();
      password = (ext?.raw_data as any)?.password || (ext?.raw_data as any)?.sip_password || "";
    }

    return json({
      extension: sp.extension,
      displayName: sp.display_name || sp.extension,
      sipDomain,
      wssUrl,
      password,
      mock,
    });
  } catch (err) {
    console.error("softphone-credentials error", err);
    return json({ error: String(err) }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
