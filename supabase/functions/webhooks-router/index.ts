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

    // Get platform from URL path (e.g., /webhooks-router?platform=vapi)
    const url = new URL(req.url);
    const platform = url.searchParams.get('platform');
    const organizationId = url.searchParams.get('organizationId');

    if (!platform || !organizationId) {
      throw new Error('Missing required parameters: platform, organizationId');
    }

    console.log(`Webhook received for platform: ${platform}, org: ${organizationId}`);

    // Parse webhook payload
    const rawEvent = await req.json();
    const signature = req.headers.get('x-webhook-signature') || 
                     req.headers.get('x-retell-signature') ||
                     req.headers.get('x-elevenlabs-signature');

    // Verify webhook signature if present
    // TODO: Implement signature verification per platform
    
    // Normalize event based on platform
    const normalizedEvent = normalizeWebhookEvent(platform, rawEvent);

    // Store raw webhook event
    const { error: insertError } = await supabase
      .from('webhook_events')
      .insert({
        organization_id: organizationId,
        connector: platform,
        event_type: normalizedEvent.type,
        payload: rawEvent,
        signature: signature || null,
        processed: false,
      });

    if (insertError) {
      console.error('Failed to store webhook event:', insertError);
    }

    // Update conversation if it's a call event
    if (normalizedEvent.callId) {
      await updateConversationFromWebhook(
        supabase,
        organizationId,
        normalizedEvent.callId,
        normalizedEvent
      );
    }

    console.log(`Webhook processed: ${normalizedEvent.type} for call ${normalizedEvent.callId}`);

    return new Response(
      JSON.stringify({ success: true, eventType: normalizedEvent.type }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: any) {
    console.error('Webhook router error:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

function normalizeWebhookEvent(platform: string, rawEvent: any) {
  let type: string;
  let callId: string;
  let timestamp: string;

  switch (platform) {
    case 'vapi':
      const vapiType = rawEvent.message?.type || rawEvent.type;
      type = vapiType === 'call-started' ? 'call.started' :
             vapiType === 'call-ended' ? 'call.ended' :
             vapiType === 'transcript' ? 'transcript.ready' :
             'conversation.updated';
      callId = rawEvent.call?.id || rawEvent.callId;
      timestamp = rawEvent.timestamp || new Date().toISOString();
      break;

    case 'retell':
      const retellEvent = rawEvent.event;
      type = retellEvent === 'call_started' ? 'call.started' :
             retellEvent === 'call_ended' ? 'call.ended' :
             retellEvent === 'call_failed' ? 'call.failed' :
             retellEvent === 'transcript_ready' ? 'transcript.ready' :
             'conversation.updated';
      callId = rawEvent.call_id;
      timestamp = rawEvent.timestamp || new Date().toISOString();
      break;

    case 'elevenlabs':
      const elevenLabsType = rawEvent.event_type || rawEvent.type;
      type = elevenLabsType === 'conversation.started' ? 'call.started' :
             elevenLabsType === 'conversation.ended' ? 'call.ended' :
             elevenLabsType === 'conversation.failed' ? 'call.failed' :
             elevenLabsType === 'transcript.complete' ? 'transcript.ready' :
             'conversation.updated';
      callId = rawEvent.conversation_id;
      timestamp = rawEvent.timestamp || new Date().toISOString();
      break;

    default:
      type = 'conversation.updated';
      callId = rawEvent.id || rawEvent.callId || rawEvent.conversation_id;
      timestamp = new Date().toISOString();
  }

  return {
    type,
    callId,
    timestamp,
    data: rawEvent,
  };
}

async function updateConversationFromWebhook(
  supabase: any,
  organizationId: string,
  callId: string,
  event: any
) {
  const updates: any = {};

  switch (event.type) {
    case 'call.started':
      updates.status = 'in_progress';
      updates.metadata = { ...event.data };
      break;

    case 'call.ended':
      updates.status = 'completed';
      if (event.data.duration) {
        updates.duration = event.data.duration;
      }
      if (event.data.transcript) {
        updates.transcript = event.data.transcript;
      }
      if (event.data.recording_url || event.data.recordingUrl) {
        updates.audio_url = event.data.recording_url || event.data.recordingUrl;
      }
      break;

    case 'call.failed':
      updates.status = 'failed';
      break;

    case 'transcript.ready':
      if (event.data.transcript) {
        updates.transcript = event.data.transcript;
      }
      break;
  }

  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('external_id', callId)
      .eq('organization_id', organizationId);

    if (error) {
      console.error('Failed to update conversation:', error);
    }
  }
}
