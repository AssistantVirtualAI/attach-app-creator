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

        // Find agent by slug with platform info
        const { data: agent, error: agentError } = await supabase
          .from("agents")
          .select("id, name, slug, organization_id, platform, platform_agent_id")
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

        // Fetch API key from organization integration
        let platformApiKey: string | null = null;
        if (agent.platform && agent.organization_id) {
          const { data: integration } = await supabase
            .from("organization_integrations")
            .select("api_key")
            .eq("organization_id", agent.organization_id)
            .eq("platform", agent.platform)
            .eq("is_active", true)
            .maybeSingle();
          
          platformApiKey = integration?.api_key || null;
          console.log(`Found integration for platform ${agent.platform}: ${platformApiKey ? 'yes' : 'no'}`);
        }

        // Return portal session data with platform credentials
        const session = {
          clientId: client.id,
          clientName: client.name,
          organizationId: client.organization_id,
          agentId: agent.id,
          agentName: agent.name,
          agentSlug: agent.slug,
          platformAgentId: agent.platform_agent_id || undefined,
          platformApiKey: platformApiKey || undefined,
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

      // ========== MEMBER AUTHENTICATION ==========
      
      case "login-member": {
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
          .select("id, name, slug, organization_id, platform, platform_agent_id")
          .eq("slug", agent_slug)
          .maybeSingle();

        if (agentError || !agent) {
          return new Response(
            JSON.stringify({ error: "Agent non trouvé" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Find member by login_id
        const { data: member, error: memberError } = await supabase
          .from("client_members")
          .select("id, client_id, name, email, role, login_id, password_hash, status")
          .eq("login_id", login_id)
          .maybeSingle();

        if (memberError) {
          console.error("Error finding member:", memberError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la recherche" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!member) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (member.status !== "active") {
          return new Response(
            JSON.stringify({ error: "Ce compte est désactivé" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!member.password_hash) {
          return new Response(
            JSON.stringify({ error: "Aucun mot de passe défini. Contactez votre administrateur." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Verify password
        const memberPasswordMatch = bcrypt.compareSync(password, member.password_hash);
        if (!memberPasswordMatch) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get parent client info and check agent access
        const { data: client, error: clientFetchError } = await supabase
          .from("clients")
          .select("id, name, organization_id, theme, language")
          .eq("id", member.client_id)
          .maybeSingle();

        if (clientFetchError || !client) {
          return new Response(
            JSON.stringify({ error: "Client parent non trouvé" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if parent client has access to this agent
        const { data: assignment, error: assignmentError } = await supabase
          .from("client_agent_assignments")
          .select("role, can_edit_knowledge, can_edit_prompt")
          .eq("client_id", client.id)
          .eq("agent_id", agent.id)
          .maybeSingle();

        if (assignmentError || !assignment) {
          return new Response(
            JSON.stringify({ error: "Vous n'avez pas accès à cet agent" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Fetch platform API key
        let platformApiKey: string | null = null;
        if (agent.platform && agent.organization_id) {
          const { data: integration } = await supabase
            .from("organization_integrations")
            .select("api_key")
            .eq("organization_id", agent.organization_id)
            .eq("platform", agent.platform)
            .eq("is_active", true)
            .maybeSingle();
          platformApiKey = integration?.api_key || null;
        }

        // Update last login
        await supabase
          .from("client_members")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", member.id);

        // Member role determines permissions (admin members get full access, regular members get view only)
        const isAdminMember = member.role === "admin";
        
        const session = {
          clientId: client.id,
          clientName: client.name,
          organizationId: client.organization_id,
          agentId: agent.id,
          agentName: agent.name,
          agentSlug: agent.slug,
          platformAgentId: agent.platform_agent_id || undefined,
          platformApiKey: platformApiKey || undefined,
          role: isAdminMember ? assignment.role : "viewer",
          canEditKnowledge: isAdminMember && (assignment.can_edit_knowledge || assignment.role === "admin"),
          canEditPrompt: isAdminMember && (assignment.can_edit_prompt || assignment.role === "admin"),
          theme: client.theme || "light",
          language: client.language || "fr",
          // Member-specific fields
          memberType: "member" as const,
          memberId: member.id,
          memberName: member.name,
          memberEmail: member.email,
          memberRole: member.role,
        };

        console.log(`Member ${member.name} logged in to agent ${agent.name}`);

        return new Response(
          JSON.stringify({ success: true, session }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "change-password": {
        const { client_id, member_id, current_password, new_password } = params;
        
        if (!new_password || new_password.length < 8) {
          return new Response(
            JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!current_password) {
          return new Response(
            JSON.stringify({ error: "Le mot de passe actuel est requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Determine if changing client or member password
        if (member_id) {
          // Member password change
          const { data: member, error: memberError } = await supabase
            .from("client_members")
            .select("id, password_hash")
            .eq("id", member_id)
            .maybeSingle();

          if (memberError || !member) {
            return new Response(
              JSON.stringify({ error: "Membre non trouvé" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (!member.password_hash || !bcrypt.compareSync(current_password, member.password_hash)) {
            return new Response(
              JSON.stringify({ error: "Mot de passe actuel incorrect" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const salt = bcrypt.genSaltSync(10);
          const newHash = bcrypt.hashSync(new_password, salt);

          const { error: updateError } = await supabase
            .from("client_members")
            .update({ password_hash: newHash })
            .eq("id", member_id);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: "Erreur lors de la mise à jour" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (client_id) {
          // Client password change
          const { data: client, error: clientError } = await supabase
            .from("clients")
            .select("id, password_hash")
            .eq("id", client_id)
            .maybeSingle();

          if (clientError || !client) {
            return new Response(
              JSON.stringify({ error: "Client non trouvé" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          if (!client.password_hash || !bcrypt.compareSync(current_password, client.password_hash)) {
            return new Response(
              JSON.stringify({ error: "Mot de passe actuel incorrect" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          const salt = bcrypt.genSaltSync(10);
          const newHash = bcrypt.hashSync(new_password, salt);

          const { error: updateError } = await supabase
            .from("clients")
            .update({ password_hash: newHash })
            .eq("id", client_id);

          if (updateError) {
            return new Response(
              JSON.stringify({ error: "Erreur lors de la mise à jour" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: "Client ID ou Member ID requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Mot de passe modifié avec succès" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "get-profile": {
        const { client_id, member_id } = params;

        if (member_id) {
          const { data: member, error } = await supabase
            .from("client_members")
            .select("id, name, email, role, login_id, status, created_at, last_login_at, client_id")
            .eq("id", member_id)
            .maybeSingle();

          if (error || !member) {
            return new Response(
              JSON.stringify({ error: "Membre non trouvé" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, profile: { ...member, type: "member" } }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        } else if (client_id) {
          const { data: client, error } = await supabase
            .from("clients")
            .select("id, name, email, login_id, status, theme, language, created_at")
            .eq("id", client_id)
            .maybeSingle();

          if (error || !client) {
            return new Response(
              JSON.stringify({ error: "Client non trouvé" }),
              { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          return new Response(
            JSON.stringify({ success: true, profile: { ...client, type: "client" } }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ error: "Client ID ou Member ID requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "update-profile": {
        const { client_id, member_id, name, email } = params;

        if (member_id) {
          const { error } = await supabase
            .from("client_members")
            .update({ name, email })
            .eq("id", member_id);

          if (error) {
            return new Response(
              JSON.stringify({ error: "Erreur lors de la mise à jour" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else if (client_id) {
          const { error } = await supabase
            .from("clients")
            .update({ name, email })
            .eq("id", client_id);

          if (error) {
            return new Response(
              JSON.stringify({ error: "Erreur lors de la mise à jour" }),
              { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        } else {
          return new Response(
            JSON.stringify({ error: "Client ID ou Member ID requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Profil mis à jour" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== ADMIN MEMBER MANAGEMENT ==========

      case "get-members": {
        const { client_id } = params;

        if (!client_id) {
          return new Response(
            JSON.stringify({ error: "Client ID requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: members, error } = await supabase
          .from("client_members")
          .select("id, name, email, role, login_id, status, created_at, last_login_at")
          .eq("client_id", client_id)
          .order("created_at", { ascending: false });

        if (error) {
          return new Response(
            JSON.stringify({ error: "Erreur lors de la récupération" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, members: members || [] }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin-add-member": {
        const { client_id, name, email, login_id, password, role } = params;

        if (!client_id || !name || !email || !login_id || !password) {
          return new Response(
            JSON.stringify({ error: "Tous les champs sont requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (password.length < 8) {
          return new Response(
            JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Check if login_id already exists
        const { data: existing } = await supabase
          .from("client_members")
          .select("id")
          .eq("login_id", login_id)
          .maybeSingle();

        if (existing) {
          return new Response(
            JSON.stringify({ error: "Ce login ID existe déjà" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(password, salt);

        const { data: newMember, error } = await supabase
          .from("client_members")
          .insert({
            client_id,
            name,
            email,
            login_id,
            password_hash: passwordHash,
            role: role || "member",
            status: "active",
          })
          .select()
          .single();

        if (error) {
          console.error("Error adding member:", error);
          return new Response(
            JSON.stringify({ error: "Erreur lors de l'ajout du membre" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, member: newMember }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin-update-member": {
        const { member_id, name, email, role, status } = params;

        if (!member_id) {
          return new Response(
            JSON.stringify({ error: "Member ID requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updates: Record<string, any> = {};
        if (name !== undefined) updates.name = name;
        if (email !== undefined) updates.email = email;
        if (role !== undefined) updates.role = role;
        if (status !== undefined) updates.status = status;

        const { error } = await supabase
          .from("client_members")
          .update(updates)
          .eq("id", member_id);

        if (error) {
          return new Response(
            JSON.stringify({ error: "Erreur lors de la mise à jour" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Membre mis à jour" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin-delete-member": {
        const { member_id } = params;

        if (!member_id) {
          return new Response(
            JSON.stringify({ error: "Member ID requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error } = await supabase
          .from("client_members")
          .delete()
          .eq("id", member_id);

        if (error) {
          return new Response(
            JSON.stringify({ error: "Erreur lors de la suppression" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Membre supprimé" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "admin-reset-member-password": {
        const { member_id, new_password } = params;

        if (!member_id || !new_password) {
          return new Response(
            JSON.stringify({ error: "Member ID et nouveau mot de passe requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (new_password.length < 8) {
          return new Response(
            JSON.stringify({ error: "Le mot de passe doit contenir au moins 8 caractères" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const salt = bcrypt.genSaltSync(10);
        const passwordHash = bcrypt.hashSync(new_password, salt);

        const { error } = await supabase
          .from("client_members")
          .update({ 
            password_hash: passwordHash,
            password_reset_token: null,
            password_reset_expires_at: null
          })
          .eq("id", member_id);

        if (error) {
          return new Response(
            JSON.stringify({ error: "Erreur lors de la réinitialisation" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        return new Response(
          JSON.stringify({ success: true, message: "Mot de passe réinitialisé" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // ========== UNIVERSAL LOGIN (without agent slug) ==========
      case "login-universal": {
        const { login_id, password } = params;
        
        if (!login_id || !password) {
          return new Response(
            JSON.stringify({ error: "Identifiant et mot de passe requis" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        console.log(`Universal login attempt for: ${login_id}`);

        // First try to find a client with this login_id
        const { data: client, error: clientError } = await supabase
          .from("clients")
          .select(`
            id, name, organization_id, theme, language, login_id, password_hash, status,
            assigned_agent_id,
            assigned_agent:agents!clients_assigned_agent_id_fkey(id, name, slug, organization_id, platform, platform_agent_id)
          `)
          .eq("login_id", login_id)
          .maybeSingle();

        if (clientError) {
          console.error("Error finding client:", clientError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la recherche" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If client found, validate password and return session
        if (client) {
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

          const passwordMatch = bcrypt.compareSync(password, client.password_hash);
          if (!passwordMatch) {
            return new Response(
              JSON.stringify({ error: "Identifiants invalides" }),
              { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Get assigned agent
          const assignedAgent = client.assigned_agent as any;
          if (!assignedAgent || !assignedAgent.id) {
            return new Response(
              JSON.stringify({ error: "Aucun agent assigné à ce compte. Contactez votre administrateur." }),
              { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }

          // Check if client has access via assignment table
          const { data: assignment } = await supabase
            .from("client_agent_assignments")
            .select("role, can_edit_knowledge, can_edit_prompt")
            .eq("client_id", client.id)
            .eq("agent_id", assignedAgent.id)
            .maybeSingle();

          // Fetch platform API key
          let platformApiKey: string | null = null;
          if (assignedAgent.platform && assignedAgent.organization_id) {
            const { data: integration } = await supabase
              .from("organization_integrations")
              .select("api_key")
              .eq("organization_id", assignedAgent.organization_id)
              .eq("platform", assignedAgent.platform)
              .eq("is_active", true)
              .maybeSingle();
            platformApiKey = integration?.api_key || null;
          }

          const session = {
            clientId: client.id,
            clientName: client.name,
            organizationId: client.organization_id,
            agentId: assignedAgent.id,
            agentName: assignedAgent.name,
            agentSlug: assignedAgent.slug,
            platform: assignedAgent.platform,
            platformAgentId: assignedAgent.platform_agent_id || undefined,
            platformApiKey: platformApiKey || undefined,
            role: assignment?.role || "admin",
            canEditKnowledge: assignment?.can_edit_knowledge ?? true,
            canEditPrompt: assignment?.can_edit_prompt ?? true,
            theme: client.theme || "dark",
            language: client.language || "fr",
            memberType: "client",
          };

          console.log(`Client ${client.name} logged in universally to agent ${assignedAgent.name}`);

          return new Response(
            JSON.stringify({ success: true, session }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // If no client found, try to find a member
        const { data: member, error: memberError } = await supabase
          .from("client_members")
          .select("id, client_id, name, email, role, login_id, password_hash, status")
          .eq("login_id", login_id)
          .maybeSingle();

        if (memberError) {
          console.error("Error finding member:", memberError);
          return new Response(
            JSON.stringify({ error: "Erreur lors de la recherche" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!member) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (member.status !== "active") {
          return new Response(
            JSON.stringify({ error: "Ce compte est désactivé" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        if (!member.password_hash) {
          return new Response(
            JSON.stringify({ error: "Aucun mot de passe défini. Contactez votre administrateur." }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const memberPasswordMatch = bcrypt.compareSync(password, member.password_hash);
        if (!memberPasswordMatch) {
          return new Response(
            JSON.stringify({ error: "Identifiants invalides" }),
            { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get parent client with assigned agent
        const { data: parentClient, error: parentError } = await supabase
          .from("clients")
          .select(`
            id, name, organization_id, theme, language,
            assigned_agent_id,
            assigned_agent:agents!clients_assigned_agent_id_fkey(id, name, slug, organization_id, platform, platform_agent_id)
          `)
          .eq("id", member.client_id)
          .maybeSingle();

        if (parentError || !parentClient) {
          return new Response(
            JSON.stringify({ error: "Client parent non trouvé" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const parentAssignedAgent = parentClient.assigned_agent as any;
        if (!parentAssignedAgent || !parentAssignedAgent.id) {
          return new Response(
            JSON.stringify({ error: "Aucun agent assigné au client. Contactez votre administrateur." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Get assignment
        const { data: memberAssignment } = await supabase
          .from("client_agent_assignments")
          .select("role, can_edit_knowledge, can_edit_prompt")
          .eq("client_id", parentClient.id)
          .eq("agent_id", parentAssignedAgent.id)
          .maybeSingle();

        // Fetch platform API key for member
        let memberPlatformApiKey: string | null = null;
        if (parentAssignedAgent.platform && parentAssignedAgent.organization_id) {
          const { data: integration } = await supabase
            .from("organization_integrations")
            .select("api_key")
            .eq("organization_id", parentAssignedAgent.organization_id)
            .eq("platform", parentAssignedAgent.platform)
            .eq("is_active", true)
            .maybeSingle();
          memberPlatformApiKey = integration?.api_key || null;
        }

        // Update last login
        await supabase
          .from("client_members")
          .update({ last_login_at: new Date().toISOString() })
          .eq("id", member.id);

        const isAdminMember = member.role === "admin";
        const memberSession = {
          clientId: parentClient.id,
          clientName: parentClient.name,
          organizationId: parentClient.organization_id,
          agentId: parentAssignedAgent.id,
          agentName: parentAssignedAgent.name,
          agentSlug: parentAssignedAgent.slug,
          platform: parentAssignedAgent.platform,
          platformAgentId: parentAssignedAgent.platform_agent_id || undefined,
          platformApiKey: memberPlatformApiKey || undefined,
          role: isAdminMember ? (memberAssignment?.role || "admin") : "viewer",
          canEditKnowledge: isAdminMember && (memberAssignment?.can_edit_knowledge ?? true),
          canEditPrompt: isAdminMember && (memberAssignment?.can_edit_prompt ?? true),
          theme: parentClient.theme || "dark",
          language: parentClient.language || "fr",
          memberType: "member",
          memberId: member.id,
          memberName: member.name,
          memberEmail: member.email,
          memberRole: member.role,
        };

        console.log(`Member ${member.name} logged in universally to agent ${parentAssignedAgent.name}`);

        return new Response(
          JSON.stringify({ success: true, session: memberSession }),
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
