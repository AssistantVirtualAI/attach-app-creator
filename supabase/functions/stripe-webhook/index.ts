import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

// Map Stripe price IDs to plan tiers
const PRICE_TO_TIER: Record<string, string> = {
  price_starter_monthly: "starter",
  price_growth_monthly: "growth",
  price_ultimate_monthly: "ultimate",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const signature = req.headers.get("stripe-signature");
    const body = await req.text();

    let event: Stripe.Event;

    if (webhookSecret && signature) {
      try {
        event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return new Response(JSON.stringify({ error: "Invalid signature" }), {
          status: 400,
          headers: corsHeaders,
        });
      }
    } else {
      // For testing without webhook secret
      event = JSON.parse(body);
    }

    console.log("Processing webhook event:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const organizationId = session.metadata?.organization_id;

        if (organizationId && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            session.subscription as string
          );

          const priceId = subscription.items.data[0]?.price.id;
          const tier = PRICE_TO_TIER[priceId] || "starter";

          await supabase
            .from("billing_config")
            .update({
              stripe_subscription_id: subscription.id,
              plan_tier: tier,
              subscription_status: subscription.status,
              subscription_ends_at: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq("organization_id", organizationId);

          console.log(`Updated billing for org ${organizationId} to ${tier}`);
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;

        if (organizationId) {
          const priceId = subscription.items.data[0]?.price.id;
          const tier = PRICE_TO_TIER[priceId] || "free";

          await supabase
            .from("billing_config")
            .update({
              plan_tier: tier,
              subscription_status: subscription.status,
              subscription_ends_at: new Date(
                subscription.current_period_end * 1000
              ).toISOString(),
            })
            .eq("organization_id", organizationId);

          console.log(`Subscription updated for org ${organizationId}`);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const organizationId = subscription.metadata?.organization_id;

        if (organizationId) {
          await supabase
            .from("billing_config")
            .update({
              plan_tier: "free",
              subscription_status: "canceled",
              stripe_subscription_id: null,
            })
            .eq("organization_id", organizationId);

          console.log(`Subscription canceled for org ${organizationId}`);
        }
        break;
      }

      case "invoice.paid": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Update subscription end date
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            invoice.subscription as string
          );
          const organizationId = subscription.metadata?.organization_id;

          if (organizationId) {
            await supabase
              .from("billing_config")
              .update({
                subscription_ends_at: new Date(
                  subscription.current_period_end * 1000
                ).toISOString(),
              })
              .eq("organization_id", organizationId);
          }
        }

        console.log(`Invoice paid for customer ${customerId}`);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        // Get organization from billing_config
        const { data: config } = await supabase
          .from("billing_config")
          .select("organization_id")
          .eq("stripe_customer_id", customerId)
          .single();

        if (config) {
          await supabase
            .from("billing_config")
            .update({ subscription_status: "past_due" })
            .eq("organization_id", config.organization_id);
        }

        console.log(`Invoice payment failed for customer ${customerId}`);
        break;
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
