// Pulls the SIP password from FusionPBX and aligns it with pbx_softphone_users.sip_password.
// Use this when the softphone gets 403 Rejected — typically the stored credential drifted.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const auth = req.headers.get("Authorization") || "";
    if (!auth) return json({ error: "unauthorized" }, 401);

    const sb = createClient(SUPABASE_URL, SERVICE, { global: { headers: { Authorization: auth } } });
    const admin = createClient(SUPABASE_URL, SERVICE);

    const { data: { user } } = await sb.auth.getUser();
    if (!user) return json({ error: "unauthorized" }, 401);

    const body = await req.json().catch(() => ({}));
    const extensionArg: string | undefined = body?.extension;

    let spu: any;
    if (extensionArg) {
      const { data } = await admin
        .from("pbx_softphone_users")
        .select("id, extension, organization_id, extension_id, portal_user_id, sip_password")
        .eq("extension", extensionArg).maybeSingle();
      spu = data;
    } else {
      const { data } = await admin
        .from("pbx_softphone_users")
        .select("id, extension, organization_id, extension_id, portal_user_id, sip_password")
        .eq("portal_user_id", user.id).maybeSingle();
      spu = data;
    }
    if (!spu) return json({ error: "NOT_FOUND" }, 404);

    if (spu.portal_user_id !== user.id) {
      const { data: isAdmin } = await admin.rpc("is_lemtel_admin", { _user_id: user.id });
      if (!isAdmin) {
        const { data: isSuper } = await admin.rpc("is_super_admin", { _user_id: user.id });
        if (!isSuper) return json({ error: "forbidden" }, 403);
      }
    }

    // Pull live extension from FusionPBX
    const { data: fp, error: fpErr } = await admin.functions.invoke("fusionpbx-proxy", {
      body: { action: "get-extension", extension: spu.extension, organization_id: spu.organization_id },
    });
    if (fpErr) return json({ error: "PBX_GET_FAILED", details: fpErr.message }, 502);

    const pwd: string =
      (fp as any)?.extension?.password ||
      (fp as any)?.password ||
      (fp as any)?.data?.password ||
      (fp as any)?.extension?.sip_password ||
      "";

    if (!pwd) return json({ error: "PBX_HAS_NO_PASSWORD", message: "FusionPBX did not return a password for this extension. Reset it from the portal." }, 424);

    const changed = pwd !== spu.sip_password;
    if (changed) {
      await admin.from("pbx_softphone_users")
        .update({ sip_password: pwd, updated_at: new Date().toISOString() })
        .eq("id", spu.id);

      // mirror onto pbx_extensions.raw_data if present
      if (spu.extension_id) {
        const { data: ext } = await admin.from("pbx_extensions").select("raw_data").eq("id", spu.extension_id).maybeSingle();
        const raw = (ext?.raw_data as any) || {};
        raw.password = pwd;
        await admin.from("pbx_extensions").update({ raw_data: raw }).eq("id", spu.extension_id);
      }

      await admin.from("audit_logs").insert({
        organization_id: spu.organization_id,
        user_id: user.id,
        action: "softphone_password_synced",
        resource_type: "pbx_softphone",
        metadata: { extension: spu.extension },
      });
    }

    return json({ ok: true, extension: spu.extension, changed });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
