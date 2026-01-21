import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/xml',
};

Deno.serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse form data from Twilio
    const formData = await req.formData();
    const to = formData.get('To') as string;
    const from = formData.get('From') as string;
    const callSid = formData.get('CallSid') as string;

    console.log(`Incoming call: From=${from}, To=${to}, CallSid=${callSid}`);

    if (!to) {
      console.error('Missing To parameter');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Invalid request</Say></Response>`,
        { headers: corsHeaders }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Find the agent assigned to this phone number
    const { data: agent, error } = await supabase
      .from('agents')
      .select('id, name, platform, platform_agent_id, config, organization_id')
      .eq('twilio_number', to)
      .single();

    if (error || !agent) {
      console.error('No agent found for number:', to, error);
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>No agent configured for this number</Say></Response>`,
        { headers: corsHeaders }
      );
    }

    console.log(`Found agent: ${agent.name} (${agent.platform})`);

    // Get the platform agent ID
    const platformAgentId = agent.platform_agent_id || agent.config?.agent_id;
    
    if (!platformAgentId) {
      console.error('Agent has no platform_agent_id configured');
      return new Response(
        `<?xml version="1.0" encoding="UTF-8"?><Response><Say>Agent not properly configured</Say></Response>`,
        { headers: corsHeaders }
      );
    }

    // Generate TwiML based on platform
    let twiml = '';

    switch (agent.platform) {
      case 'elevenlabs':
        // ElevenLabs uses WebSocket streaming
        const elevenLabsWsUrl = `wss://api.elevenlabs.io/v1/convai/conversation?agent_id=${platformAgentId}`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${elevenLabsWsUrl}">
      <Parameter name="caller" value="${from}" />
    </Stream>
  </Connect>
</Response>`;
        break;

      case 'vapi':
        // Vapi uses their own phone system - redirect or use their API
        // For now, use a Connect verb to their service
        const vapiPhoneUrl = `https://api.vapi.ai/call/phone`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="wss://api.vapi.ai/ws/${platformAgentId}">
      <Parameter name="caller" value="${from}" />
    </Stream>
  </Connect>
</Response>`;
        break;

      case 'retell':
        // Retell uses WebSocket
        const retellWsUrl = `wss://api.retellai.com/audio-websocket/${platformAgentId}`;
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Connect>
    <Stream url="${retellWsUrl}">
      <Parameter name="caller" value="${from}" />
    </Stream>
  </Connect>
</Response>`;
        break;

      default:
        console.error('Unsupported platform:', agent.platform);
        twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say>This agent platform is not supported for phone calls</Say>
</Response>`;
    }

    console.log('Returning TwiML:', twiml);
    return new Response(twiml, { headers: corsHeaders });

  } catch (error) {
    console.error('Error processing webhook:', error);
    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Say>An error occurred</Say></Response>`,
      { headers: corsHeaders }
    );
  }
});
