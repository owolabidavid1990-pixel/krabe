-- =============================================================================
-- KRABE KOLLECTION — CREATE & UPDATE PRODUCT RPC FUNCTIONS
--
-- Description:
-- Atomic PostgreSQL functions for creating and updating products & variations.
-- Strictly validates presence of at least one variation.
-- Enforces RTW vs MTW business logic:
--   - Ready to Wear (RTW): quantity >= 1 and size NOT NULL
--   - Made to Order (MTW) / Bespoke: quantity = NULL, size = NULL
-- Generates slug and search_text automatically.
-- =============================================================================

-- 1. Ensure product_type enum has 'ready to wear'
DO $$ BEGIN
  ALTER TYPE public.product_type ADD VALUE IF NOT EXISTS 'ready to wear';
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- 2. CREATE PRODUCT FUNCTION
CREATE OR REPLACE FUNCTION public.create_product(
  p_product jsonb,
  p_variations jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_title text;
  v_category public.clothing_category;
  v_gender public.gender_type;
  v_type public.product_type;
  v_description text;
  v_is_new_arrival boolean;
  v_is_featured boolean;
  v_sold_out boolean;
  v_slug text;
  v_search_text text;
  v_item jsonb;
  v_color text;
  v_color_code text;
  v_fabric public.fabric_type;
  v_price numeric;
  v_quantity integer;
  v_size text;
  v_main_image text;
  v_gallery text[];
  v_all_colors text := '';
  v_count integer := 0;
BEGIN
  -- Security check: admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can create products.';
  END IF;

  -- Validate title
  v_title := TRIM(p_product->>'title');
  IF v_title IS NULL OR v_title = '' THEN
    RAISE EXCEPTION 'Validation error: Product title is required.';
  END IF;

  -- Validate variations array
  IF p_variations IS NULL OR jsonb_typeof(p_variations) <> 'array' OR jsonb_array_length(p_variations) < 1 THEN
    RAISE EXCEPTION 'Validation error: A product must have at least one item/variation.';
  END IF;

  -- Parse product attributes
  v_category := COALESCE((p_product->>'category')::public.clothing_category, 'native'::public.clothing_category);
  v_gender := COALESCE((p_product->>'gender')::public.gender_type, 'male'::public.gender_type);
  v_type := COALESCE((p_product->>'type')::public.product_type, 'made to order'::public.product_type);
  v_description := NULLIF(TRIM(p_product->>'description'), '');
  v_is_new_arrival := COALESCE((p_product->>'is_new_arrival')::boolean, true);
  v_is_featured := COALESCE((p_product->>'is_featured')::boolean, false);
  v_sold_out := COALESCE((p_product->>'sold_out')::boolean, false);

  -- Slug generation
  IF p_product->>'slug' IS NOT NULL AND TRIM(p_product->>'slug') <> '' THEN
    v_slug := TRIM(p_product->>'slug');
  ELSE
    v_slug := LOWER(REGEXP_REPLACE(REGEXP_REPLACE(v_title, '[^a-zA-Z0-9]+', '-', 'g'), '^-+|-+$', '', 'g'))
              || '-' || TO_CHAR(NOW(), 'YYMMDD')
              || '-' || SUBSTRING(REPLACE(gen_random_uuid()::text, '-', '') FROM 1 FOR 6);
  END IF;

  -- Collect color names for search_text
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variations)
  LOOP
    IF v_item->>'color' IS NOT NULL AND TRIM(v_item->>'color') <> '' THEN
      v_all_colors := v_all_colors || ' ' || TRIM(v_item->>'color');
    END IF;
  END LOOP;

  v_search_text := LOWER(TRIM(v_title || ' ' || v_category::text || ' ' || v_gender::text || ' ' || v_type::text || ' ' || COALESCE(v_description, '') || ' ' || v_all_colors));

  -- Insert product header
  INSERT INTO public.product (
    title,
    category,
    gender,
    type,
    description,
    is_new_arrival,
    is_featured,
    sold_out,
    slug,
    search_text,
    sales_count,
    favourited_count,
    created_at,
    updated_at
  )
  VALUES (
    v_title,
    v_category,
    v_gender,
    v_type,
    v_description,
    v_is_new_arrival,
    v_is_featured,
    v_sold_out,
    v_slug,
    v_search_text,
    0,
    0,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_product_id;

  -- Insert variations
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variations)
  LOOP
    v_color := COALESCE(NULLIF(TRIM(v_item->>'color'), ''), 'Standard');
    v_color_code := COALESCE(NULLIF(TRIM(v_item->>'color_code'), ''), '#2F475A');
    
    IF v_item->>'fabric' IS NOT NULL AND v_item->>'fabric' <> '' THEN
      v_fabric := (v_item->>'fabric')::public.fabric_type;
    ELSE
      v_fabric := NULL;
    END IF;

    v_price := COALESCE(NULLIF(v_item->>'price', '')::numeric, 0);
    IF v_price < 0 THEN
      RAISE EXCEPTION 'Validation error: Price cannot be negative.';
    END IF;

    -- Type-specific logic: RTW requires quantity >= 1 and size; MTW forces quantity = NULL, size = NULL
    IF v_type = 'ready to wear' THEN
      v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1);
      IF v_quantity < 1 THEN
        v_quantity := 1;
      END IF;
      v_size := COALESCE(NULLIF(TRIM(v_item->>'size'), ''), 'M');
    ELSE
      v_quantity := NULL;
      v_size := NULL;
    END IF;

    v_main_image := NULLIF(TRIM(v_item->>'main_image'), '');

    IF jsonb_typeof(v_item->'gallery_images') = 'array' THEN
      v_gallery := ARRAY(SELECT jsonb_array_elements_text(v_item->'gallery_images'));
    ELSIF v_item->>'gallery_images' IS NOT NULL AND v_item->>'gallery_images' <> '' THEN
      v_gallery := ARRAY[v_item->>'gallery_images'];
    ELSE
      v_gallery := '{}'::text[];
    END IF;

    INSERT INTO public.product_variation (
      product_id,
      color,
      color_code,
      fabric,
      price,
      quantity,
      size,
      main_image,
      gallery_images,
      available,
      sales_count,
      favorited_count,
      created_at,
      updated_at
    )
    VALUES (
      v_product_id,
      v_color,
      v_color_code,
      v_fabric,
      v_price,
      v_quantity,
      v_size,
      v_main_image,
      v_gallery,
      COALESCE((v_item->>'available')::boolean, true),
      0,
      0,
      NOW(),
      NOW()
    );

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product_id,
    'title', v_title,
    'slug', v_slug,
    'type', v_type,
    'items_count', v_count
  );
END;
$$;

-- 3. UPDATE PRODUCT FUNCTION
CREATE OR REPLACE FUNCTION public.update_product(
  p_product jsonb,
  p_variations jsonb,
  p_deleted_variation_ids uuid[] DEFAULT '{}'::uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product_id uuid;
  v_title text;
  v_category public.clothing_category;
  v_gender public.gender_type;
  v_type public.product_type;
  v_description text;
  v_is_new_arrival boolean;
  v_is_featured boolean;
  v_sold_out boolean;
  v_search_text text;
  v_item jsonb;
  v_var_id uuid;
  v_color text;
  v_color_code text;
  v_fabric public.fabric_type;
  v_price numeric;
  v_quantity integer;
  v_size text;
  v_main_image text;
  v_gallery text[];
  v_all_colors text := '';
  v_count integer := 0;
BEGIN
  -- Security check: admin only
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Access denied: Only admins can update products.';
  END IF;

  v_product_id := (p_product->>'id')::uuid;
  IF v_product_id IS NULL THEN
    RAISE EXCEPTION 'Validation error: Missing product ID for update.';
  END IF;

  -- Validate title
  v_title := TRIM(p_product->>'title');
  IF v_title IS NULL OR v_title = '' THEN
    RAISE EXCEPTION 'Validation error: Product title is required.';
  END IF;

  -- Validate variations array
  IF p_variations IS NULL OR jsonb_typeof(p_variations) <> 'array' OR jsonb_array_length(p_variations) < 1 THEN
    RAISE EXCEPTION 'Validation error: A product must have at least one item/variation.';
  END IF;

  -- Parse product attributes
  v_category := COALESCE((p_product->>'category')::public.clothing_category, 'native'::public.clothing_category);
  v_gender := COALESCE((p_product->>'gender')::public.gender_type, 'male'::public.gender_type);
  v_type := COALESCE((p_product->>'type')::public.product_type, 'made to order'::public.product_type);
  v_description := NULLIF(TRIM(p_product->>'description'), '');
  v_is_new_arrival := COALESCE((p_product->>'is_new_arrival')::boolean, true);
  v_is_featured := COALESCE((p_product->>'is_featured')::boolean, false);
  v_sold_out := COALESCE((p_product->>'sold_out')::boolean, false);

  -- Collect color names for search_text
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variations)
  LOOP
    IF v_item->>'color' IS NOT NULL AND TRIM(v_item->>'color') <> '' THEN
      v_all_colors := v_all_colors || ' ' || TRIM(v_item->>'color');
    END IF;
  END LOOP;

  v_search_text := LOWER(TRIM(v_title || ' ' || v_category::text || ' ' || v_gender::text || ' ' || v_type::text || ' ' || COALESCE(v_description, '') || ' ' || v_all_colors));

  -- Update product header
  UPDATE public.product
  SET title = v_title,
      category = v_category,
      gender = v_gender,
      type = v_type,
      description = v_description,
      is_new_arrival = v_is_new_arrival,
      is_featured = v_is_featured,
      sold_out = v_sold_out,
      search_text = v_search_text,
      updated_at = NOW()
  WHERE id = v_product_id;

  -- Delete removed variations
  IF p_deleted_variation_ids IS NOT NULL AND array_length(p_deleted_variation_ids, 1) > 0 THEN
    DELETE FROM public.product_variation
    WHERE id = ANY(p_deleted_variation_ids)
      AND product_id = v_product_id;
  END IF;

  -- Upsert variations
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_variations)
  LOOP
    v_color := COALESCE(NULLIF(TRIM(v_item->>'color'), ''), 'Standard');
    v_color_code := COALESCE(NULLIF(TRIM(v_item->>'color_code'), ''), '#2F475A');
    
    IF v_item->>'fabric' IS NOT NULL AND v_item->>'fabric' <> '' THEN
      v_fabric := (v_item->>'fabric')::public.fabric_type;
    ELSE
      v_fabric := NULL;
    END IF;

    v_price := COALESCE(NULLIF(v_item->>'price', '')::numeric, 0);
    IF v_price < 0 THEN
      RAISE EXCEPTION 'Validation error: Price cannot be negative.';
    END IF;

    -- Type-specific logic: RTW requires quantity >= 1 and size; MTW forces quantity = NULL, size = NULL
    IF v_type = 'ready to wear' THEN
      v_quantity := COALESCE(NULLIF(v_item->>'quantity', '')::integer, 1);
      IF v_quantity < 1 THEN
        v_quantity := 1;
      END IF;
      v_size := COALESCE(NULLIF(TRIM(v_item->>'size'), ''), 'M');
    ELSE
      v_quantity := NULL;
      v_size := NULL;
    END IF;

    v_main_image := NULLIF(TRIM(v_item->>'main_image'), '');

    IF jsonb_typeof(v_item->'gallery_images') = 'array' THEN
      v_gallery := ARRAY(SELECT jsonb_array_elements_text(v_item->'gallery_images'));
    ELSIF v_item->>'gallery_images' IS NOT NULL AND v_item->>'gallery_images' <> '' THEN
      v_gallery := ARRAY[v_item->>'gallery_images'];
    ELSE
      v_gallery := '{}'::text[];
    END IF;

    IF v_item->>'id' ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' THEN
      v_var_id := (v_item->>'id')::uuid;
      UPDATE public.product_variation
      SET color = v_color,
          color_code = v_color_code,
          fabric = v_fabric,
          price = v_price,
          quantity = v_quantity,
          size = v_size,
          main_image = v_main_image,
          gallery_images = v_gallery,
          available = COALESCE((v_item->>'available')::boolean, true),
          updated_at = NOW()
      WHERE id = v_var_id AND product_id = v_product_id;
    ELSE
      INSERT INTO public.product_variation (
        product_id,
        color,
        color_code,
        fabric,
        price,
        quantity,
        size,
        main_image,
        gallery_images,
        available,
        sales_count,
        favorited_count,
        created_at,
        updated_at
      )
      VALUES (
        v_product_id,
        v_color,
        v_color_code,
        v_fabric,
        v_price,
        v_quantity,
        v_size,
        v_main_image,
        v_gallery,
        COALESCE((v_item->>'available')::boolean, true),
        0,
        0,
        NOW(),
        NOW()
      );
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'product_id', v_product_id,
    'title', v_title,
    'type', v_type,
    'items_count', v_count
  );
END;
$$;

-- Permissions: Lock down to authenticated only; revoke from PUBLIC and anon
REVOKE ALL ON FUNCTION public.create_product(jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_product(jsonb, jsonb) TO authenticated;

REVOKE ALL ON FUNCTION public.update_product(jsonb, jsonb, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_product(jsonb, jsonb, uuid[]) TO authenticated;
