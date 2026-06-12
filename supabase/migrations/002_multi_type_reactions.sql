-- ============================================================
-- Migration 002: multi-type reactions
-- Replaces single cheers-per-post with six emoji reaction types,
-- each uniquely constrained per (post, user, type).
-- ============================================================

-- Create enum for the six reaction kinds
CREATE TYPE public.reaction_kind AS ENUM (
  'same', 'rough', 'jealous', 'respect', 'lightweight', 'suspicious'
);

-- Drop the old one-reaction-per-post unique constraint
ALTER TABLE public.reactions
  DROP CONSTRAINT IF EXISTS reactions_post_id_user_id_key;

-- Rename type → reaction_type and cast to enum
-- All existing 'cheers' reactions become 'same'
ALTER TABLE public.reactions
  RENAME COLUMN type TO reaction_type;

ALTER TABLE public.reactions
  ALTER COLUMN reaction_type DROP DEFAULT;

ALTER TABLE public.reactions
  ALTER COLUMN reaction_type TYPE public.reaction_kind
  USING 'same'::public.reaction_kind;

ALTER TABLE public.reactions
  ALTER COLUMN reaction_type SET DEFAULT 'same';

-- New constraint: one reaction of each kind per user per post
ALTER TABLE public.reactions
  ADD CONSTRAINT reactions_post_user_type_key
  UNIQUE (post_id, user_id, reaction_type);

NOTIFY pgrst, 'reload schema';
