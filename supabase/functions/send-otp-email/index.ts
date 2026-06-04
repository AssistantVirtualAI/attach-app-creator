import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface OTPEmailRequest {
  email: string;
  name?: string;
  organizationId: string;
}

// Generate a 6-digit OTP code
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured - Please add it in Cloud secrets");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { email, name, organizationId }: OTPEmailRequest = await req.json();

    if (!email || !organizationId) {
      throw new Error("Email and organizationId are required");
    }

    // Generate OTP code
    const otpCode = generateOTP();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Get the 2FA email template for the organization
    const { data: template } = await supabase
      .from("email_templates")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("template_type", "2fa")
      .single();

    // Get organization details for branding
    const { data: org } = await supabase
      .from("organizations")
      .select("name, email_sender, email_sender_name, email_logo_url")
      .eq("id", organizationId)
      .single();

    // Default template if none exists
    const subject = template?.subject || "Votre code de vérification";
    const greeting = template?.greeting || `Bonjour ${name || ""},`;
    let body = template?.body || `
      <p>Votre code de vérification est :</p>
      <h2 style="font-size: 32px; letter-spacing: 8px; text-align: center; padding: 20px; background: #f5f5f5; border-radius: 8px;">{{otp_code}}</h2>
      <p>Ce code expire dans 10 minutes.</p>
      <p>Si vous n'avez pas demandé ce code, ignorez cet email.</p>
    `;

    // Replace variables in template
    body = body
      .replace(/\{\{otp_code\}\}/g, otpCode)
      .replace(/\{\{name\}\}/g, name || "")
      .replace(/\{\{email\}\}/g, email)
      .replace(/\{\{company\}\}/g, org?.name || "")
      .replace(/\{\{date\}\}/g, new Date().toLocaleDateString("fr-FR"));

    const senderEmail = org?.email_sender || "noreply@resend.dev";
    const senderName = org?.email_sender_name || org?.name || "Verification";

    // Use fetch to call Resend API directly (avoiding Deno npm import issues)
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${senderName} <${senderEmail}>`,
        to: [email],
        subject: subject.replace(/\{\{otp_code\}\}/g, otpCode),
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <style>
              body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .logo { text-align: center; margin-bottom: 20px; }
              .logo img { max-height: 50px; }
            </style>
          </head>
          <body>
            <div class="container">
              ${org?.email_logo_url ? `<div class="logo"><img src="${org.email_logo_url}" alt="${org.name}" /></div>` : ""}
              <p>${greeting}</p>
              ${body}
            </div>
          </body>
          </html>
        `,
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(errorData.message || "Failed to send email");
    }

    const responseData = await emailResponse.json();
    console.log("OTP email sent successfully:", responseData);

    // SECURITY: Do NOT return the OTP code in the response.
    // It must only be delivered through the user's email so that an
    // unauthenticated caller cannot read it. Store the hashed code
    // server-side (e.g., in client_credentials.password_reset_token) and
    // verify it in a dedicated verify-otp function.
    return new Response(
      JSON.stringify({
        success: true,
        expiresAt: expiresAt.toISOString(),
        messageId: responseData.id,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  } catch (error: any) {
    console.error("Error sending OTP email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
});