import { authBroker, corsHeaders, jsonResponse, logAudit, supaAdmin } from "../_shared/ns-broker.ts";

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
      await admin.from("user_roles").upsert({
        user_id: created.user.id,
        organization_id: profile.organization_id,
        role: "planipret_broker",
      }, { onConflict: "user_id,organization_id" });
      await logAudit(admin, req, {
        admin_id: profile.id, action: "USER_CREATE",
        resource_type: "user", resource_id: created.user.id,
        metadata: { email, extension: ns_extension },
      });

      // Welcome sequence (best-effort, non-blocking)
      try {
        const appUrl = "https://avastatistic.ca/mplanipret";
        const html = `
          <div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1A1A2E">
            <h1 style="color:#1F4E79;margin:0 0 12px">Bienvenue sur Planiprêt AI Portal 🎉</h1>
            <p>Bonjour <strong>${full_name}</strong>,</p>
            <p>Votre accès est prêt. Voici vos informations :</p>
            <ul style="background:#F4F8FC;padding:16px 24px;border-radius:8px">
              <li><strong>Extension :</strong> ${ns_extension}</li>
              <li><strong>Domaine :</strong> planipret.ca</li>
              <li><strong>Email :</strong> ${email}</li>
            </ul>
            <p style="text-align:center;margin:24px 0">
              <a href="${appUrl}" style="background:#1F4E79;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Ouvrir Planiprêt AI</a>
            </p>
            <p><img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}" alt="QR code" /></p>
            <h3>Démarrage en 3 étapes</h3>
            <ol>
              <li>Connectez-vous à l'app et acceptez la politique de confidentialité</li>
              <li>Ajoutez l'app à votre écran d'accueil (PWA)</li>
              <li>Connectez Microsoft 365 dans Plus → Intégrations</li>
            </ol>
            <p style="font-size:12px;color:#94A3B8;margin-top:32px">Support : support@avastatistic.ca</p>
          </div>`;
        await admin.functions.invoke("send-transactional-email", {
          body: { to: email, subject: "Bienvenue sur Planiprêt AI Portal 🎉", html, from: "support@avastatistic.ca" },
        }).catch(() => null);

        // Welcome SMS via NS-API
        await admin.functions.invoke("ns-sms", {
          body: { action: "send", to: payload.phone_number, body: `Bonjour ${full_name}! Votre accès Planiprêt AI est prêt. Connectez-vous: ${appUrl} Extension: ${ns_extension} - Support: support@avastatistic.ca` },
        }).catch(() => null);
      } catch (e) { console.error("welcome sequence", e); }

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
      await logAudit(admin, req, {
        admin_id: profile.id, action: "USER_DELETE",
        resource_type: "user", resource_id: user_id,
      });
      return jsonResponse({ success: true });
    }

    if (action === "reset_password") {
      const { email } = payload ?? {};
      const redirectTo = `${Deno.env.get("SUPABASE_URL")?.replace(".supabase.co", ".lovable.app") ?? ""}/reset-password`;
      const { error } = await admin.auth.resetPasswordForEmail(email, { redirectTo });
      if (error) return jsonResponse({ success: false, error: error.message }, 200);
      await logAudit(admin, req, { admin_id: profile.id, action: "PASSWORD_RESET", metadata: { email } });
      return jsonResponse({ success: true });
    }

    return jsonResponse({ success: false, error: "Action inconnue" }, 400);
  } catch (e) {
    console.error("pp-admin-user", e);
    return jsonResponse({ success: false, error: String(e) }, 200);
  }
});
