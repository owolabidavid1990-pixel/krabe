-- ============================================================================
-- Automated Database Trigger: Claim Guest Orders on Auth (Sign-Up & Login)
-- ============================================================================
-- Purpose: Automatically binds any ready_to_wear_order where user_id IS NULL 
--          to the user's UUID whenever they sign up or log in.
-- Security: SECURITY DEFINER with fixed search_path.
-- Permissions: REVOKED from anon and authenticated so it can ONLY be fired by 
--              PostgreSQL internal database triggers.
-- ============================================================================

-- 1. Create or replace the trigger function
CREATE OR REPLACE FUNCTION public.fn_claim_guest_orders_on_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify email exists on the user record
  IF NEW.email IS NOT NULL AND TRIM(NEW.email) <> '' THEN
    UPDATE public.ready_to_wear_order
    SET 
      user_id = NEW.id,
      updated_at = NOW()
    WHERE user_id IS NULL
      AND LOWER(TRIM(email)) = LOWER(TRIM(NEW.email));
  END IF;

  RETURN NEW;
END;
$$;

-- 2. Strict Security: Revoke all execution rights from API roles
REVOKE ALL ON FUNCTION public.fn_claim_guest_orders_on_auth() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.fn_claim_guest_orders_on_auth() FROM anon;
REVOKE ALL ON FUNCTION public.fn_claim_guest_orders_on_auth() FROM authenticated;

-- 3. Trigger 1: Automatically fire when a new user signs up
DROP TRIGGER IF EXISTS tr_claim_orders_on_signup ON auth.users;
CREATE TRIGGER tr_claim_orders_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.fn_claim_guest_orders_on_auth();

-- 4. Trigger 2: Automatically fire when an existing user logs in
DROP TRIGGER IF EXISTS tr_claim_orders_on_login ON auth.users;
CREATE TRIGGER tr_claim_orders_on_login
AFTER UPDATE OF last_sign_in_at ON auth.users
FOR EACH ROW
WHEN (OLD.last_sign_in_at IS DISTINCT FROM NEW.last_sign_in_at)
EXECUTE FUNCTION public.fn_claim_guest_orders_on_auth();

-- 5. Drop deprecated RPC function if previously created
DROP FUNCTION IF EXISTS public.claim_guest_orders();
