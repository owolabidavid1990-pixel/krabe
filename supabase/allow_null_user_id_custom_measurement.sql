-- =============================================================================
-- Migration: Allow NULL for user_id in public.custom_measurement
-- Enables studio / atelier measurements to exist without an assigned user account
-- =============================================================================

ALTER TABLE public.custom_measurement ALTER COLUMN user_id DROP NOT NULL;
