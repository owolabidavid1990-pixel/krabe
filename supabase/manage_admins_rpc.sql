-- =============================================================================
-- KRABE KOLLECTION — SUPER ADMIN STAFF MANAGEMENT (DATABASE RPC FUNCTIONS)
--
-- Description:
-- Secure database functions for managing administrators and super admins.
-- Only Super Admins can execute these functions.
--
-- Functions provided:
--   1. public.is_admin() -> boolean
--   2. public.is_super_admin() -> boolean
--   3. public.get_staff_members() -> TABLE (id, email, name, phone, role, created_at, last_sign_in_at)
--   4. public.invite_admin(p_email text, p_name text) -> jsonb
--   5. public.remove_admin(p_user_id uuid, p_delete_account boolean) -> jsonb
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Helper: Check if active user is Admin or Super Admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE id = auth.uid()
      AND role IN ('admin'::user_role, 'super admin'::user_role)
  );
$$;

-- -----------------------------------------------------------------------------
-- 2. Helper: Check if active user is Super Admin
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profile
    WHERE id = auth.uid()
      AND role = 'super admin'::user_role
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. Query Staff Members (Admins & Super Admins only)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_staff_members()
RETURNS TABLE (
  id uuid,
  email text,
  name text,
  phone_number text,
  role user_role,
  created_at timestamptz,
  last_sign_in_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Only Super Admin can view staff members.';
  END IF;

  RETURN QUERY
  SELECT 
    p.id,
    COALESCE(u.email, p.email)::text AS email,
    p.name::text,
    p.phone_number::text,
    p.role,
    p.created_at,
    u.last_sign_in_at
  FROM public.profile p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.role IN ('admin'::user_role, 'super admin'::user_role)
  ORDER BY 
    CASE WHEN p.role = 'super admin' THEN 1 ELSE 2 END,
    p.created_at DESC;
END;
$$;

-- -----------------------------------------------------------------------------
-- 4. Invite Admin Staff (Database Function via pg_net / Supabase Auth)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.invite_admin(
  p_email text,
  p_name text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions, vault
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_clean_email text;
  v_clean_name text;
  v_existing_user_id uuid;
  v_existing_role user_role;
  v_service_key text;
  v_project_url text;
  v_payload jsonb;
BEGIN
  -- 1. Security Check: Only Super Admin can invite
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Only Super Admin can invite staff members.';
  END IF;

  -- 2. Validate email
  v_clean_email := lower(trim(p_email));
  v_clean_name := trim(COALESCE(p_name, ''));

  IF v_clean_email IS NULL OR v_clean_email = '' OR v_clean_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
    RAISE EXCEPTION 'Please provide a valid email address.';
  END IF;

  -- 3. Check if user already exists
  SELECT id, role INTO v_existing_user_id, v_existing_role 
  FROM public.profile 
  WHERE lower(email) = v_clean_email 
  LIMIT 1;

  IF v_existing_user_id IS NULL THEN
    SELECT id INTO v_existing_user_id 
    FROM auth.users 
    WHERE lower(email) = v_clean_email 
    LIMIT 1;
  END IF;

  -- If already an admin or super admin, block duplicate invite
  IF v_existing_user_id IS NOT NULL AND v_existing_role IN ('admin'::user_role, 'super admin'::user_role) THEN
    RAISE EXCEPTION 'User % is already an active % in the system.', v_clean_email, v_existing_role;
  END IF;

  -- If user exists as a customer, promote directly to admin
  IF v_existing_user_id IS NOT NULL THEN
    UPDATE public.profile 
    SET role = 'admin'::user_role,
        updated_at = NOW()
    WHERE id = v_existing_user_id;

    UPDATE auth.users 
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"admin"'::jsonb
    )
    WHERE id = v_existing_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'promoted', true,
      'message', 'User ' || v_clean_email || ' already had an account and has now been promoted to Admin.'
    );
  END IF;

  -- 4. New user: Retrieve Supabase Service Role Key from Vault
  SELECT decrypted_secret INTO v_service_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' 
  LIMIT 1;

  IF v_service_key IS NULL OR v_service_key = '' THEN
    RAISE EXCEPTION 'SUPABASE_SERVICE_ROLE_KEY not found in Supabase Vault. Please add your service_role secret in Project Settings -> Vault.';
  END IF;

  -- Read Project URL from Vault or fallback to default
  SELECT decrypted_secret INTO v_project_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL' 
  LIMIT 1;

  IF v_project_url IS NULL OR v_project_url = '' THEN
    v_project_url := 'https://gwknzycxxafhcyubtpps.supabase.co';
  END IF;

  -- 5. Trigger official Supabase invitation via pg_net (sends email through Brevo SMTP)
  v_payload := jsonb_build_object(
    'email', v_clean_email,
    'data', jsonb_build_object(
      'role', 'admin',
      'name', COALESCE(NULLIF(v_clean_name, ''), split_part(v_clean_email, '@', 1)),
      'invited_by', v_caller_id
    )
  );

  PERFORM net.http_post(
    url := rtrim(v_project_url, '/') || '/auth/v1/admin/invite',
    headers := jsonb_build_object(
      'apikey', v_service_key,
      'Authorization', 'Bearer ' || v_service_key,
      'Content-Type', 'application/json'
    ),
    body := v_payload
  );

  RETURN jsonb_build_object(
    'success', true,
    'promoted', false,
    'message', 'Invitation email dispatched to ' || v_clean_email || ' with Admin role.'
  );
END;
$$;

-- -----------------------------------------------------------------------------
-- 5. Remove or Revoke Admin Privileges
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_admin(
  p_user_id uuid,
  p_delete_account boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_target_role user_role;
  v_target_email text;
BEGIN
  -- 1. Security Check: Only Super Admin can remove admins
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Access denied: Only Super Admin can revoke admin permissions.';
  END IF;

  -- 2. Prevent self-removal
  IF p_user_id = v_caller_id THEN
    RAISE EXCEPTION 'Action blocked: You cannot revoke permissions from your own Super Admin account.';
  END IF;

  -- 3. Check target exists and verify role
  SELECT role, email INTO v_target_role, v_target_email
  FROM public.profile
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found in system.';
  END IF;

  IF v_target_role = 'super admin'::user_role THEN
    RAISE EXCEPTION 'Action blocked: Another Super Admin account cannot be removed through this action.';
  END IF;

  -- 4. Execute removal
  IF p_delete_account = true THEN
    -- Permanently delete from auth.users (cascades to profile)
    DELETE FROM auth.users WHERE id = p_user_id;
    RETURN jsonb_build_object(
      'success', true,
      'deleted', true,
      'message', 'Account for ' || COALESCE(v_target_email, 'user') || ' permanently deleted.'
    );
  ELSE
    -- Safe demotion to customer (instantly revokes backoffice access)
    UPDATE public.profile
    SET role = 'customer'::user_role,
        updated_at = NOW()
    WHERE id = p_user_id;

    UPDATE auth.users
    SET raw_user_meta_data = jsonb_set(
      COALESCE(raw_user_meta_data, '{}'::jsonb),
      '{role}',
      '"customer"'::jsonb
    )
    WHERE id = p_user_id;

    RETURN jsonb_build_object(
      'success', true,
      'demoted', true,
      'message', 'Admin privileges revoked for ' || COALESCE(v_target_email, 'user') || '. Account demoted to Customer.'
    );
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 6. Lock execution permissions to authenticated users only
-- -----------------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.get_staff_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_staff_members() TO authenticated;

REVOKE ALL ON FUNCTION public.invite_admin(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.invite_admin(text, text) TO authenticated;

REVOKE ALL ON FUNCTION public.remove_admin(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.remove_admin(uuid, boolean) TO authenticated;
