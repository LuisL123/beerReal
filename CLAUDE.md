# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Start dev server (scan QR with Expo Go)
npm start

# Run on specific platform
npm run android
npm run ios
```

There is no linter or test runner configured.

## Environment

Copy `.env.example` to `.env` and fill in Supabase credentials:
```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
```

## Architecture

**Cheers** is a BeReal-style beer social app. Users snap a photo of their drink, pick a drink type, add a caption, and post it to a shared feed where others can react with a "cheers."

### Tech stack
- **Expo SDK 54** with **expo-router** (file-based routing)
- **React Native 0.81** / **React 19**
- **Supabase** — auth, Postgres database, and Storage (bucket: `posts`)

### Routing
`app/_layout.tsx` is the root. It listens to `supabase.auth.onAuthStateChange` and redirects between two route groups:
- `(auth)/` — login and signup screens (unauthenticated)
- `(tabs)/` — three-tab shell (authenticated): feed (`index`), camera, profile

Authentication state is held at the root level; `session === undefined` means still loading (shows spinner).

### Data flow
All data access goes directly through the singleton `supabase` client (`lib/supabase.ts`). There is no state management library — screens manage their own local state with `useState`/`useEffect`.

Feed screen (`(tabs)/index.tsx`) subscribes to Supabase realtime on the `posts` table for live updates, and also re-fetches on screen focus via `useFocusEffect`.

Camera screen (`(tabs)/camera.tsx`) has three internal states — `camera → preview → uploading` — and on post:
1. Uploads photo bytes to Storage at path `{userId}/{timestamp}.jpg`
2. Inserts a row into `posts`
3. Increments `profiles.beer_count` for the user

### Database schema
Three tables (see `supabase/schema.sql`):
- `profiles` — extends `auth.users`; tracks `beer_count`
- `posts` — `image_url`, `caption`, `drink_type`
- `reactions` — one "cheers" per user per post (unique constraint on `post_id + user_id`)

RLS is enabled on all tables. Storage uses per-user folder isolation.

### Shared primitives
- `constants/colors.ts` — single `COLORS` object; dark theme with amber (`#F5A623`) as primary
- `types/index.ts` — `Profile`, `Post`, `Reaction` interfaces matching DB columns
- `components/PostCard.tsx` — reusable feed card used in `FlatList`
