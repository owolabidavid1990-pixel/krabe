-- =============================================================================
-- KRABE KOLLECTION — CREATE CUSTOM ORDER RPC
--
-- Description:
-- Secure, atomic database function for logging bespoke commissions & custom orders.
-- Strictly validates that at least one garment item exists and validates all amounts.
-- Sums total_charge strictly from items.
-- Saves full measurement data into measurement_snapshot (JSONB).
-- =============================================================================

-- Ensure column measurement_snapshot exists on custom_order_item table
ALTER TABLE public.custom_order_item 
ADD COLUMN IF NOT EXISTS measurement_snapshot jsonb DEFAULT NULL;

CREATE OR REPLACE FUNCTION public.create_custom_order(
  p_order jsonb,
  p_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_req_id text;
  v_item jsonb;
  v_item_charge numeric;
  v_total numeric := 0;
  v_deposit numeric := 0;
  v_user_id uuid;
  v_measurement_snapshot jsonb;
  v_fabrics text[];
  v_inspirations text[];
  v_uuid_clean text;
BEGIN
  -- =========================================================================
  -- 1. SECURITY CHECK: Admin Only
  -- =========================================================================
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can log custom orders.';
  END IF;

  -- =========================================================================
  -- 2. VALIDATION: At least one garment item required
  -- =========================================================================
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) < 1 THEN
    RAISE EXCEPTION 'Validation error: A custom order must contain at least one garment item.';
  END IF;

  -- =========================================================================
  -- 3. FINANCIAL VALIDATION: Sum from items, validate each charge
  -- =========================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF NULLIF(v_item->>'charge', '') IS NULL OR (v_item->>'charge')::numeric <= 0 THEN
      RAISE EXCEPTION 'Validation error: Each garment must have a valid positive charge.';
    END IF;
    v_item_charge := (v_item->>'charge')::numeric;
    v_total := v_total + v_item_charge;
  END LOOP;

  v_deposit := COALESCE(NULLIF(p_order->>'payment_made', '')::numeric, 0);

  IF v_deposit < 0 THEN
    RAISE EXCEPTION 'Validation error: Deposit amount cannot be negative.';
  END IF;

  IF v_deposit > v_total THEN
    RAISE EXCEPTION 'Validation error: Deposit received (%) cannot exceed total charge (%).', v_deposit, v_total;
  END IF;

  -- =========================================================================
  -- 4. GENERATE COLLISION-PROOF REQUEST ID
  -- Format: BES-YYMMDD-<16 hex chars>
  -- Example: BES-261120-A3F2C8D14E9B7F01
  -- Using full UUID stripped of dashes (32 chars), taking first 16 = ~1.2×10^19 combinations
  -- =========================================================================
  v_uuid_clean := REPLACE(gen_random_uuid()::text, '-', '');
  v_req_id := 'BES-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || UPPER(SUBSTRING(v_uuid_clean FROM 1 FOR 16));

  -- =========================================================================
  -- 5. RESOLVE USER ID
  -- Link to a patron UUID if provided & valid, else fallback to staff auth.uid()
  -- =========================================================================
  IF p_order->>'user_id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
    v_user_id := (p_order->>'user_id')::uuid;
  ELSE
    v_user_id := auth.uid();
  END IF;

  -- =========================================================================
  -- 6. INSERT PARENT: custom_order
  -- =========================================================================
  INSERT INTO public.custom_order (
    user_id,
    request_id,
    customer_name,
    customer_email,
    deadline_date,
    description_notes,
    total_charge,
    payment_made,
    status
  )
  VALUES (
    v_user_id,
    v_req_id,
    COALESCE(NULLIF(p_order->>'customer_name', ''), 'Bespoke Client'),
    p_order->>'customer_email',
    CASE
      WHEN p_order->>'deadline_date' IS NOT NULL AND p_order->>'deadline_date' <> ''
      THEN (p_order->>'deadline_date')::timestamptz
      ELSE NULL
    END,
    p_order->>'description_notes',
    v_total,
    v_deposit,
    COALESCE((p_order->>'status')::public.order_status, 'placed'::public.order_status)
  )
  RETURNING id INTO v_order_id;

  -- =========================================================================
  -- 7. INSERT CHILD ITEMS: custom_order_item (Saving measurement_snapshot JSONB)
  -- =========================================================================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    -- Extract measurement_snapshot JSONB
    IF v_item ? 'measurement_snapshot' AND v_item->'measurement_snapshot' IS NOT NULL AND jsonb_typeof(v_item->'measurement_snapshot') = 'object' THEN
      v_measurement_snapshot := v_item->'measurement_snapshot';
    ELSE
      v_measurement_snapshot := NULL;
    END IF;

    -- Safe fabric_photos parsing
    IF jsonb_typeof(v_item->'fabric_photos') = 'array' THEN
      v_fabrics := ARRAY(SELECT jsonb_array_elements_text(v_item->'fabric_photos'));
    ELSIF v_item->>'fabric_photos' IS NOT NULL AND v_item->>'fabric_photos' <> '' THEN
      v_fabrics := ARRAY[v_item->>'fabric_photos'];
    ELSE
      v_fabrics := '{}'::text[];
    END IF;

    -- Safe inspiration_photos parsing
    IF jsonb_typeof(v_item->'inspiration_photos') = 'array' THEN
      v_inspirations := ARRAY(SELECT jsonb_array_elements_text(v_item->'inspiration_photos'));
    ELSIF v_item->>'inspiration_photos' IS NOT NULL AND v_item->>'inspiration_photos' <> '' THEN
      v_inspirations := ARRAY[v_item->>'inspiration_photos'];
    ELSE
      v_inspirations := '{}'::text[];
    END IF;

    INSERT INTO public.custom_order_item (
      custom_order_id,
      measurement_snapshot,
      category,
      gender,
      charge,
      description_notes,
      fabric_photos,
      inspiration_photos
    )
    VALUES (
      v_order_id,
      v_measurement_snapshot,
      COALESCE((v_item->>'category')::public.clothing_category, 'native'::public.clothing_category),
      COALESCE((v_item->>'gender')::public.gender_type, 'male'::public.gender_type),
      (v_item->>'charge')::numeric,
      v_item->>'description_notes',
      v_fabrics,
      v_inspirations
    );
  END LOOP;

  -- =========================================================================
  -- 8. RETURN SUCCESS PAYLOAD
  -- =========================================================================
  RETURN jsonb_build_object(
    'success', true,
    'order_id', v_order_id,
    'request_id', v_req_id,
    'items_count', jsonb_array_length(p_items),
    'total_charge', v_total,
    'payment_made', v_deposit,
    'balance_due', GREATEST(0, v_total - v_deposit)
  );
END;
$$;

-- =============================================================================
-- PERMISSIONS: Lock down to authenticated only; revoke from PUBLIC and anon
-- =============================================================================
REVOKE ALL ON FUNCTION public.create_custom_order(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_custom_order(jsonb, jsonb) TO authenticated;
