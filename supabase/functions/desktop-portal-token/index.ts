// Mints a short-lived magic link for the desktop softphone's embedded Portal tab.
// The desktop already has a valid Supabase JWT; we verify it and return a fresh
// session pair so the embedded webview/iframe can call `auth.setSession()`.
import { corsHeaders, jsonResponse, requireUser, getServiceClient } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const auth = await requireUser(req);
  if ("error" in auth) return auth.error;

  const admin = getServiceClient();

  // Generate a magic link for this user; extract action_link tokens
  const { data, error } = await (admin.auth as any).admin.generateLink({
    type: "magiclink",
    email: auth.user.email!,
  });
  if (error) return jsonResponse(500, { error: error.message });

  const props = (data as any)?.properties || {};
  const portalUrl = Deno.env.get("PORTAL_URL") || "https://avastatistic.ca";
  const target = `${portalUrl.replace(/\/$/, "")}/org/lemtel/my/dashboard?desktop=1`;

  return jsonResponse(200, {
    url: target,
    action_link: props.action_link,
    email_otp: props.email_otp,
    hashed_token: props.hashed_token,
    expires_in: 600,
  });
});
