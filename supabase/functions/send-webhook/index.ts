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
    const { endpointId, eventType, payload } = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get endpoint details
    const { data: endpoint, error: endpointError } = await supabase
      .from('webhook_endpoints')
      .select('*')
      .eq('id', endpointId)
      .single();

    if (endpointError || !endpoint) {
      throw new Error('Webhook endpoint not found');
    }

    if (!endpoint.is_active) {
      return new Response(JSON.stringify({ success: false, reason: 'Endpoint inactive' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if endpoint subscribes to this event
    if (!endpoint.events.includes(eventType)) {
      return new Response(JSON.stringify({ success: false, reason: 'Event not subscribed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate HMAC SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(endpoint.secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );
    
    const payloadString = JSON.stringify(payload);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadString));
    const signatureHex = Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Retry logic with exponential backoff
    const maxRetries = 3;
    let lastError = null;
    let responseStatus = null;
    let responseBody = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`Webhook attempt ${attempt}/${maxRetries} to ${endpoint.url}`);
        
        const response = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signatureHex}`,
            'X-Webhook-Event': eventType,
            'X-Webhook-Delivery': crypto.randomUUID(),
          },
          body: payloadString,
        });

        responseStatus = response.status;
        responseBody = await response.text();

        // Log delivery
        await supabase.from('webhook_delivery_logs').insert({
          endpoint_id: endpointId,
          event_type: eventType,
          payload,
          response_status: responseStatus,
          response_body: responseBody.substring(0, 1000),
          attempt_count: attempt,
          delivered_at: response.ok ? new Date().toISOString() : null,
        });

        if (response.ok) {
          console.log(`Webhook delivered successfully on attempt ${attempt}`);
          return new Response(JSON.stringify({ success: true, status: responseStatus }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        lastError = `HTTP ${responseStatus}: ${responseBody}`;
      } catch (error) {
        lastError = error.message;
        console.error(`Webhook attempt ${attempt} failed:`, error);
      }

      // Exponential backoff
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // All retries failed
    await supabase.from('webhook_delivery_logs').insert({
      endpoint_id: endpointId,
      event_type: eventType,
      payload,
      response_status: responseStatus,
      response_body: lastError,
      attempt_count: maxRetries,
      delivered_at: null,
    });

    return new Response(JSON.stringify({ success: false, error: lastError }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Send webhook error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
