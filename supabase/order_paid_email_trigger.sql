-- =============================================================================
-- KRABE KOLLECTION — ORDER CONFIRMED EMAIL TRIGGER (BREVO)
-- 
-- Description:
-- Automatically fires when ready_to_wear_order status transitions
-- from 'payment confirmed' to 'order confirmed'.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.send_brevo_order_confirmed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_api_key text;
  v_sender_email text;
  v_customer_name text;
  v_customer_phone text;
  v_delivery_opt text;
  v_delivery_addr text;
  v_formatted_total text;
  v_items_rows text;
  v_html_body text;
BEGIN
  -- 1. Read Brevo API key from Supabase Vault
  SELECT decrypted_secret INTO v_api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'BREVO_API_KEY' 
  LIMIT 1;

  IF v_api_key IS NULL OR v_api_key = '' THEN
    RAISE WARNING 'BREVO_API_KEY not found in Supabase Vault. Order confirmation email skipped for order %', NEW.id;
    RETURN NEW;
  END IF;

  -- 2. Verified Brevo sender
  v_sender_email := 'admin@krabe.store';

  -- 3. Extract and sanitize customer details
  v_customer_name := COALESCE(NULLIF(trim(NEW.delivery_address->>'full_name'), ''), 'Valued Client');
  v_customer_phone := COALESCE(NULLIF(trim(NEW.recipient_number), ''), NULLIF(trim(NEW.delivery_address->>'phone'), ''), 'N/A');
  v_delivery_opt := COALESCE(initcap(NEW.delivery_option_chosen::text), 'Standard Delivery');
  
  -- Format delivery address
  v_delivery_addr := COALESCE(NULLIF(trim(NEW.delivery_address->>'street'), ''), '') || 
                     CASE WHEN NULLIF(trim(NEW.delivery_address->>'city'), '') IS NOT NULL THEN ', ' || trim(NEW.delivery_address->>'city') ELSE '' END ||
                     CASE WHEN NULLIF(trim(NEW.delivery_address->>'state'), '') IS NOT NULL THEN ', ' || trim(NEW.delivery_address->>'state') ELSE '' END;
  IF v_delivery_addr = '' THEN
    v_delivery_addr := 'Studio Pickup / Direct Atelier Collection';
  END IF;

  v_formatted_total := to_char(NEW.total_amount, 'FM999,999,999');

  -- 4. Build line items HTML table rows
  SELECT COALESCE(
    string_agg(
      '<tr>' ||
        '<td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; vertical-align: top;">' ||
          '<div style="font-size: 13.5px; font-weight: 600; color: #162029;">' || COALESCE(p.title, 'Signature Garment') || '</div>' ||
          '<div style="font-size: 11.5px; color: #64748B; margin-top: 3px;">' ||
            COALESCE(pv.color, 'Standard') || ' &bull; Size: ' || COALESCE(roi.selected_size, 'M') || ' &bull; Qty: ' || roi.quantity::text ||
          '</div>' ||
        '</td>' ||
        '<td style="padding: 12px 0; border-bottom: 1px solid #F1F5F9; text-align: right; vertical-align: top; font-size: 13.5px; font-weight: 700; color: #162029; white-space: nowrap;">' ||
          '₦' || to_char(roi.price * roi.quantity, 'FM999,999,999') ||
        '</td>' ||
      '</tr>',
      ''
    ),
    '<tr><td colspan="2" style="padding: 12px 0; font-size: 13px; color: #64748B;">Order items recorded.</td></tr>'
  )
  INTO v_items_rows
  FROM public.rtw_order_item roi
  LEFT JOIN public.product_variation pv ON roi.product_variant_id = pv.id
  LEFT JOIN public.product p ON pv.product_id = p.id
  WHERE roi.parent_order_id = NEW.id;

  -- 5. Build full HTML email using the exact reference luxury design
  v_html_body := '<div style="font-family: -apple-system, BlinkMacSystemFont, ''Segoe UI'', Roboto, Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 36px 20px; background-color: #FAF8F5; color: #162029;">'
    || '<!-- Brand Header with Logo -->'
    || '<div style="text-align: center; margin-bottom: 28px;">'
    || '<img src="https://myqtjagrzcgchfxhixzw.supabase.co/storage/v1/object/public/product_images/krabe-main-logo.png" alt="Krabe Kollection" width="130" style="display: block; margin: 0 auto 12px; max-width: 130px; height: auto; border: 0; outline: none; text-decoration: none;">'
    || '<p style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; color: #44637B; margin: 6px 0 0; font-weight: 600;">Ancestral Heritage &middot; Contemporary Tailoring</p>'
    || '</div>'
    || '<!-- Main Content Card -->'
    || '<div style="background: #ffffff; border: 1px solid #E5E7EB; border-radius: 8px; padding: 32px 26px; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">'
    || '<div style="text-align: center; margin-bottom: 24px;">'
    || '<h2 style="font-size: 20px; font-weight: 700; color: #162029; margin: 0 0 8px; letter-spacing: -0.3px;">Order Confirmed</h2>'
    || '<p style="font-size: 13.5px; line-height: 1.6; color: #64748B; margin: 0;">Thank you for your order, ' || v_customer_name || '. Our Lagos atelier has confirmed your order and is preparing your garment.</p>'
    || '</div>'
    || '<!-- Payment Reference Box -->'
    || '<div style="background: #FAF8F5; border: 1px solid #D4AF37; border-radius: 6px; padding: 16px 20px; text-align: center; margin-bottom: 24px;">'
    || '<p style="font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; color: #44637B; font-weight: 700; margin: 0 0 6px;">Payment Reference</p>'
    || '<span style="font-size: 22px; font-weight: 700; letter-spacing: 3px; color: #162029; font-family: ''Courier New'', monospace;">' || COALESCE(NEW.payment_reference, 'N/A') || '</span>'
    || '<div style="margin-top: 8px; font-size: 14px; font-weight: 600; color: #162029;">Total Paid: <span style="color: #44637B;">₦' || v_formatted_total || '</span></div>'
    || '</div>'
    || '<!-- Line Items Table -->'
    || '<div style="margin-bottom: 24px;">'
    || '<h3 style="font-size: 12px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: #162029; margin: 0 0 10px; border-bottom: 1px solid #F1F5F9; padding-bottom: 8px;">Garments in this Order</h3>'
    || '<table style="width: 100%; border-collapse: collapse;">' || v_items_rows || '</table>'
    || '</div>'
    || '<div style="background: #FAF8F5; border-radius: 6px; padding: 14px 16px; margin-bottom: 24px; font-size: 12.5px; line-height: 1.6; color: #475569;">'
    || '<div><strong>Fulfillment Method:</strong> ' || v_delivery_opt || '</div>'
    || '<div><strong>Recipient:</strong> ' || v_customer_name || ' &bull; ' || v_customer_phone || '</div>'
    || '<div><strong>Delivery Address:</strong> ' || v_delivery_addr || '</div>'
    || '</div>'
    || '<div style="border-top: 1px solid #E5E7EB; padding-top: 18px; text-align: center;">'
    || '<p style="font-size: 12px; color: #64748B; line-height: 1.6; margin: 0 0 6px;">✓ <strong>Crafted On Demand:</strong> Ready-to-wear items dispatch within 24–48 hours; bespoke pieces undergo individual pattern drafting.</p>'
    || '<p style="font-size: 12px; color: #94A3B8; margin: 0;">Dispatch rider delivery fees are settled directly upon delivery.</p>'
    || '</div>'
    || '</div>'
    || '<div style="text-align: center; margin-top: 24px; font-size: 11px; color: #94A3B8; line-height: 1.6;">'
    || '<p style="margin: 0;">Need assistance? Reply directly to this email or contact our Lagos atelier.</p>'
    || '<p style="margin: 4px 0 0;">&copy; Krabe Kollection. All rights reserved.</p>'
    || '</div>'
    || '</div>';

  -- 6. Trigger HTTP call to Brevo Transactional Email API via pg_net
  PERFORM net.http_post(
    url := 'https://api.brevo.com/v3/smtp/email',
    headers := jsonb_build_object(
      'api-key', v_api_key,
      'Content-Type', 'application/json',
      'Accept', 'application/json'
    ),
    body := jsonb_build_object(
      'sender', jsonb_build_object(
        'name', 'Krabe Kollection',
        'email', v_sender_email
      ),
      'to', jsonb_build_array(
        jsonb_build_object(
          'email', lower(trim(NEW.email)),
          'name', v_customer_name
        )
      ),
      'subject', 'Order Confirmed — ' || COALESCE(NEW.payment_reference, 'Krabe Kollection'),
      'htmlContent', v_html_body
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Failed sending order confirmation email via Brevo for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- Restrict execution permissions
REVOKE EXECUTE ON FUNCTION public.send_brevo_order_confirmed() FROM PUBLIC, anon, authenticated;

-- Attach trigger: fires when status transitions from 'payment confirmed' to 'order confirmed'
DROP TRIGGER IF EXISTS tr_order_payment_confirmed_email ON public.ready_to_wear_order;
DROP TRIGGER IF EXISTS tr_order_confirmed_email ON public.ready_to_wear_order;

CREATE TRIGGER tr_order_confirmed_email
AFTER UPDATE OF status ON public.ready_to_wear_order
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM 'order confirmed' AND NEW.status = 'order confirmed')
EXECUTE FUNCTION public.send_brevo_order_confirmed();
