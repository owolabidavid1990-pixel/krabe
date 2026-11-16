-- =============================================================================
-- KRABE KOLLECTION — ORDER STATUS TRANSITION FUNCTION (RPC)
--
-- Description:
-- Secure database function for updating ready_to_wear_order status.
-- Uses existing public.is_admin() and public.is_super_admin() helper functions.
--
-- Enforces strict role-based state transitions:
-- - Super Admin: Can change any order to any status.
-- - Regular Admin: CANNOT change an order from 'placed' to 'payment confirmed'.
--   Can only change from 'payment confirmed' downwards (order confirmed, processing, etc.).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.update_order_status(
  p_order_id uuid,
  p_new_status text
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_current_status text;
  v_is_super boolean;
  v_is_adm boolean;
BEGIN
  -- 1. Call your existing database helper functions
  v_is_super := public.is_super_admin();
  v_is_adm := public.is_admin();

  -- Strict check: At least one must be explicitly true
  IF (v_is_super IS NOT TRUE AND v_is_adm IS NOT TRUE) THEN
    RAISE EXCEPTION 'Forbidden: You do not have permission to update order status.';
  END IF;

  -- 2. Fetch current status of the order
  SELECT status INTO v_current_status
  FROM public.ready_to_wear_order
  WHERE id = p_order_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found.';
  END IF;

  -- 3. Enforce Role-Based State Transitions:
  -- Super Admin: Can change any status to any status
  -- Regular Admin: Cannot change 'placed' -> 'payment confirmed', and cannot reset orders back to 'placed'
  IF v_is_super IS NOT TRUE THEN
    IF v_current_status = 'placed' AND p_new_status = 'payment confirmed' THEN
      RAISE EXCEPTION 'Permission Denied: Only Super Admins can manually confirm payment for placed orders.';
    END IF;

    IF p_new_status = 'placed' THEN
      RAISE EXCEPTION 'Permission Denied: Regular admins cannot reset orders back to placed.';
    END IF;
  END IF;

  -- 4. Perform the update
  UPDATE public.ready_to_wear_order
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_order_id;

  RETURN json_build_object(
    'success', true,
    'order_id', p_order_id,
    'previous_status', v_current_status,
    'new_status', p_new_status
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_order_status(uuid, text) TO authenticated;
