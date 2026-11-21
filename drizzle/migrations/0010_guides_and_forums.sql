-- Guides and game forums.
--
-- Prerequisite: 0009_competition_types.sql (the categories index below uses
-- `competition_type`). Nothing here touches existing run or record data.

-- Identical category names are allowed as long as the competition type differs.
-- Subcategory duplicates were already allowed by 0006.
DROP INDEX IF EXISTS public.categories_main_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS categories_main_name_key
  ON public.categories (game_id, competition_type, name)
  WHERE parent_category_id IS NULL;

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

/* ------------------------------------------------------------------ *
 * Game forums
 * ------------------------------------------------------------------ */

CREATE TABLE IF NOT EXISTS public.forum_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL CHECK (btrim(title) <> ''),
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'general'
    CHECK (category IN ('general', 'help', 'strategies', 'questions', 'tips')),
  is_pinned boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  is_solved boolean NOT NULL DEFAULT false,
  accepted_post_id uuid,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_threads_game_idx
  ON public.forum_threads (game_id, is_pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS forum_threads_author_idx ON public.forum_threads (author_id);

CREATE TABLE IF NOT EXISTS public.forum_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  parent_post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  author_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (btrim(body) <> ''),
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS forum_posts_thread_idx
  ON public.forum_posts (thread_id, created_at);
CREATE INDEX IF NOT EXISTS forum_posts_parent_idx ON public.forum_posts (parent_post_id);

ALTER TABLE public.forum_threads
  DROP CONSTRAINT IF EXISTS forum_threads_accepted_post_fkey;
ALTER TABLE public.forum_threads
  ADD CONSTRAINT forum_threads_accepted_post_fkey
  FOREIGN KEY (accepted_post_id) REFERENCES public.forum_posts(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.forum_votes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  value smallint NOT NULL CHECK (value IN (-1, 1)),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_votes_one_target CHECK (
    (thread_id IS NOT NULL AND post_id IS NULL)
    OR (thread_id IS NULL AND post_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS forum_votes_user_thread_key
  ON public.forum_votes (user_id, thread_id) WHERE thread_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS forum_votes_user_post_key
  ON public.forum_votes (user_id, post_id) WHERE post_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.forum_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE CASCADE,
  thread_id uuid REFERENCES public.forum_threads(id) ON DELETE CASCADE,
  post_id uuid REFERENCES public.forum_posts(id) ON DELETE CASCADE,
  reason text NOT NULL CHECK (btrim(reason) <> ''),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'dismissed')),
  reviewed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT forum_reports_one_target CHECK (
    (thread_id IS NOT NULL AND post_id IS NULL)
    OR (thread_id IS NULL AND post_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS forum_reports_status_idx ON public.forum_reports (status, created_at DESC);

CREATE OR REPLACE FUNCTION public.sync_forum_thread_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_threads SET score = score + NEW.value WHERE id = NEW.thread_id;
    RETURN NEW;
  END IF;
  UPDATE public.forum_threads SET score = score - OLD.value WHERE id = OLD.thread_id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_forum_thread_score() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.sync_forum_post_score()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.forum_posts SET score = score + NEW.value WHERE id = NEW.post_id;
    RETURN NEW;
  END IF;
  UPDATE public.forum_posts SET score = score - OLD.value WHERE id = OLD.post_id;
  RETURN OLD;
END $$;
REVOKE EXECUTE ON FUNCTION public.sync_forum_post_score() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS forum_thread_votes_insert ON public.forum_votes;
CREATE TRIGGER forum_thread_votes_insert
  AFTER INSERT ON public.forum_votes
  FOR EACH ROW WHEN (NEW.thread_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_thread_score();

DROP TRIGGER IF EXISTS forum_thread_votes_delete ON public.forum_votes;
CREATE TRIGGER forum_thread_votes_delete
  AFTER DELETE ON public.forum_votes
  FOR EACH ROW WHEN (OLD.thread_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_thread_score();

DROP TRIGGER IF EXISTS forum_post_votes_insert ON public.forum_votes;
CREATE TRIGGER forum_post_votes_insert
  AFTER INSERT ON public.forum_votes
  FOR EACH ROW WHEN (NEW.post_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_post_score();

DROP TRIGGER IF EXISTS forum_post_votes_delete ON public.forum_votes;
CREATE TRIGGER forum_post_votes_delete
  AFTER DELETE ON public.forum_votes
  FOR EACH ROW WHEN (OLD.post_id IS NOT NULL)
  EXECUTE FUNCTION public.sync_forum_post_score();

CREATE OR REPLACE FUNCTION public.guard_forum_thread_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_game_staff() THEN
    IF NEW.is_pinned IS DISTINCT FROM OLD.is_pinned
       OR NEW.is_locked IS DISTINCT FROM OLD.is_locked THEN
      RAISE EXCEPTION 'Only staff can pin or lock discussions';
    END IF;
    IF NEW.accepted_post_id IS DISTINCT FROM OLD.accepted_post_id
       AND auth.uid() <> OLD.author_id
       AND NOT public.is_game_staff() THEN
      RAISE EXCEPTION 'Only the author or staff can accept an answer';
    END IF;
  END IF;

  IF NEW.accepted_post_id IS DISTINCT FROM OLD.accepted_post_id THEN
    IF NEW.accepted_post_id IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM public.forum_posts p
         WHERE p.id = NEW.accepted_post_id AND p.thread_id = NEW.id
       ) THEN
      RAISE EXCEPTION 'Accepted answer must belong to this discussion';
    END IF;
    NEW.is_solved := NEW.accepted_post_id IS NOT NULL;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_forum_thread_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS forum_threads_guard_update ON public.forum_threads;
CREATE TRIGGER forum_threads_guard_update
  BEFORE UPDATE ON public.forum_threads
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_thread_update();

CREATE OR REPLACE FUNCTION public.guard_forum_post_insert()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.forum_threads t
    WHERE t.id = NEW.thread_id AND t.is_locked
  ) AND NOT public.is_game_staff() THEN
    RAISE EXCEPTION 'This discussion is locked';
  END IF;
  IF NEW.parent_post_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.forum_posts p
    WHERE p.id = NEW.parent_post_id AND p.thread_id = NEW.thread_id
  ) THEN
    RAISE EXCEPTION 'Replies must stay inside the same discussion';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_forum_post_insert() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS forum_posts_guard_insert ON public.forum_posts;
CREATE TRIGGER forum_posts_guard_insert
  BEFORE INSERT ON public.forum_posts
  FOR EACH ROW EXECUTE FUNCTION public.guard_forum_post_insert();

GRANT SELECT ON public.forum_threads, public.forum_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.forum_threads, public.forum_posts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.forum_votes TO authenticated;
GRANT SELECT, INSERT ON public.forum_reports TO authenticated;
GRANT UPDATE ON public.forum_reports TO authenticated;
GRANT ALL ON public.forum_threads, public.forum_posts, public.forum_votes, public.forum_reports
  TO service_role;

ALTER TABLE public.forum_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forum_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS forum_threads_select_visible ON public.forum_threads;
CREATE POLICY forum_threads_select_visible ON public.forum_threads
  FOR SELECT TO anon, authenticated
  USING (
    public.is_game_staff()
    OR EXISTS (
      SELECT 1 FROM public.games g
      WHERE g.id = game_id AND NOT g.is_hidden
    )
  );

DROP POLICY IF EXISTS forum_threads_insert_own ON public.forum_threads;
CREATE POLICY forum_threads_insert_own ON public.forum_threads
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

DROP POLICY IF EXISTS forum_threads_update_own ON public.forum_threads;
CREATE POLICY forum_threads_update_own ON public.forum_threads
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_threads_delete_own ON public.forum_threads;
CREATE POLICY forum_threads_delete_own ON public.forum_threads
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_posts_select_visible ON public.forum_posts;
CREATE POLICY forum_posts_select_visible ON public.forum_posts
  FOR SELECT TO anon, authenticated
  USING (
    public.is_game_staff()
    OR EXISTS (
      SELECT 1
      FROM public.forum_threads t
      JOIN public.games g ON g.id = t.game_id
      WHERE t.id = thread_id AND NOT g.is_hidden
    )
  );

DROP POLICY IF EXISTS forum_posts_insert_own ON public.forum_posts;
CREATE POLICY forum_posts_insert_own ON public.forum_posts
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = author_id
    AND (
      public.is_game_staff()
      OR EXISTS (
        SELECT 1
        FROM public.forum_threads t
        JOIN public.games g ON g.id = t.game_id
        WHERE t.id = thread_id AND NOT g.is_hidden
      )
    )
  );

DROP POLICY IF EXISTS forum_posts_update_own ON public.forum_posts;
CREATE POLICY forum_posts_update_own ON public.forum_posts
  FOR UPDATE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff())
  WITH CHECK (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_posts_delete_own ON public.forum_posts;
CREATE POLICY forum_posts_delete_own ON public.forum_posts
  FOR DELETE TO authenticated
  USING (author_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_votes_select_own ON public.forum_votes;
CREATE POLICY forum_votes_select_own ON public.forum_votes
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS forum_votes_insert_own ON public.forum_votes;
CREATE POLICY forum_votes_insert_own ON public.forum_votes
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS forum_votes_delete_own ON public.forum_votes;
CREATE POLICY forum_votes_delete_own ON public.forum_votes
  FOR DELETE TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS forum_reports_select_own ON public.forum_reports;
CREATE POLICY forum_reports_select_own ON public.forum_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.is_game_staff());

DROP POLICY IF EXISTS forum_reports_insert_own ON public.forum_reports;
CREATE POLICY forum_reports_insert_own ON public.forum_reports
  FOR INSERT TO authenticated
  WITH CHECK (reporter_id = auth.uid());

DROP POLICY IF EXISTS forum_reports_update_staff ON public.forum_reports;
CREATE POLICY forum_reports_update_staff ON public.forum_reports
  FOR UPDATE TO authenticated
  USING (public.is_game_staff())
  WITH CHECK (public.is_game_staff());

/* ------------------------------------------------------------------ *
 * Vote helpers: one row per member and target, safe to call repeatedly.
 * ------------------------------------------------------------------ */

CREATE OR REPLACE FUNCTION public.vote_forum_thread(p_thread uuid, p_value smallint)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  DELETE FROM public.forum_votes WHERE user_id = auth.uid() AND thread_id = p_thread;
  IF p_value NOT IN (-1, 1) THEN RETURN; END IF;
  INSERT INTO public.forum_votes (user_id, thread_id, value)
  VALUES (auth.uid(), p_thread, p_value);
END $$;
REVOKE EXECUTE ON FUNCTION public.vote_forum_thread(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_forum_thread(uuid, smallint) TO authenticated;

CREATE OR REPLACE FUNCTION public.vote_forum_post(p_post uuid, p_value smallint)
RETURNS void
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to vote'; END IF;
  DELETE FROM public.forum_votes WHERE user_id = auth.uid() AND post_id = p_post;
  IF p_value NOT IN (-1, 1) THEN RETURN; END IF;
  INSERT INTO public.forum_votes (user_id, post_id, value)
  VALUES (auth.uid(), p_post, p_value);
END $$;
REVOKE EXECUTE ON FUNCTION public.vote_forum_post(uuid, smallint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vote_forum_post(uuid, smallint) TO authenticated;
