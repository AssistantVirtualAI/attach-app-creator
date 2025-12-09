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
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      organizationId,
      conversationId,
      agentId,
      reason,
      priority = 'normal',
      customerInfo = {},
      transcriptSnapshot
    } = await req.json();

    console.log('Creating handoff request:', { organizationId, conversationId, reason, priority });

    if (!organizationId) {
      throw new Error('Organization ID is required');
    }

    // Create handoff request
    const { data: handoff, error } = await supabase
      .from('handoff_requests')
      .insert([{
        organization_id: organizationId,
        conversation_id: conversationId || null,
        agent_id: agentId || null,
        reason,
        priority,
        customer_info: customerInfo,
        transcript_snapshot: transcriptSnapshot || null,
        status: 'pending'
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw error;
    }

    console.log('Handoff request created:', handoff.id);

    // Optionally: Send notifications to available agents
    // This could be via email, push notification, or in-app notification

    return new Response(JSON.stringify({ 
      success: true, 
      handoffId: handoff.id,
      message: 'Handoff request created successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (error: unknown) {
    console.error('Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
