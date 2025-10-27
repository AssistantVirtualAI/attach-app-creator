import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { platform } = await req.json()
    console.log(`Testing integration for platform: ${platform}`)

    // Get user's integration using Service Role Key (bypasses RLS)
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabase.auth.getUser(token)

    if (!user) {
      throw new Error('Not authenticated')
    }

    const { data: integration, error: fetchError } = await supabase
      .from('organization_integrations')
      .select('api_key, agent_id')
      .eq('user_id', user.id)
      .eq('platform', platform)
      .single()

    if (fetchError || !integration) {
      throw new Error('Integration not found')
    }

    let testResult = { success: false, error: '' }

    // Test connection based on platform
    switch (platform) {
      case 'elevenlabs':
        const response = await fetch(`https://api.elevenlabs.io/v1/user`, {
          headers: {
            'xi-api-key': integration.api_key
          }
        })
        testResult.success = response.ok
        if (!response.ok) {
          const errorText = await response.text()
          testResult.error = `HTTP ${response.status}: ${errorText}`
          console.error('ElevenLabs test failed:', errorText)
        } else {
          console.log('ElevenLabs test succeeded')
        }
        break

      case 'vapi':
        const vapiResponse = await fetch('https://api.vapi.ai/assistant', {
          headers: {
            'Authorization': `Bearer ${integration.api_key}`
          }
        })
        testResult.success = vapiResponse.ok
        if (!vapiResponse.ok) {
          const errorText = await vapiResponse.text()
          testResult.error = `HTTP ${vapiResponse.status}: ${errorText}`
          console.error('Vapi test failed:', errorText)
        } else {
          console.log('Vapi test succeeded')
        }
        break

      case 'retell':
        const retellResponse = await fetch('https://api.retellai.com/v2/list-calls', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${integration.api_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ limit: 1 })
        })
        testResult.success = retellResponse.ok
        if (!retellResponse.ok) {
          const errorText = await retellResponse.text()
          testResult.error = `HTTP ${retellResponse.status}: ${errorText}`
          console.error('Retell test failed:', errorText)
        } else {
          console.log('Retell test succeeded')
        }
        break

      default:
        throw new Error(`Unsupported platform: ${platform}`)
    }

    // Update test status
    await supabase
      .from('organization_integrations')
      .update({
        test_status: testResult.success ? 'success' : 'failed',
        test_error: testResult.error || null,
        last_tested_at: new Date().toISOString()
      })
      .eq('user_id', user.id)
      .eq('platform', platform)

    return new Response(
      JSON.stringify(testResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in test-integration:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
