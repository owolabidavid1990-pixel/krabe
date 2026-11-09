import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Helper to verify Paystack HMAC SHA512 signature using Web Crypto
async function verifyPaystackSignature(
  rawBody: string,
  signature: string | null,
  secretKey: string
): Promise<boolean> {
  if (!signature || !secretKey) return false;

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secretKey),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signatureBytes = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(rawBody)
    );
    const hash = Array.from(new Uint8Array(signatureBytes))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return hash.toLowerCase() === signature.toLowerCase();
  } catch (err) {
    console.error("[paystack-webhook] Signature verification error:", err);
    return false;
  }
}

serve(async (req) => {
  // 1. Paystack webhooks are exclusively POST requests
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");

    // 2. Strict Fail-Closed Environment Validation
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("[paystack-webhook] Missing Supabase environment variables.");
      return new Response("Server configuration error", { status: 500 });
    }

    if (!paystackSecret) {
      console.error("[paystack-webhook] Missing PAYSTACK_SECRET_KEY in Edge Function secrets.");
      return new Response("Server configuration error", { status: 500 });
    }

    const rawBody = await req.text();
    const signature = req.headers.get("x-paystack-signature");

    // 3. Strict Signature Verification (Fail Closed - never skip)
    const isValidSignature = await verifyPaystackSignature(rawBody, signature, paystackSecret.trim());
    if (!isValidSignature) {
      console.warn("[paystack-webhook] Unauthorized: Invalid or missing Paystack signature.");
      return new Response("Invalid signature", { status: 401 });
    }

    const event = JSON.parse(rawBody);

    // 4. Filter only charge.success events
    if (event.event !== "charge.success") {
      console.log(`[paystack-webhook] Event ignored (not charge.success): ${event.event}`);
      return new Response(JSON.stringify({ received: true, ignored: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = event.data || {};
    const metadata = data.metadata || {};
    const orderId = metadata.order_id || null;
    const paymentRef = data.reference || null;
    const paidAmountKobo = Number(data.amount);

    // 5. Strict Payload & Payment Data Validation
    if (
      data.status !== "success" ||
      data.currency !== "NGN" ||
      !paymentRef ||
      !Number.isSafeInteger(paidAmountKobo) ||
      paidAmountKobo <= 0
    ) {
      console.error("[paystack-webhook] Invalid transaction details in payload:", {
        status: data.status,
        currency: data.currency,
        reference: paymentRef,
        amount: data.amount,
      });
      return new Response(
        JSON.stringify({ error: "Invalid payment details" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Initialize Supabase Admin Client
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // 7. Primary Lookup by payment_reference
    const { data: existingOrder, error: fetchError } = await supabaseAdmin
      .from("ready_to_wear_order")
      .select("id, total_amount, payment_status, status, payment_reference")
      .eq("payment_reference", paymentRef)
      .maybeSingle();

    if (fetchError || !existingOrder) {
      console.error(
        `[paystack-webhook] Order not found for reference: ${paymentRef}`,
        fetchError
      );
      return new Response(JSON.stringify({ error: "Order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 8. Mandatory Order ID and Consistency Check
    if (!orderId || existingOrder.id !== orderId) {
      console.error(
        `[paystack-webhook] SECURITY ALERT: Missing or mismatched Order ID! Payload order_id: ${orderId}, database order: ${existingOrder.id}`
      );
      return new Response(
        JSON.stringify({ error: "Missing or mismatched order ID" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (existingOrder.payment_reference !== paymentRef) {
      console.error(
        `[paystack-webhook] Reference mismatch: Expected ${existingOrder.payment_reference}, got ${paymentRef}`
      );
      return new Response(
        JSON.stringify({ error: "Payment reference mismatch" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 9. Exact Amount Verification (Database total_amount is in NAIRA, Paystack is in KOBO)
    // 1 Naira = 100 Kobo. Strict exact match, no spread.
    const expectedAmountKobo = Math.round(Number(existingOrder.total_amount || 0) * 100);

    if (paidAmountKobo !== expectedAmountKobo) {
      console.error(
        `[paystack-webhook] SECURITY ALERT: Amount mismatch on Order ${existingOrder.id}! ` +
        `Expected: ₦${(expectedAmountKobo / 100).toLocaleString()} (${expectedAmountKobo} kobo), ` +
        `Paid: ₦${(paidAmountKobo / 100).toLocaleString()} (${paidAmountKobo} kobo).`
      );

      return new Response(
        JSON.stringify({
          error: "Payment amount mismatch",
          expected_kobo: expectedAmountKobo,
          paid_kobo: paidAmountKobo,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 10. Independent Server-to-Server Verification Call with Paystack API
    let verifyResponse: Response;
    try {
      verifyResponse = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(paymentRef)}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${paystackSecret.trim()}`,
            "Content-Type": "application/json",
          },
        }
      );
    } catch (fetchErr) {
      console.error("[paystack-webhook] Network failure reaching Paystack verification API:", fetchErr);
      // Return 503 so Paystack schedules a retry
      return new Response("Payment verification upstream network error", { status: 503 });
    }

    // Handle temporary upstream outages from Paystack with 503 for retry
    if (!verifyResponse.ok) {
      console.error(`[paystack-webhook] Paystack verification API unavailable (HTTP ${verifyResponse.status})`);
      return new Response("Payment verification temporarily unavailable", { status: 503 });
    }

    const verifyData = await verifyResponse.json();

    if (
      !verifyData.status ||
      verifyData.data?.status !== "success" ||
      verifyData.data?.reference !== paymentRef ||
      verifyData.data?.currency !== "NGN" ||
      Number(verifyData.data?.amount) !== expectedAmountKobo
    ) {
      console.error("[paystack-webhook] Independent Paystack verification failed:", verifyData);
      return new Response(
        JSON.stringify({ error: "Paystack transaction verification failed" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 11. Atomic Concurrency Lock: Transition ONLY from 'pending' status
    const { data: updatedOrder, error: updateError } = await supabaseAdmin
      .from("ready_to_wear_order")
      .update({
        payment_status: "success",
        status: "payment confirmed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingOrder.id)
      .eq("payment_reference", paymentRef)
      .eq("payment_status", "pending")
      .select("id, status, payment_status, payment_reference")
      .maybeSingle();

    if (updateError) {
      console.error(`[paystack-webhook] Database error updating Order ${existingOrder.id}:`, updateError);
      return new Response(JSON.stringify({ error: "Failed to update order status" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 12. Fresh State Check on Concurrency / Zero Rows Updated
    if (!updatedOrder) {
      const { data: freshOrder, error: freshError } = await supabaseAdmin
        .from("ready_to_wear_order")
        .select("id, payment_status, status")
        .eq("id", existingOrder.id)
        .maybeSingle();

      if (freshError) {
        console.error(`[paystack-webhook] Failed to retrieve fresh order state for Order ${existingOrder.id}:`, freshError);
        return new Response("Failed to verify order state", { status: 500 });
      }

      if (freshOrder?.payment_status === "success") {
        console.log(`[paystack-webhook] Order ${existingOrder.id} was already confirmed concurrently. Acknowledging duplicate webhook delivery.`);
        return new Response(
          JSON.stringify({ received: true, already_processed: true, order_id: existingOrder.id }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        console.warn(`[paystack-webhook] Order ${existingOrder.id} is currently in status '${freshOrder?.payment_status}', not 'pending'. Skipping update.`);
        return new Response(
          JSON.stringify({ received: true, ignored: true, current_status: freshOrder?.payment_status }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    console.log(
      `[paystack-webhook] Payment Verified & Confirmed! Order: ${updatedOrder.id} ` +
      `(${updatedOrder.payment_reference}) -> payment_status: success, status: payment confirmed`
    );

    // =========================================================================
    // 12b. Update Sales Count & RTW Inventory Deductions (Auto Sold-Out Check)
    // =========================================================================
    try {
      // 1. Fetch line items for this confirmed order with parent product and variant details
      const { data: orderItems, error: itemsError } = await supabaseAdmin
        .from("rtw_order_item")
        .select(`
          quantity,
          product_variant_id,
          product_variation (
            id,
            product_id,
            sales_count,
            quantity,
            product (
              id,
              type,
              sold_out
            )
          )
        `)
        .eq("parent_order_id", updatedOrder.id);

      if (itemsError) {
        console.error(`[paystack-webhook] Error fetching order items for Order ${updatedOrder.id}:`, itemsError);
      } else if (orderItems && orderItems.length > 0) {
        // 2. Aggregate quantities per variant and per product
        const variantMap = new Map<string, {
          qty: number;
          currentSales: number;
          currentQuantity: number | null;
          productId: string;
          isRtw: boolean;
        }>();
        const productSalesDelta = new Map<string, number>();
        const rtwProductIdsToCheck = new Set<string>();

        for (const item of orderItems) {
          const orderQty = Number(item.quantity) || 1;
          const variant = item.product_variation as any;
          if (!variant) continue;

          const prodRaw = variant.product;
          const productObj = Array.isArray(prodRaw) ? prodRaw[0] : prodRaw;
          const isRtw = String(productObj?.type || "").trim().toLowerCase() === "ready to wear";

          if (isRtw && variant.product_id) {
            rtwProductIdsToCheck.add(variant.product_id);
          }

          // Aggregate per variant
          const existingVariant = variantMap.get(variant.id);
          if (existingVariant) {
            existingVariant.qty += orderQty;
          } else {
            variantMap.set(variant.id, {
              qty: orderQty,
              currentSales: Number(variant.sales_count) || 0,
              currentQuantity: variant.quantity !== null && variant.quantity !== undefined ? Number(variant.quantity) : null,
              productId: variant.product_id,
              isRtw,
            });
          }

          // Aggregate total qty per product
          const currentProdDelta = productSalesDelta.get(variant.product_id) || 0;
          productSalesDelta.set(variant.product_id, currentProdDelta + orderQty);
        }

        // 3. Update each variant's sales_count (and deduct stock if Ready to Wear)
        for (const [variantId, vData] of variantMap.entries()) {
          const updatePayload: { sales_count: number; quantity?: number } = {
            sales_count: vData.currentSales + vData.qty,
          };

          if (vData.isRtw) {
            const currentStock = vData.currentQuantity !== null ? vData.currentQuantity : 0;
            updatePayload.quantity = Math.max(0, currentStock - vData.qty);
          }

          const { error: vUpdateErr } = await supabaseAdmin
            .from("product_variation")
            .update(updatePayload)
            .eq("id", variantId);

          if (vUpdateErr) {
            console.error(`[paystack-webhook] Failed updating variant ${variantId}:`, vUpdateErr);
          }
        }

        // 4. Update each product's sales_count
        for (const [productId, deltaQty] of productSalesDelta.entries()) {
          const { data: prodData } = await supabaseAdmin
            .from("product")
            .select("sales_count")
            .eq("id", productId)
            .maybeSingle();

          const currentProdSales = Number(prodData?.sales_count) || 0;
          const { error: pUpdateErr } = await supabaseAdmin
            .from("product")
            .update({ sales_count: currentProdSales + deltaQty })
            .eq("id", productId);

          if (pUpdateErr) {
            console.error(`[paystack-webhook] Failed updating sales_count for product ${productId}:`, pUpdateErr);
          }
        }

        // 5. Check if all variations of affected Ready to Wear product(s) are 0; if so, set sold_out = true
        for (const productId of rtwProductIdsToCheck) {
          const { data: allVariants, error: varFetchErr } = await supabaseAdmin
            .from("product_variation")
            .select("quantity")
            .eq("product_id", productId);

          if (varFetchErr) {
            console.error(`[paystack-webhook] Error checking variations stock for product ${productId}:`, varFetchErr);
            continue;
          }

          const totalRemainingStock = (allVariants || []).reduce((sum, v) => {
            const q = Number(v.quantity);
            return sum + (Number.isFinite(q) && q > 0 ? q : 0);
          }, 0);

          if (totalRemainingStock <= 0) {
            const { error: soldOutErr } = await supabaseAdmin
              .from("product")
              .update({ sold_out: true })
              .eq("id", productId);

            if (soldOutErr) {
              console.error(`[paystack-webhook] Failed setting sold_out for product ${productId}:`, soldOutErr);
            } else {
              console.log(`[paystack-webhook] Product ${productId} is now SOLD OUT (total remaining stock = 0). Updated sold_out = true.`);
            }
          }
        }

        console.log(`[paystack-webhook] Sales count & inventory deductions completed for Order ${updatedOrder.id}`);
      }
    } catch (inventoryErr) {
      console.error(`[paystack-webhook] Error updating inventory/sales count for Order ${updatedOrder.id}:`, inventoryErr);
    }

    // 13. Return 200 OK to Paystack
    return new Response(
      JSON.stringify({
        success: true,
        order_id: updatedOrder.id,
        payment_status: updatedOrder.payment_status,
        status: updatedOrder.status,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    );
  } catch (err: any) {
    console.error("[paystack-webhook] Unhandled webhook processing error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
