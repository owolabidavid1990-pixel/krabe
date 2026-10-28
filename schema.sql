-- ============================================================================
-- KRABE KOLLECTION — MASTER DATABASE BLUEPRINT
-- Location: /Users/david/projects/krabe/schema.sql
-- ============================================================================

-- ============================================================================
-- 1. CUSTOM ENUM TYPES (OPTION SETS)
-- ============================================================================

DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'requested', 'confirmed', 'inprogress', 'done'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE clothing_category AS ENUM (
    'native', 'formal', 'streetwear'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE delivery_option AS ENUM (
    'pickup', 'local delivery', 'nationwide delivery'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE fabric_type AS ENUM (
    'cotton', 'linen', 'denim', 'wool', 'cashmere', 'silk', 
    'polyester', 'nylon', 'leather', 'suede', 'velvet', 'satin', 
    'knit', 'fleece', 'ankara', 'lace', 'other'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE gender_type AS ENUM (
    'male', 'female', 'unisex'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE measurement_type AS ENUM (
    'custom', 'from chart'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'placed', 'payment confirmed', 'order confirmed', 'processing order', 
    'order ready', 'dispatched', 'delivered', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM (
    'success', 'failed', 'abandoned', 'ongoing', 
    'pending', 'processing', 'queued', 'reversed'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE product_type AS ENUM (
    'bespoke', 'made to order'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE return_status AS ENUM (
    'requested', 'returned'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM (
    'customer', 'admin', 'super admin'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE clothing_size AS ENUM (
    'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'custom'
  );
EXCEPTION WHEN duplicate_object THEN null; END $$;


-- ============================================================================
-- 2. TABLES & RELATIONSHIPS
-- ============================================================================

-- Table 1: App Variables (Store locations, global site variables)
CREATE TABLE IF NOT EXISTS public.app_variable (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  store_location jsonb,
  slug text,
  whatsapp_contact text,
  instagram text,
  tiktok text,
  CONSTRAINT app_variable_pkey PRIMARY KEY (id),
  CONSTRAINT check_whatsapp_contact CHECK (whatsapp_contact IS NULL OR whatsapp_contact ~ '^\+?[0-9]{10,15}$')
);

-- Table 2: Appointments (Bespoke fitting and showroom bookings)
CREATE TABLE IF NOT EXISTS public.appointment (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  requested_date timestamp with time zone NOT NULL,
  notes text,
  slug text,
  status appointment_status DEFAULT 'requested'::appointment_status,
  CONSTRAINT appointment_pkey PRIMARY KEY (id),
  CONSTRAINT appointments_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table 3: Collections (Clothing collections, e.g. "Harmattan Royalty", "Summer Native")
CREATE TABLE IF NOT EXISTS public.collection (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text NOT NULL,
  is_featured boolean DEFAULT false,
  slug text,
  CONSTRAINT collection_pkey PRIMARY KEY (id)
);

-- Table 4: Products (Made to order and bespoke catalog items)
CREATE TABLE IF NOT EXISTS public.product (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  title text NOT NULL,
  category clothing_category NOT NULL,
  gender gender_type NOT NULL,
  description text,
  is_featured boolean DEFAULT false,
  is_new_arrival boolean DEFAULT false,
  sold_out boolean DEFAULT false,
  favourited_count integer DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  search_text text,
  slug text,
  collection uuid,
  type product_type NOT NULL,
  CONSTRAINT product_pkey PRIMARY KEY (id),
  CONSTRAINT products_collection_fkey FOREIGN KEY (collection) REFERENCES public.collection(id) ON DELETE SET NULL
);

-- Table 5: Product Variations (Colors, color codes, fabrics, prices, images)
CREATE TABLE IF NOT EXISTS public.product_variation (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  product_id uuid NOT NULL,
  color text,
  color_code text DEFAULT '#2F475A',
  fabric fabric_type,
  price numeric NOT NULL,
  main_image text,
  gallery_images text[] DEFAULT '{}'::text[],
  available boolean DEFAULT true,
  favorited_count integer DEFAULT 0,
  sales_count integer NOT NULL DEFAULT 0,
  slug text,
  CONSTRAINT product_variation_pkey PRIMARY KEY (id),
  CONSTRAINT product_variations_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE
);

-- Table 6: Cart Items (Shopping bags for registered accounts)
CREATE TABLE IF NOT EXISTS public.cart_item (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_variation_id uuid NOT NULL,
  selected_size text NOT NULL DEFAULT 'M',
  quantity integer NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL,
  slug text,
  CONSTRAINT cart_item_pkey PRIMARY KEY (id),
  CONSTRAINT cart_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT cart_items_product_variation_id_fkey FOREIGN KEY (product_variation_id) REFERENCES public.product_variation(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_cart_item UNIQUE (user_id, product_variation_id, selected_size)
);

-- Table 7: Chart Display (Measurement guide diagrams by gender)
CREATE TABLE IF NOT EXISTS public.chart_display (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  gender text NOT NULL,
  image_url text NOT NULL,
  slug text,
  CONSTRAINT chart_display_pkey PRIMARY KEY (id)
);

-- Table 8: Custom Measurements (30+ bespoke tailoring body measurements)
CREATE TABLE IF NOT EXISTS public.custom_measurement (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  label text,
  gender gender_type NOT NULL,
  notes text,
  neck numeric,
  shoulder numeric,
  round_chest numeric,
  round_bust numeric,
  round_underbust numeric,
  apex_nipple_to_nipple numeric,
  shoulder_to_bust_point numeric,
  shoulder_to_underbust numeric,
  half_length numeric,
  waist numeric,
  hip numeric,
  skirt_band numeric,
  armhole numeric,
  round_bicep numeric,
  round_3_4 numeric,
  sleeve_length_short numeric,
  sleeve_length_3_4 numeric,
  sleeve_length_long numeric,
  round_longsleeve numeric,
  agbada_length numeric,
  agbada_sleeves numeric,
  head_cap numeric,
  flap numeric,
  thigh_lap numeric,
  knee_round numeric,
  calf numeric,
  ankle_round numeric,
  trouser_length_short numeric,
  trouser_length_3_4 numeric,
  trouser_length_ankle numeric,
  trouser_length_long numeric,
  slug text,
  CONSTRAINT custom_measurement_pkey PRIMARY KEY (id),
  CONSTRAINT custom_measurements_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table 9: Custom Orders (Bespoke tailoring projects)
CREATE TABLE IF NOT EXISTS public.custom_order (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  request_id text UNIQUE,
  customer_name text,
  customer_email text,
  deadline_date timestamp with time zone,
  description_notes text,
  total_charge numeric DEFAULT 0,
  payment_made numeric DEFAULT 0,
  slug text,
  status order_status NOT NULL DEFAULT 'placed'::order_status,
  CONSTRAINT custom_order_pkey PRIMARY KEY (id),
  CONSTRAINT custom_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table 10: Custom Order Items (Individual garment items inside a bespoke order)
CREATE TABLE IF NOT EXISTS public.custom_order_item (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  custom_order_id uuid NOT NULL,
  measurement_id uuid,
  category clothing_category NOT NULL,
  gender gender_type NOT NULL,
  charge numeric DEFAULT 0,
  description_notes text,
  fabric_photos text[] DEFAULT '{}'::text[],
  inspiration_photos text[] DEFAULT '{}'::text[],
  slug text,
  CONSTRAINT custom_order_item_pkey PRIMARY KEY (id),
  CONSTRAINT custom_order_items_measurement_id_fkey FOREIGN KEY (measurement_id) REFERENCES public.custom_measurement(id) ON DELETE SET NULL,
  CONSTRAINT custom_order_item_custom_order_id_fkey FOREIGN KEY (custom_order_id) REFERENCES public.custom_order(id) ON DELETE CASCADE
);

-- Table 11: Favourites (Customer wishlist)
CREATE TABLE IF NOT EXISTS public.favourite (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  product_id uuid NOT NULL,
  slug text,
  CONSTRAINT favourite_pkey PRIMARY KEY (id),
  CONSTRAINT favourites_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT favourite_product_id_fkey FOREIGN KEY (product_id) REFERENCES public.product(id) ON DELETE CASCADE,
  CONSTRAINT unique_user_product UNIQUE (user_id, product_id)
);

-- Table 12: Profiles (Public user metadata attached to auth.users)
CREATE TABLE IF NOT EXISTS public.profile (
  id uuid NOT NULL DEFAULT auth.uid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  name text,
  phone_number text,
  whatsapp_number text,
  has_card boolean DEFAULT false,
  addresses jsonb DEFAULT '[]'::jsonb,
  slug text,
  role user_role NOT NULL DEFAULT 'customer'::user_role,
  CONSTRAINT profile_pkey PRIMARY KEY (id),
  CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Table 13: Made to Order Orders (Checkout sales)
CREATE TABLE IF NOT EXISTS public.ready_to_wear_order (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  user_id uuid DEFAULT auth.uid(), -- NULL allows guest checkout!
  email text NOT NULL,
  recipient_number text,
  delivery_address jsonb,
  delivery_option_chosen delivery_option,
  delivery_fee numeric DEFAULT 0,
  subtotal numeric NOT NULL,
  total_amount numeric NOT NULL,
  payment_reference text,
  slug text,
  payment_status payment_status NOT NULL,
  status order_status NOT NULL DEFAULT 'placed'::order_status,
  CONSTRAINT ready_to_wear_order_pkey PRIMARY KEY (id),
  CONSTRAINT ready_to_wear_orders_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Table 14: RTW Order Items (Line items for ready-to-wear orders)
CREATE TABLE IF NOT EXISTS public.rtw_order_item (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  parent_order_id uuid NOT NULL,
  product_variant_id uuid NOT NULL,
  selected_size text NOT NULL DEFAULT 'M',
  price numeric NOT NULL,
  quantity integer DEFAULT 1,
  slug text,
  CONSTRAINT rtw_order_item_pkey PRIMARY KEY (id),
  CONSTRAINT rtw_order_items_parent_order_id_fkey FOREIGN KEY (parent_order_id) REFERENCES public.ready_to_wear_order(id) ON DELETE CASCADE,
  CONSTRAINT rtw_order_items_product_variant_id_fkey FOREIGN KEY (product_variant_id) REFERENCES public.product_variation(id) ON DELETE RESTRICT
);

-- Table 15: Newsletter Subscribers (Private releases & VIP drops)
CREATE TABLE IF NOT EXISTS public.newsletter_subscriber (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  updated_at timestamp with time zone DEFAULT now() NOT NULL,
  user_id uuid,
  email text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  CONSTRAINT newsletter_subscriber_pkey PRIMARY KEY (id),
  CONSTRAINT newsletter_subscriber_email_key UNIQUE (email),
  CONSTRAINT newsletter_subscriber_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT chk_newsletter_subscriber_email CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);


-- ============================================================================
-- 3. AUTOMATIC USER PROFILE TRIGGER & ROLE SECURITY
-- Creates a matching public.profile row whenever a user signs up via auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role user_role := 'customer'::user_role;
BEGIN
  -- If officially INVITED with the master secret key, allow the assigned role
  IF new.invited_at IS NOT NULL AND new.raw_user_meta_data->>'role' IS NOT NULL THEN
    assigned_role := (new.raw_user_meta_data->>'role')::user_role;
  ELSE
    -- Any public website signup is FORCED to be 'customer'
    assigned_role := 'customer'::user_role;
  END IF;

  INSERT INTO public.profile (id, name, phone_number, whatsapp_number, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'whatsapp_number',
    assigned_role
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lock execution permissions so only internal auth can trigger this
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;


-- ============================================================================
-- 3. AUTOMATIC USER PROFILE TRIGGER & ROLE SECURITY
-- Creates a matching public.profile row whenever a user signs up via auth.users
-- ============================================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role user_role := 'customer'::user_role;
BEGIN
  -- If officially INVITED with the master secret key, allow the assigned role
  IF new.invited_at IS NOT NULL AND new.raw_user_meta_data->>'role' IS NOT NULL THEN
    assigned_role := (new.raw_user_meta_data->>'role')::user_role;
  ELSE
    -- Any public website signup is FORCED to be 'customer'
    assigned_role := 'customer'::user_role;
  END IF;

  INSERT INTO public.profile (id, name, phone_number, whatsapp_number, role)
  VALUES (
    new.id,
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'phone_number',
    new.raw_user_meta_data->>'whatsapp_number',
    assigned_role
  );
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Lock execution permissions so only internal auth can trigger this
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 4. AUTOMATIC UPDATED_AT TIMESTAMP TRIGGERS
-- Ensures updated_at is always set to now() whenever any row is modified
-- ============================================================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_app_variable_updated_at ON public.app_variable;
CREATE TRIGGER tr_app_variable_updated_at BEFORE UPDATE ON public.app_variable FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_appointment_updated_at ON public.appointment;
CREATE TRIGGER tr_appointment_updated_at BEFORE UPDATE ON public.appointment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_collection_updated_at ON public.collection;
CREATE TRIGGER tr_collection_updated_at BEFORE UPDATE ON public.collection FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_product_updated_at ON public.product;
CREATE TRIGGER tr_product_updated_at BEFORE UPDATE ON public.product FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_product_variation_updated_at ON public.product_variation;
CREATE TRIGGER tr_product_variation_updated_at BEFORE UPDATE ON public.product_variation FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_cart_item_updated_at ON public.cart_item;
CREATE TRIGGER tr_cart_item_updated_at BEFORE UPDATE ON public.cart_item FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_chart_display_updated_at ON public.chart_display;
CREATE TRIGGER tr_chart_display_updated_at BEFORE UPDATE ON public.chart_display FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_custom_measurement_updated_at ON public.custom_measurement;
CREATE TRIGGER tr_custom_measurement_updated_at BEFORE UPDATE ON public.custom_measurement FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_custom_order_updated_at ON public.custom_order;
CREATE TRIGGER tr_custom_order_updated_at BEFORE UPDATE ON public.custom_order FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_custom_order_item_updated_at ON public.custom_order_item;
CREATE TRIGGER tr_custom_order_item_updated_at BEFORE UPDATE ON public.custom_order_item FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_favourite_updated_at ON public.favourite;
CREATE TRIGGER tr_favourite_updated_at BEFORE UPDATE ON public.favourite FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_profile_updated_at ON public.profile;
CREATE TRIGGER tr_profile_updated_at BEFORE UPDATE ON public.profile FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_ready_to_wear_order_updated_at ON public.ready_to_wear_order;
CREATE TRIGGER tr_ready_to_wear_order_updated_at BEFORE UPDATE ON public.ready_to_wear_order FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_rtw_order_item_updated_at ON public.rtw_order_item;
CREATE TRIGGER tr_rtw_order_item_updated_at BEFORE UPDATE ON public.rtw_order_item FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS tr_newsletter_subscriber_updated_at ON public.newsletter_subscriber;
CREATE TRIGGER tr_newsletter_subscriber_updated_at BEFORE UPDATE ON public.newsletter_subscriber FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) & PUBLIC PERMISSIONS
-- =============================================================================
ALTER TABLE public.app_variable ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to app_variable" ON public.app_variable;
CREATE POLICY "Allow public read access to app_variable"
ON public.app_variable
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.app_variable TO anon, authenticated;

-- RLS: newsletter_subscriber
ALTER TABLE public.newsletter_subscriber ENABLE ROW LEVEL SECURITY;

-- 1. Anonymous visitors and authenticated users can subscribe (INSERT)
DROP POLICY IF EXISTS "Allow anon and auth insert to newsletter" ON public.newsletter_subscriber;
CREATE POLICY "Allow anon and auth insert to newsletter"
ON public.newsletter_subscriber
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 2. Authenticated users can view ONLY their own subscription status
DROP POLICY IF EXISTS "Authenticated users can select own subscription" ON public.newsletter_subscriber;
CREATE POLICY "Authenticated users can select own subscription"
ON public.newsletter_subscriber
FOR SELECT
TO authenticated
USING (
  lower(email) = lower(auth.jwt()->>'email')
  OR user_id = auth.uid()
);

-- 3. Authenticated users can update ONLY their own subscription (subscribe/unsubscribe)
DROP POLICY IF EXISTS "Authenticated users can update own subscription" ON public.newsletter_subscriber;
CREATE POLICY "Authenticated users can update own subscription"
ON public.newsletter_subscriber
FOR UPDATE
TO authenticated
USING (
  lower(email) = lower(auth.jwt()->>'email')
  OR user_id = auth.uid()
)
WITH CHECK (
  lower(email) = lower(auth.jwt()->>'email')
  OR user_id = auth.uid()
);

-- 4. Authenticated users can delete their own subscription
DROP POLICY IF EXISTS "Authenticated users can delete own subscription" ON public.newsletter_subscriber;
CREATE POLICY "Authenticated users can delete own subscription"
ON public.newsletter_subscriber
FOR DELETE
TO authenticated
USING (
  lower(email) = lower(auth.jwt()->>'email')
  OR user_id = auth.uid()
);

-- GRANTS:
-- Anon can ONLY submit an email to join (cannot scrape or read subscriber list)
GRANT INSERT ON public.newsletter_subscriber TO anon;

-- Logged-in customers can read and manage their own subscription record
GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscriber TO authenticated;

-- =============================================================================
-- BREVO NEWSLETTER AUTO-SYNC TRIGGER (via pg_net & Supabase Vault)
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.sync_brevo_newsletter_subscriber()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  v_api_key text;
  v_list_id int;
BEGIN
  -- Read secrets directly from Supabase Vault
  SELECT decrypted_secret INTO v_api_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'BREVO_API_KEY' 
  LIMIT 1;

  SELECT decrypted_secret::int INTO v_list_id 
  FROM vault.decrypted_secrets 
  WHERE name = 'BREVO_LIST_ID' 
  LIMIT 1;

  IF v_api_key IS NULL THEN
    RAISE EXCEPTION 'BREVO_API_KEY not found in Supabase Vault. Cannot sync newsletter.';
  END IF;

  -- 1. When subscribed (INSERT or reactivated) -> Add to list AND ensure not blacklisted
  IF (TG_OP = 'INSERT' AND NEW.is_active = true) OR (TG_OP = 'UPDATE' AND NEW.is_active = true AND OLD.is_active = false) THEN
    PERFORM net.http_post(
      url := 'https://api.brevo.com/v3/contacts',
      headers := jsonb_build_object(
        'api-key', v_api_key,
        'Content-Type', 'application/json',
        'Accept', 'application/json'
      ),
      body := jsonb_build_object(
        'email', lower(trim(NEW.email)),
        'updateEnabled', true,
        'emailBlacklisted', false,
        'listIds', CASE WHEN v_list_id IS NOT NULL THEN jsonb_build_array(v_list_id) ELSE jsonb_build_array() END
      )
    );

  -- 2. When unsubscribed (is_active = false) -> Remove strictly from newsletter list
  ELSIF (TG_OP = 'UPDATE' AND NEW.is_active = false AND OLD.is_active = true) THEN
    IF v_list_id IS NOT NULL THEN
      PERFORM net.http_post(
        url := 'https://api.brevo.com/v3/contacts/lists/' || v_list_id || '/contacts/remove',
        headers := jsonb_build_object(
          'api-key', v_api_key,
          'Content-Type', 'application/json',
          'Accept', 'application/json'
        ),
        body := jsonb_build_object(
          'emails', jsonb_build_array(lower(trim(NEW.email)))
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Protect the trigger function from being called from outside via API
REVOKE EXECUTE ON FUNCTION public.sync_brevo_newsletter_subscriber() FROM PUBLIC, anon, authenticated;

-- Attach trigger to public.newsletter_subscriber
DROP TRIGGER IF EXISTS tr_sync_brevo_newsletter ON public.newsletter_subscriber;
CREATE TRIGGER tr_sync_brevo_newsletter
AFTER INSERT OR UPDATE ON public.newsletter_subscriber
FOR EACH ROW EXECUTE FUNCTION public.sync_brevo_newsletter_subscriber();

