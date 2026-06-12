-- ============================================================
-- Migration 003: comments with optional GIF support
-- ============================================================

CREATE TABLE public.comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     uuid REFERENCES public.posts(id)    ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  body        text,
  gif_url     text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comment_has_content CHECK (body IS NOT NULL OR gif_url IS NOT NULL)
);

ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.comments FOR DELETE USING (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';
