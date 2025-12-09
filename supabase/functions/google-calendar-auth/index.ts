import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { action, organizationId, code, redirectUri } = await req.json();
    
    const clientId = Deno.env.get('GOOGLE_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      console.log('Google Calendar credentials not configured');
      return new Response(
        JSON.stringify({ 
          error: 'Google Calendar not configured',
          message: 'Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'get-auth-url') {
      // Generate OAuth URL for Google Calendar
      const scopes = [
        'https://www.googleapis.com/auth/calendar',
        'https://www.googleapis.com/auth/calendar.events'
      ].join(' ');

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scopes)}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${organizationId}`;

      return new Response(
        JSON.stringify({ authUrl }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'exchange-code') {
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code'
        })
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      // Get user's primary calendar
      const calendarResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/users/me/calendarList/primary',
        {
          headers: { Authorization: `Bearer ${tokens.access_token}` }
        }
      );
      
      let calendarId = 'primary';
      if (calendarResponse.ok) {
        const calendarData = await calendarResponse.json();
        calendarId = calendarData.id || 'primary';
      }

      // Store integration in database
      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      const { error: upsertError } = await supabase
        .from('calendar_integrations')
        .upsert({
          organization_id: organizationId,
          provider: 'google',
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expires_at: expiresAt.toISOString(),
          calendar_id: calendarId,
          is_active: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,provider'
        });

      if (upsertError) {
        console.error('Failed to store integration:', upsertError);
        throw new Error('Failed to store calendar integration');
      }

      console.log('Calendar integration saved successfully');

      return new Response(
        JSON.stringify({ success: true, calendarId }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'refresh-token') {
      // Get current integration
      const { data: integration, error: fetchError } = await supabase
        .from('calendar_integrations')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('provider', 'google')
        .maybeSingle();

      if (fetchError || !integration) {
        throw new Error('No calendar integration found');
      }

      // Refresh the token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: integration.refresh_token,
          grant_type: 'refresh_token'
        })
      });

      const tokens = await tokenResponse.json();

      if (tokens.error) {
        throw new Error(tokens.error_description || tokens.error);
      }

      const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

      await supabase
        .from('calendar_integrations')
        .update({
          access_token: tokens.access_token,
          token_expires_at: expiresAt.toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', integration.id);

      return new Response(
        JSON.stringify({ success: true, access_token: tokens.access_token }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'disconnect') {
      const { error: deleteError } = await supabase
        .from('calendar_integrations')
        .delete()
        .eq('organization_id', organizationId)
        .eq('provider', 'google');

      if (deleteError) {
        throw new Error('Failed to disconnect calendar');
      }

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Google Calendar Auth Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
