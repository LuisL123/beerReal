-- Add pinned_badge column to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS pinned_badge text;
