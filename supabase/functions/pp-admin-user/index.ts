import { authBroker, corsHeaders, jsonResponse, supaAdmin } from "../_shared/ns-broker.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await authBroker(req);
    if ("error" in auth) return auth.error;
    const { profile } = auth;
    if (profile.role !== "admin") return jsonResponse({ success: false, error: "Admin requis" }, 403);

    const admin = supaAdmin();
    const body = await req.json().catch(() => ({}));
    const { action, payload } = body ?? {};

    if (action === "create") {
      const { email, password, full_name, ns_extension, mobile_app_enabled, voice_agent_enabled, elevenlabs_agent_id } = payload ?? {};
      if (!email || !password || !full_name || !ns_extension) {
        return jsonResponse({ success: false, error: "Champs requis manquants" }, 400);
      }
      // Unique extension check
      const { data: existing } = await admin.from("planipret_profiles").select("id").eq("extension", ns_extension).maybeSingle();
      if (existing) return jsonResponse({ success: false, error: "Extension déjà utilisée" }, 400);

      const { data: created, error: cErr } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
      });
      if (cErr || !created.user) return jsonResponse({ success: false, error: cErr?.message ?? "Échec création auth" }, 200);

      const { error: pErr } = await admin.from("planipret_profiles").insert({
        user_id: created.user.id,
        organization_id: profile.organization_id,
        email,
        full_name,
        extension: ns_extension,
        ns_domain: "planipret.ca",
        role: "broker",
        mobile_app_enabled: mobile_app_enabled ?? true,
        voice_agent_enabled: voice_agent_enabled ?? false,
        elevenlabs_agent_id: elevenlabs_agent_id || null,
      });
      if (pErr) {
        await admin.auth.admin.deleteUser(created.user.id);
        return jsonResponse({ success: false, error: pErr.message }, 200);
      }
      return jsonResponse({ success: true, user_id: created.user.id });
    }

    if (action === "update") {
      const { user_id, updates } = payload ?? {};
      if (!user_id) return jsonResponse({ success: false, error: "user_id requis" }, 400);
      const allowed: any = {};
      for (const k of ["full_name", "extension", "mobile_app_enabled", "voice_agent_enabled", "elevenlabs_agent_id"]) {
        if (k in (updates ?? {})) allowed[k] = updates[k];
      }
      const { error } = await admin.from("planipret_profiles").update(allowed).eq("user_id", user_id);
      if (error) return jsonResponse({ success: false, error: error.message }, 200);
      return jsonResponse({ success: true });
    }

    if (action === "delete") {
      const { user_id } = payload ?? {};
      if (!user_id) return jsonResponse({ success: false, error: "user_id requis" }, 400);
      await admin.from("planipret_profiles").delete().eq("user_id", user_id);
      await admin.auth.admin.deleteUser(user_id).catch(() => null);
      return jsonResponse({ success: true });
    }

    if (action === "reset_password") {
      const { email } = payload ?? {};
      const redirectTo = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") ?? ""}/reset-password`;
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return jsonResponse({ success: false, error: error.message }, 200);
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("pp-admin-user", e);
    return jsonResponse({ success: false, error: String(e) }, 200);
  }
});
