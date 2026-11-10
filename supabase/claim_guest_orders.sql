-- ============================================================================
-- Function: claim_guest_orders
-- Purpose: Finds all ready_to_wear_order records where user_id IS NULL and email
--          matches the authenticated user's email, and assigns their user_id.
-- Security: SECURITY DEFINER with fixed search_path to securely update orders
--           without being restricted by standard UPDATE RLS policies.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.claim_guest_orders()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_count integer := 0;
BEGIN
  -- 1. Verify caller is authenticated
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- 2. Lookup authenticated user's email from auth.users
  SELECT email INTO v_email
  FROM auth.users
  WHERE id = v_user_id;

  IF v_email IS NULL OR TRIM(v_email) = '' THEN
    RETURN 0;
  END IF;

  -- 3. Update orders that have no user_id but match this user's email
  UPDATE public.ready_to_wear_order
  SET 
    user_id = v_user_id,
    updated_at = NOW()
  WHERE user_id IS NULL
    AND LOWER(TRIM(email)) = LOWER(TRIM(v_email));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

-- Grant execution permission specifically to authenticated users
REVOKE ALL ON FUNCTION public.claim_guest_orders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_guest_orders() TO authenticated;

