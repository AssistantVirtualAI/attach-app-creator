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

    const { 
      action,
      organizationId,
      agentId,
      clientId,
      conversationId,
      title,
      description,
      startTime,
      endTime,
      attendeeName,
      attendeeEmail,
      attendeePhone,
      appointmentId
    } = await req.json();

    console.log(`Book appointment action: ${action}`, { organizationId, agentId });

    // Get calendar integration
    const { data: integration, error: integrationError } = await supabase
      .from('calendar_integrations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider', 'google')
      .eq('is_active', true)
      .maybeSingle();

    if (action === 'check-availability') {
      if (!integration) {
        return new Response(
          JSON.stringify({ available: true, slots: [], noCalendar: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check if token needs refresh
      let accessToken = integration.access_token;
      if (new Date(integration.token_expires_at) < new Date()) {
        // Refresh token logic would go here
        console.log('Token expired, would need refresh');
      }

      // Get busy times from Google Calendar
      const busyResponse = await fetch(
        'https://www.googleapis.com/calendar/v3/freeBusy',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            timeMin: startTime,
            timeMax: endTime,
            items: [{ id: integration.calendar_id || 'primary' }]
          })
        }
      );

      if (!busyResponse.ok) {
        console.error('Failed to check availability:', await busyResponse.text());
        return new Response(
          JSON.stringify({ available: true, slots: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const busyData = await busyResponse.json();
      const busySlots = busyData.calendars?.[integration.calendar_id || 'primary']?.busy || [];

      return new Response(
        JSON.stringify({ available: busySlots.length === 0, busySlots }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'create') {
      // Create appointment in database
      const { data: appointment, error: appointmentError } = await supabase
        .from('appointments')
        .insert({
          organization_id: organizationId,
          agent_id: agentId,
          client_id: clientId,
          conversation_id: conversationId,
          calendar_integration_id: integration?.id,
          title,
          description,
          start_time: startTime,
          end_time: endTime,
          attendee_name: attendeeName,
          attendee_email: attendeeEmail,
          attendee_phone: attendeePhone,
          status: 'scheduled'
        })
        .select()
        .single();

      if (appointmentError) {
        console.error('Failed to create appointment:', appointmentError);
        throw new Error('Failed to create appointment');
      }

      // If calendar integration exists, create Google Calendar event
      if (integration && integration.access_token) {
        let accessToken = integration.access_token;

        const event = {
          summary: title,
          description: description || `Appointment booked via AI agent`,
          start: {
            dateTime: startTime,
            timeZone: 'UTC'
          },
          end: {
            dateTime: endTime,
            timeZone: 'UTC'
          },
          attendees: attendeeEmail ? [{ email: attendeeEmail }] : [],
          reminders: {
            useDefault: false,
            overrides: [
              { method: 'email', minutes: 60 },
              { method: 'popup', minutes: 15 }
            ]
          }
        };

        const eventResponse = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id || 'primary'}/events`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(event)
          }
        );

        if (eventResponse.ok) {
          const eventData = await eventResponse.json();
          
          // Update appointment with external event ID
          await supabase
            .from('appointments')
            .update({ 
              external_event_id: eventData.id,
              status: 'confirmed'
            })
            .eq('id', appointment.id);

          console.log('Google Calendar event created:', eventData.id);
        } else {
          console.error('Failed to create Google Calendar event:', await eventResponse.text());
        }
      }

      return new Response(
        JSON.stringify({ success: true, appointment }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'cancel') {
      // Get appointment
      const { data: appointment, error: fetchError } = await supabase
        .from('appointments')
        .select('*')
        .eq('id', appointmentId)
        .single();

      if (fetchError || !appointment) {
        throw new Error('Appointment not found');
      }

      // Cancel in Google Calendar if event exists
      if (appointment.external_event_id && integration) {
        await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${integration.calendar_id || 'primary'}/events/${appointment.external_event_id}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${integration.access_token}`
            }
          }
        );
      }

      // Update status in database
      await supabase
        .from('appointments')
        .update({ status: 'cancelled' })
        .eq('id', appointmentId);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (action === 'list') {
      const { data: appointments, error: listError } = await supabase
        .from('appointments')
        .select(`
          *,
          agents(name),
          clients(name)
        `)
        .eq('organization_id', organizationId)
        .order('start_time', { ascending: true });

      if (listError) {
        throw new Error('Failed to fetch appointments');
      }

      return new Response(
        JSON.stringify({ appointments }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    throw new Error('Invalid action');

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Book Appointment Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
