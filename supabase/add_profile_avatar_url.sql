-- ============================================================================
-- ADD AVATAR_URL TO PUBLIC.PROFILE & GRANT TO AUTHENTICATED
-- ============================================================================

-- 1. Add the column
ALTER TABLE public.profile 
ADD COLUMN IF NOT EXISTS avatar_url text;

-- 2. Grant permissions to authenticated
GRANT SELECT, UPDATE ON public.profile TO authenticated;
