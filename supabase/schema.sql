-- ============================================================
-- Cheers App — Supabase Schema
-- Run this in your Supabase project: SQL Editor > New query
-- For existing projects, run supabase/migrations/001_two_tier_beer_counts.sql instead.
-- ============================================================

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id                   uuid references auth.users on delete cascade primary key,
  username             text unique not null,
  avatar_url           text,
  verified_beer_count  integer not null default 0,
  self_reported_count  integer not null default 0,
  -- generated: always equals verified_beer_count + self_reported_count; never update directly
  beer_count           integer generated always as (verified_beer_count + self_reported_count) stored,
  created_at           timestamptz not null default now()
);

-- Posts
create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  image_url   text not null,              -- primary/first photo (used as thumbnail everywhere)
  image_urls  text[] not null default '{}', -- additional photos (index 1…n); full array = [image_url] ++ image_urls
  photo_count integer not null default 1, -- total photos; drives verified_beer_count increment
  extra_count integer not null default 0, -- self-reported beers; drives self_reported_count increment
  caption     text,
  drink_type  text not null default 'Beer',
  created_at  timestamptz not null default now()
);

-- Reactions (one cheers per user per post)
create table if not exists public.reactions (
  id          uuid primary key default gen_random_uuid(),
  post_id     uuid references public.posts(id) on delete cascade not null,
  user_id     uuid references public.profiles(id) on delete cascade not null,
  type        text not null default 'cheers',
  created_at  timestamptz not null default now(),
  unique(post_id, user_id)
);

-- ── Row Level Security ──────────────────────────────────────
alter table public.profiles  enable row level security;
alter table public.posts      enable row level security;
alter table public.reactions  enable row level security;

-- Profiles
create policy "profiles_select" on public.profiles for select using (true);
create policy "profiles_insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on public.profiles for update using (auth.uid() = id);

-- Posts
create policy "posts_select" on public.posts for select using (true);
create policy "posts_insert" on public.posts for insert with check (auth.uid() = user_id);
create policy "posts_delete" on public.posts for delete using (auth.uid() = user_id);

-- Reactions
create policy "reactions_select" on public.reactions for select using (true);
create policy "reactions_insert" on public.reactions for insert with check (auth.uid() = user_id);
create policy "reactions_delete" on public.reactions for delete using (auth.uid() = user_id);

-- ── Atomic beer-count increment ─────────────────────────────
-- Called via supabase.rpc('increment_beer_counts', { uid, photo_n, extra_n })
create or replace function public.increment_beer_counts(
  uid     uuid,
  photo_n integer,
  extra_n integer
)
returns void
language sql
security definer
as $$
  update public.profiles
  set
    verified_beer_count = verified_beer_count + photo_n,
    self_reported_count  = self_reported_count  + extra_n
  where id = uid;
$$;

-- ── Storage ─────────────────────────────────────────────────
-- In Supabase Dashboard → Storage → New bucket:
--   Name: posts
--   Public: ✓ (checked)
--
-- Then add this storage policy (Dashboard → Storage → posts bucket → Policies):
--   Authenticated users can upload to their own folder:
--   (storage.foldername(name))[1] = auth.uid()::text
