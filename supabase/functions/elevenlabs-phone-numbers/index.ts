import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, agentId, phoneNumberId, phoneConfig, apiKey: providedApiKey } = await req.json();
    
    console.log(`[elevenlabs-phone-numbers] Action: ${action}`);
    
    let apiKey = providedApiKey;
    
    // If no API key provided, get from user's integration
    if (!apiKey) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'API key or authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const token = authHeader.replace('Bearer ', '');
      
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser(token);
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Get API key from agent or integration
      if (agentId) {
        const { data: agentData } = await supabase
          .from('agents')
          .select('platform_api_key, config')
          .eq('platform_agent_id', agentId)
          .single();

        if (agentData?.platform_api_key) {
          apiKey = agentData.platform_api_key;
        } else if (agentData?.config && (agentData.config as any)?.api_key) {
          apiKey = (agentData.config as any).api_key;
        }
      }

      if (!apiKey) {
        const { data: integration } = await supabase
          .from('organization_integrations')
          .select('api_key')
          .eq('user_id', user.id)
          .eq('platform', 'elevenlabs')
          .eq('is_active', true)
          .single();

        if (integration?.api_key) {
          apiKey = integration.api_key;
        }
      }
    }

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    switch (action) {
      case 'list': {
        console.log('[elevenlabs-phone-numbers] Listing phone numbers');
        
        const response = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
          headers: { 'xi-api-key': apiKey },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[elevenlabs-phone-numbers] API error:', response.status, errorText);
          throw new Error(`ElevenLabs API error: ${response.status}`);
        }

        const data = await response.json();
        
        return new Response(
          JSON.stringify({ phone_numbers: data.phone_numbers || data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create': {
        console.log('[elevenlabs-phone-numbers] Creating phone number');
        
        if (!phoneConfig || !agentId) {
          return new Response(
            JSON.stringify({ error: 'Phone config and agent ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const body: any = {
          phone_number: phoneConfig.phone_number,
          agent_id: agentId,
          label: phoneConfig.label,
        };

        if (phoneConfig.phone_number_type === 'twilio' && phoneConfig.twilio_config) {
          body.telephony_provider = {
            type: 'twilio',
            twilio_account_sid: phoneConfig.twilio_config.account_sid,
            twilio_auth_token: phoneConfig.twilio_config.auth_token,
            twilio_phone_number_sid: phoneConfig.twilio_config.phone_number_sid,
          };
        } else if (phoneConfig.phone_number_type === 'sip' && phoneConfig.sip_config) {
          body.telephony_provider = {
            type: 'sip_trunk',
            sip_trunk_uri: phoneConfig.sip_config.sip_trunk_uri,
            sip_trunk_username: phoneConfig.sip_config.username,
            sip_trunk_password: phoneConfig.sip_config.password,
          };
        }

        const response = await fetch('https://api.elevenlabs.io/v1/convai/phone-numbers', {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[elevenlabs-phone-numbers] Create error:', response.status, errorText);
          throw new Error(`Failed to create phone number: ${errorText}`);
        }

        const data = await response.json();
        
        return new Response(
          JSON.stringify({ success: true, phone_number: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        console.log('[elevenlabs-phone-numbers] Deleting phone number:', phoneNumberId);
        
        if (!phoneNumberId) {
          return new Response(
            JSON.stringify({ error: 'Phone number ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
          {
            method: 'DELETE',
            headers: { 'xi-api-key': apiKey },
          }
        );

        if (!response.ok && response.status !== 204) {
          const errorText = await response.text();
          console.error('[elevenlabs-phone-numbers] Delete error:', response.status, errorText);
          throw new Error(`Failed to delete phone number: ${errorText}`);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'assign_agent': {
        console.log('[elevenlabs-phone-numbers] Assigning agent to phone:', phoneNumberId, agentId);
        
        if (!phoneNumberId || !agentId) {
          return new Response(
            JSON.stringify({ error: 'Phone number ID and agent ID required' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const response = await fetch(
          `https://api.elevenlabs.io/v1/convai/phone-numbers/${phoneNumberId}`,
          {
            method: 'PATCH',
            headers: {
              'xi-api-key': apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ agent_id: agentId }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[elevenlabs-phone-numbers] Assign error:', response.status, errorText);
          throw new Error(`Failed to assign agent: ${errorText}`);
        }

        const data = await response.json();
        
        return new Response(
          JSON.stringify({ success: true, phone_number: data }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
  } catch (error) {
    console.error('[elevenlabs-phone-numbers] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
