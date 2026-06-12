-- ============================================================
-- Migration 001: two-tier beer counting + multi-photo posts
-- ============================================================

-- ── profiles ─────────────────────────────────────────────────
-- Add the two sub-columns
ALTER TABLE public.profiles
  ADD COLUMN verified_beer_count integer NOT NULL DEFAULT 0,
  ADD COLUMN self_reported_count  integer NOT NULL DEFAULT 0;

-- Treat all existing counts as verified
UPDATE public.profiles
  SET verified_beer_count = beer_count;

-- Replace the plain column with a generated one so the DB enforces the invariant
ALTER TABLE public.profiles DROP COLUMN beer_count;

ALTER TABLE public.profiles
  ADD COLUMN beer_count integer
    GENERATED ALWAYS AS (verified_beer_count + self_reported_count) STORED;

-- ── posts ────────────────────────────────────────────────────
ALTER TABLE public.posts
  ADD COLUMN photo_count  integer NOT NULL DEFAULT 1,
  ADD COLUMN extra_count  integer NOT NULL DEFAULT 0,
  ADD COLUMN image_urls   text[]  NOT NULL DEFAULT '{}';

-- ── atomic increment helper ──────────────────────────────────
-- Replaces the old client-side read-modify-write to avoid a TOCTOU race.
-- Called via supabase.rpc('increment_beer_counts', { uid, photo_n, extra_n })
CREATE OR REPLACE FUNCTION public.increment_beer_counts(
  uid     uuid,
  photo_n integer,
  extra_n integer
)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE public.profiles
  SET
    verified_beer_count = verified_beer_count + photo_n,
    self_reported_count  = self_reported_count  + extra_n
  WHERE id = uid;
$$;
