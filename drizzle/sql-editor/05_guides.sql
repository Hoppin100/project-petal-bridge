-- SplitRush SQL editor paste 5 of 7
-- Creates guides, guide_sections, and guide_votes with their indexes, triggers, grants, and row-level security.
--
-- Paste this ENTIRE file into the Supabase SQL editor and run it once.
-- Safe to re-run: statements use IF NOT EXISTS / DROP ... IF EXISTS.
-- Requires the base SplitRush schema and the earlier numbered files
-- in this folder (see README.md for the order).

/* ------------------------------------------------------------------ *
 * Guides
 * ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS public.guides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  summary text,
  category text NOT NULL DEFAULT 'beginner'
    CHECK (category IN ('beginner', 'advanced', 'walkthrough', 'tips', 'glitch')),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  cover_image_url text,
  helpful_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz
);

CREATE INDEX IF NOT EXISTS guides_game_status_idx
  ON public.guides (game_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS guides_author_idx ON public.guides (author_id);

CREATE TABLE IF NOT EXISTS public.guide_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  heading text,
  body text NOT NULL DEFAULT '',
  image_url text,
  video_url text,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS guide_sections_order_idx
  ON public.guide_sections (guide_id, sort_order, created_at);

CREATE TABLE IF NOT EXISTS public.guide_votes (
  guide_id uuid NOT NULL REFERENCES public.guides(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guide_id, user_id)
);

CREATE OR REPLACE FUNCTION public.sync_guide_helpful_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.guides SET helpful_count = helpful_count + 1 WHERE id = NEW.guide_id;
    RETURN NEW;
  END IF;
  UPDATE public.guides SET helpful_count = GREATEST(helpful_count - 1, 0) WHERE id = OLD.guide_id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_guide_helpful_count() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guide_votes_count ON public.guide_votes;
CREATE TRIGGER guide_votes_count
  AFTER INSERT OR DELETE ON public.guide_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_guide_helpful_count();

CREATE OR REPLACE FUNCTION public.touch_guide()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.status = 'published' AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.touch_guide() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guides_touch ON public.guides;
CREATE TRIGGER guides_touch
  BEFORE UPDATE ON public.guides
  FOR EACH ROW EXECUTE FUNCTION public.touch_guide();

GRANT SELECT ON public.guides, public.guide_sections TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.guides, public.guide_sections TO authenticated;
GRANT ALL ON public.guides, public.guide_sections TO service_role;

GRANT SELECT, INSERT, DELETE ON public.guide_votes TO authenticated;
GRANT ALL ON public.guide_votes TO service_role;

ALTER TABLE public.guides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guide_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS guides_select_visible ON public.guides;
CREATE POLICY guides_select_visible ON public.guides
  FOR SELECT TO anon, authenticated
  USING (
    status = 'published'
    OR author_id = auth.uid()
    OR public.is_game_staff()
  );

DROP POLICY IF EXISTS guides_insert_own ON public.guides;
CREATE POLICY guides_insert_own ON public.guides
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_game_staff()
      OR EXISTS (
        SELECT 1 FROM public.games g
        WHERE g.id = game_id AND NOT g.is_hidden
      )
    )
  );

DROP POLICY IF EXISTS guides_update_own ON public.guides;
CREATE POLICY guides_update_own ON public.guides
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS guides_delete_own ON public.guides;
CREATE POLICY guides_delete_own ON public.guides
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS guide_sections_select_visible ON public.guide_sections;
CREATE POLICY guide_sections_select_visible ON public.guide_sections
  FOR SELECT TO anon, authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
        AND (g.status = 'published' OR g.author_id = auth.uid() OR public.is_game_staff())
    )
  );

DROP POLICY IF EXISTS guide_sections_write_own ON public.guide_sections;
CREATE POLICY guide_sections_write_own ON public.guide_sections
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
        AND (g.author_id = auth.uid() OR public.is_game_staff())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id
        AND (g.author_id = auth.uid() OR public.is_game_staff())
    )
  );

DROP POLICY IF EXISTS guide_votes_select_own ON public.guide_votes;
CREATE POLICY guide_votes_select_own ON public.guide_votes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS guide_votes_insert_own ON public.guide_votes;
CREATE POLICY guide_votes_insert_own ON public.guide_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.guides g
      WHERE g.id = guide_id AND g.status = 'published'
    )
  );

DROP POLICY IF EXISTS guide_votes_delete_own ON public.guide_votes;
CREATE POLICY guide_votes_delete_own ON public.guide_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());
