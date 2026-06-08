import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend@3";

const TEMPLATES: Record<string, { subject: string; html: (v: any) => string }> = {
  welcome: {
    subject: "Welcome to {{brand_name}}!",
    html: (v) => `
<!doctype html><html><body style="font-family:Inter,sans-serif;background:#f5f7fb;padding:24px">
  <div style="max-width:560px;margin:auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e6e8ee">
    <div style="background:${v.brand_primary_color || "#003DA6"};color:white;padding:24px">
      <h1 style="margin:0">Welcome to ${v.brand_name}</h1>
    </div>
    <div style="padding:24px;color:#1a1f36">
      <p>Hi ${v.user_name},</p>
      <p>Your account is ready. You can log in to your portal at:</p>
      <p><a href="${v.portal_url}" style="background:${v.brand_primary_color || "#003DA6"};color:white;padding:10px 18px;border-radius:6px;text-decoration:none;display:inline-block">Open portal</a></p>
      <p>Email: <strong>${v.to || ""}</strong><br/>Temporary password: <code>${v.temp_password}</code></p>
      <p>Please change your password after first login.</p>
      <hr/>
      <p style="font-size:12px;color:#6b7280">Need help? Contact ${v.support_email}</p>
    </div>
  </div>
</body></html>`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const { org_id, to, template, variables } = await req.json();
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: org } = await admin
      .from("organizations")
      .select("brand_name,brand_primary_color,brand_support_email,brand_app_name")
      .eq("id", org_id)
      .maybeSingle();

    const vars = {
      brand_name: org?.brand_name || org?.brand_app_name || "Lemtel Telecom",
      brand_primary_color: org?.brand_primary_color || "#003DA6",
      support_email: org?.brand_support_email || "support@avastatistic.ca",
      to,
      ...variables,
    };

    const tpl = TEMPLATES[template];
    if (!tpl) return new Response(JSON.stringify({ error: "unknown_template" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const subject = tpl.subject.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
    const html = tpl.html(vars);

    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      console.log("RESEND_API_KEY missing, would have sent:", { to, subject });
      return new Response(JSON.stringify({ ok: true, simulated: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from: `${vars.brand_name} <noreply@avastatistic.ca>`,
      to: [to],
      subject,
      html,
    });
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, id: data?.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
