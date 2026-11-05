import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Standard CORS headers for frontend requests
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface CartItemInput {
  variant_id: string;
  size: string;
  quantity: number;
  custom_measurement_id?: string | null;
}

interface CreateOrderPayload {
  email: string;
  phone: string;
  delivery_option: "pickup" | "local delivery" | "nationwide delivery";
  delivery_address: {
    full_name: string;
    street?: string;
    city?: string;
    state?: string;
    landmark?: string;
  };
  items: CartItemInput[];
  pending_order_id?: string | null;
}

serve(async (req) => {
  // 1. Handle CORS preflight request from browser
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("Missing Supabase configuration in environment.");
    }
    if (!paystackSecret) {
      throw new Error("Missing PAYSTACK_SECRET_KEY in Edge Function secrets.");
    }

    // Admin Supabase client (service role bypasses RLS for atomic server-side order creation)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Optional: detect logged-in user if token was passed in Authorization header
    let authenticatedUserId: string | null = null;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "").trim();
      if (token && token !== Deno.env.get("SUPABASE_ANON_KEY")) {
        const { data: { user } } = await supabaseAdmin.auth.getUser(token);
        if (user && user.id) {
          authenticatedUserId = user.id;
        }
      }
    }

    const payload: CreateOrderPayload = await req.json();
    const { email, phone, delivery_option, delivery_address, items } = payload;

    // Basic Input Validations
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "A valid email address is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(JSON.stringify({ error: "Order must contain at least one item." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Fetch live prices & check stock limits from database (Prevents client-side price tampering)
    // Deduplicate variant IDs for cleaner, faster database lookup
    const variantIds = Array.from(new Set(items.map((i) => i.variant_id).filter(Boolean)));
    const { data: variants, error: variantError } = await supabaseAdmin
      .from("product_variation")
      .select("id, product_id, price, quantity, available, size, color, product:product_id ( title, type )")
      .in("id", variantIds);

    if (variantError || !variants || variants.length === 0) {
      return new Response(JSON.stringify({ error: "Could not verify selected garments in catalog." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const variantMap = new Map<string, any>(variants.map((v) => [v.id, v]));

    // Batch-fetch any custom measurement profiles in ONE query (Avoids N+1 sequential database calls)
    const measurementIds = Array.from(
      new Set(
        items
          .map((i) => (i.custom_measurement_id ? String(i.custom_measurement_id).trim() : null))
          .filter((id): id is string => Boolean(id && id !== ""))
      )
    );

    let measurementMap = new Map<string, any>();
    if (measurementIds.length > 0) {
      const { data: mData } = await supabaseAdmin
        .from("custom_measurement")
        .select("*")
        .in("id", measurementIds);
      if (mData) {
        measurementMap = new Map(mData.map((m) => [m.id, m]));
      }
    }

    // Calculate subtotal & validate stock
    let calculatedSubtotal = 0;
    const validatedItems: Array<{
      variant_id: string;
      size: string;
      unit_price: number;
      quantity: number;
      custom_measurement_id?: string | null;
      measurement_snapshot?: any;
    }> = [];

    for (const item of items) {
      const variant = variantMap.get(item.variant_id);
      if (!variant) {
        return new Response(JSON.stringify({ error: `Item variant ${item.variant_id} was not found.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!variant.available) {
        return new Response(JSON.stringify({ error: `"${variant.product?.title || 'Garment'}" is currently unavailable.` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const requestedQty = Math.max(1, parseInt(String(item.quantity || 1), 10));

      // RTW physical stock verification
      if (variant.quantity !== null && variant.quantity !== undefined) {
        if (variant.quantity < requestedQty) {
          return new Response(
            JSON.stringify({
              error: `Only ${variant.quantity} piece(s) of "${variant.product?.title || 'this garment'}" available in stock.`,
            }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }

      const unitPrice = parseFloat(variant.price);
      calculatedSubtotal += unitPrice * requestedQty;

      // Safe custom measurement handling
      const measurementId =
        item.custom_measurement_id && String(item.custom_measurement_id).trim() !== ""
          ? String(item.custom_measurement_id).trim()
          : null;

      const measurementSnapshot = measurementId ? measurementMap.get(measurementId) || null : null;

      validatedItems.push({
        variant_id: item.variant_id,
        size: item.size || variant.size || "M",
        unit_price: unitPrice,
        quantity: requestedQty,
        custom_measurement_id: measurementId,
        measurement_snapshot: measurementSnapshot,
      });
    }

    // Normalize delivery option strictly to Postgres enum: 'pickup' | 'local delivery' | 'nationwide delivery'
    let deliveryOptionChosen: "pickup" | "local delivery" | "nationwide delivery" = "pickup";
    const rawOpt = String(delivery_option || "").toLowerCase();
    if (rawOpt === "pickup" || rawOpt.includes("pickup") || rawOpt.includes("studio")) {
      deliveryOptionChosen = "pickup";
    } else if (rawOpt === "local delivery" || (delivery_address?.state && String(delivery_address.state).toLowerCase().includes("lagos"))) {
      deliveryOptionChosen = "local delivery";
    } else {
      deliveryOptionChosen = "nationwide delivery";
    }

    // Delivery fee is 0 online (dispatch rider fee is paid separately upon delivery)
    const deliveryFee = 0;
    const totalAmount = calculatedSubtotal + deliveryFee;

    // 3. Generate unique order payment reference
    const timestamp = Date.now().toString().slice(-6);
    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const paymentRef = `KRB-${timestamp}-${randomHex}`;

    // 4. Check for an existing pending order to reuse/update (Way 1: No duplicates / orphans)
    let existingOrderId: string | null = null;
    let existingOrderQuery = supabaseAdmin
      .from("ready_to_wear_order")
      .select("id")
      .eq("payment_status", "pending");

    if (authenticatedUserId) {
      existingOrderQuery = existingOrderQuery.eq("user_id", authenticatedUserId);
    } else if (payload.pending_order_id && String(payload.pending_order_id).trim() !== "") {
      existingOrderQuery = existingOrderQuery.eq("id", payload.pending_order_id.trim());
    } else {
      existingOrderQuery = existingOrderQuery
        .eq("email", email.trim().toLowerCase())
        .is("user_id", null);
    }

    const { data: existingOrders } = await existingOrderQuery
      .order("created_at", { ascending: false })
      .limit(1);

    if (existingOrders && existingOrders.length > 0) {
      existingOrderId = existingOrders[0].id;
    }

    let activeOrderId: string;

    if (existingOrderId) {
      // Update existing pending order in place with new total & items
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from("ready_to_wear_order")
        .update({
          recipient_number: phone ? phone.trim() : null,
          delivery_address: delivery_address || {},
          delivery_option_chosen: deliveryOptionChosen,
          delivery_fee: deliveryFee,
          subtotal: calculatedSubtotal,
          total_amount: totalAmount,
          payment_reference: paymentRef,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingOrderId)
        .select("id")
        .single();

      if (updateError || !updatedOrder) {
        console.error("[create-order] Order update failed:", updateError);
        return new Response(JSON.stringify({ error: "Failed updating active pending order." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      activeOrderId = updatedOrder.id;

      // Replace old line items with fresh cart items
      await supabaseAdmin.from("rtw_order_item").delete().eq("parent_order_id", activeOrderId);
    } else {
      // Insert new pending order record
      const { data: newOrder, error: orderInsertError } = await supabaseAdmin
        .from("ready_to_wear_order")
        .insert({
          user_id: authenticatedUserId,
          email: email.trim().toLowerCase(),
          recipient_number: phone ? phone.trim() : null,
          delivery_address: delivery_address || {},
          delivery_option_chosen: deliveryOptionChosen,
          delivery_fee: deliveryFee,
          subtotal: calculatedSubtotal,
          total_amount: totalAmount,
          payment_reference: paymentRef,
          payment_status: "pending",
          status: "placed",
        })
        .select("id")
        .single();

      if (orderInsertError || !newOrder) {
        console.error("[create-order] Order insert failed:", orderInsertError);
        return new Response(JSON.stringify({ error: "Failed to initialize order record in database." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      activeOrderId = newOrder.id;
    }

    // 5. Insert Line Items into rtw_order_item
    const lineItemRows = validatedItems.map((v) => ({
      parent_order_id: activeOrderId,
      product_variant_id: v.variant_id,
      selected_size: v.size,
      price: v.unit_price,
      quantity: v.quantity,
      custom_measurement_id: v.custom_measurement_id,
      measurement_snapshot: v.measurement_snapshot,
    }));

    const { error: lineItemError } = await supabaseAdmin.from("rtw_order_item").insert(lineItemRows);
    if (lineItemError) {
      console.error("[create-order] Line items insert failed:", lineItemError);
      return new Response(JSON.stringify({ error: "Failed saving order line items." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 6. Initialize Paystack Transaction to generate the access_code
    // Note: Paystack amounts are in kobo (multiply Naira by 100)
    const amountInKobo = Math.round(totalAmount * 100);

    const paystackRes = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${paystackSecret.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email.trim().toLowerCase(),
        amount: amountInKobo,
        reference: paymentRef,
        metadata: {
          order_id: activeOrderId,
          customer_name: delivery_address?.full_name || email,
          items_count: validatedItems.length,
          custom_fields: [
            { display_name: "Order Reference", variable_name: "order_reference", value: paymentRef },
            { display_name: "Customer Name", variable_name: "customer_name", value: delivery_address?.full_name || email },
            { display_name: "Fulfillment", variable_name: "fulfillment", value: deliveryOptionChosen }
          ]
        },
      }),
    });

    const paystackData = await paystackRes.json();

    if (!paystackRes.ok || !paystackData.status) {
      console.error("[create-order] Paystack initialization failed:", paystackData);
      return new Response(
        JSON.stringify({
          error: paystackData.message || "Failed to initialize Paystack payment.",
          order_id: activeOrderId,
          reference: paymentRef,
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { access_code, authorization_url } = paystackData.data;

    // 7. Return access_code and order details to frontend checkout
    return new Response(
      JSON.stringify({
        success: true,
        order_id: activeOrderId,
        reference: paymentRef,
        access_code: access_code,
        authorization_url: authorization_url,
        total_amount: totalAmount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[create-order] Unexpected error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

