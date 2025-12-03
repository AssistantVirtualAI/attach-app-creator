import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Price mapping - replace with your actual Stripe price IDs
const PRICE_MAP: Record<string, { priceId: string; tier: string }> = {
  price_starter: { priceId: "price_starter_monthly", tier: "starter" },
  price_growth: { priceId: "price_growth_monthly", tier: "growth" },
  price_ultimate: { priceId: "price_ultimate_monthly", tier: "ultimate" },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the user from the authorization header
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      throw new Error("Unauthorized");
    }

    const { organizationId, priceId, successUrl, cancelUrl } = await req.json();

    if (!organizationId || !priceId) {
      throw new Error("Missing required parameters");
    }

    // Verify user has access to this organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("user_id", userData.user.id)
      .single();

    if (!membership) {
      throw new Error("Not authorized for this organization");
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get or create billing config
    let { data: billingConfig } = await supabase
      .from("billing_config")
      .select("*")
      .eq("organization_id", organizationId)
      .single();

    let stripeCustomerId = billingConfig?.stripe_customer_id;

    // Create Stripe customer if doesn't exist
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userData.user.email,
        metadata: {
          organization_id: organizationId,
          user_id: userData.user.id,
        },
      });
      stripeCustomerId = customer.id;

      // Update or create billing config with customer ID
      if (billingConfig) {
        await supabase
          .from("billing_config")
          .update({ stripe_customer_id: stripeCustomerId })
          .eq("organization_id", organizationId);
      } else {
        await supabase
          .from("billing_config")
          .insert({
            organization_id: organizationId,
            stripe_customer_id: stripeCustomerId,
            plan_tier: "free",
          });
      }
    }

    // Create checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        organization_id: organizationId,
      },
      subscription_data: {
        metadata: {
          organization_id: organizationId,
        },
      },
    });

    console.log("Checkout session created:", session.id);

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    console.error("Error creating checkout session:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
