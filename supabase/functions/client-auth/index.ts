import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { action, ...params } = await req.json();

    console.log(`Client auth action: ${action}`);

    switch (action) {
      case "login": {
        const { login_id, password } = params;
        
        if (!login_id || !password) {
          return new Response(
            JSON.stringify({ error: "Login ID et mot de passe requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find client by login_id
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, name, organization_id, theme, language, login_id, password_hash, status")
          .eq("login_id", login_id)
          .maybeSingle();

        if (clientError) {
          console.error("Error finding client:", clientError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la recherche du client" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!client) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (client.status !== "active") {
          return new Response(
            JSON.stringify({ error: "Ce compte est désactivé" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!client.password_hash) {
          return new Response(
            JSON.stringify({ error: "Aucun mot de passe défini. Contactez votre administrateur." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify password with bcrypt
        const passwordMatch = bcrypt.compareSync(password, client.password_hash);
        
        if (!passwordMatch) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Return client session data (without password_hash)
        const session = {
          clientId: client.id,
          clientName: client.name,
          organizationId: client.organization_id,
          theme: client.theme || "light",
          language: client.language || "fr",
        };

        return new Response(
          JSON.stringify({ success: true, session }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "login-by-agent-slug": {
        const { agent_slug, login_id, password } = params;
        
        if (!agent_slug || !login_id || !password) {
          return new Response(
            JSON.stringify({ error: "Agent slug, Login ID et mot de passe requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find agent by slug
        const { data: agent, error: agentError } = await supabase
          .from("agents")
          .select("id, name, slug, organization_id")
          .eq("slug", agent_slug)
          .maybeSingle();

        if (agentError || !agent) {
          console.error("Error finding agent:", agentError);
          return new Response(
            JSON.stringify({ error: "Agent non trouvé" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find client by login_id
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, name, organization_id, theme, language, login_id, password_hash, status")
          .eq("login_id", login_id)
          .maybeSingle();

        if (clientError) {
          console.error("Error finding client:", clientError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la recherche du client" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!client) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (client.status !== "active") {
          return new Response(
            JSON.stringify({ error: "Ce compte est désactivé" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!client.password_hash) {
          return new Response(
            JSON.stringify({ error: "Aucun mot de passe défini. Contactez votre administrateur." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify password with bcrypt
        const passwordMatch = bcrypt.compareSync(password, client.password_hash);
        
        if (!passwordMatch) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if client has access to this agent
        const { data: assignment, error: assignmentError } = await supabase
          .from("client_agent_assignments")
          .select("role, can_edit_knowledge, can_edit_prompt")
          .eq("client_id", client.id)
          .eq("agent_id", agent.id)
          .maybeSingle();

        if (assignmentError) {
          console.error("Error checking assignment:", assignmentError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la vérification des accès" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!assignment) {
          return new Response(
            JSON.stringify({ error: "Vous n'avez pas accès à cet agent" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Return portal session data
        const session = {
          clientId: client.id,
          clientName: client.name,
          organizationId: client.organization_id,
          agentId: agent.id,
          agentName: agent.name,
          agentSlug: agent.slug,
          role: assignment.role || "viewer",
          canEditKnowledge: assignment.can_edit_knowledge || assignment.role === "admin",
          canEditPrompt: assignment.can_edit_prompt || assignment.role === "admin",
          theme: client.theme || "light",
          language: client.language || "fr",
        };

        console.log(`Client ${client.name} logged in to agent ${agent.name} with role ${assignment.role}`);

        return new Response(
          JSON.stringify({ success: true, session }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "set-password": {
        const { client_id, password } = params;
        
        if (!client_id || !password) {
          return new Response(
            JSON.stringify({ error: "Client ID et mot de passe requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (password.length < 8) {
          return new Response(
            JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Hash the password
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        // Update client password
        const { error: updateError } = await supabase
          .from("clients")
          .update({ 
            password_hash: passwordHash,
            password_reset_token: null,
            password_reset_expires_at: null
          })
          .eq("id", client_id);

        if (updateError) {
          console.error("Error updating password:", updateError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la mise à jour du mot de passe" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Mot de passe défini avec succès" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset-password": {
        const { login_id, email, base_url } = params;
        
        if (!login_id && !email) {
          return new Response(
            JSON.stringify({ error: "Login ID ou email requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find client by login_id or email
        let query = supabase
          .from("clients")
          .select("id, name, email, organization_id");
        
        if (login_id) {
          query = query.eq("login_id", login_id);
        } else {
          query = query.eq("email", email);
        }

        const { data: client, error: clientError } = await query.maybeSingle();

        if (clientError || !client) {
          // Return success even if not found for security
          return new Response(
            JSON.stringify({ success: true, message: "Si un compte existe, un email de réinitialisation a été envoyé" }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!client.email) {
          return new Response(
            JSON.stringify({ error: "Aucun email associé à ce compte" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Generate reset token
        const resetToken = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 3600000); // 1 hour

        // Update client with reset token
        const { error: updateError } = await supabase
          .from("clients")
          .update({ 
            password_reset_token: resetToken,
            password_reset_expires_at: expiresAt.toISOString()
          })
          .eq("id", client.id);

        if (updateError) {
          console.error("Error setting reset token:", updateError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la génération du token" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Send email with Resend if configured
        if (resendApiKey) {
          try {
            const resetUrl = `${base_url || 'https://app.example.com'}/client/reset-password/${resetToken}`;
            
            const emailResponse = await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${resendApiKey}`,
              },
              body: JSON.stringify({
                from: "noreply@resend.dev",
                to: [client.email],
                subject: "Réinitialisation de votre mot de passe",
                html: `
                  <h1>Réinitialisation de mot de passe</h1>
                  <p>Bonjour ${client.name},</p>
                  <p>Vous avez demandé la réinitialisation de votre mot de passe.</p>
                  <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
                  <p><a href="${resetUrl}">Réinitialiser mon mot de passe</a></p>
                  <p>Ce lien expire dans 1 heure.</p>
                  <p>Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.</p>
                `,
              }),
            });
            
            if (!emailResponse.ok) {
              console.error("Email send error:", await emailResponse.text());
            } else {
              console.log("Reset email sent to:", client.email);
            }
          } catch (emailError) {
            console.error("Error sending email:", emailError);
          }
        }

        return new Response(
          JSON.stringify({ success: true, message: "Email de réinitialisation envoyé" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "verify-reset-token": {
        const { token, new_password } = params;
        
        if (!token || !new_password) {
          return new Response(
            JSON.stringify({ error: "Token et nouveau mot de passe requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (new_password.length < 8) {
          return new Response(
            JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find client by reset token
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select("id, password_reset_expires_at")
          .eq("password_reset_token", token)
          .maybeSingle();

        if (clientError || !client) {
          return new Response(
            JSON.stringify({ error: "Token invalide ou expiré" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if token is expired
        if (client.password_reset_expires_at && new Date(client.password_reset_expires_at) < new Date()) {
          return new Response(
            JSON.stringify({ error: "Token expiré. Demandez une nouvelle réinitialisation." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Hash the new password
        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(new_password, salt);

        // Update client password and clear reset token
        const { error: updateError } = await supabase
          .from("clients")
          .update({ 
            password_hash: passwordHash,
            password_reset_token: null,
            password_reset_expires_at: null
          })
          .eq("id", client.id);

        if (updateError) {
          console.error("Error updating password:", updateError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la mise à jour du mot de passe" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Mot de passe réinitialisé avec succès" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: "Action non reconnue" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }
  } catch (error) {
    console.error("Client auth error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
